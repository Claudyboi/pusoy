import { compareHands, evaluateFive, evaluateFront } from "./evaluate";
import { PlayerArrangement, PlayerHandResult, Card } from "./types";
import { detectSpecial, DetectedSpecial } from "./specials";

/**
 * Validates and evaluates one player's arrangement. A "foul" happens when
 * front > middle or middle > back — fouled hands auto-lose every segment.
 */
export function buildPlayerHand(arrangement: PlayerArrangement): PlayerHandResult {
  if (arrangement.front.length !== 3 || arrangement.middle.length !== 5 || arrangement.back.length !== 5) {
    throw new Error("Arrangement must be 3/5/5 cards (front/middle/back)");
  }

  const frontEval = evaluateFront(arrangement.front);
  const middleEval = evaluateFive(arrangement.middle);
  const backEval = evaluateFive(arrangement.back);

  const fouled = compareHands(frontEval, middleEval) > 0 || compareHands(middleEval, backEval) > 0;

  return { arrangement, frontEval, middleEval, backEval, fouled };
}

export interface SegmentResult {
  segment: "front" | "middle" | "back";
  winner: "banka" | "player" | "tie";
}

export interface MatchupResult {
  playerIndex: number; // index into the 3 non-banka players
  segments: SegmentResult[];
  // Net points from banka's perspective for this matchup: positive = banka
  // wins points off this player, negative = banka pays this player.
  bankaNetPoints: number;
  sweepBonusApplied: boolean;
}

export interface RoundScoreResult {
  matchups: MatchupResult[];
  bankaTotalPoints: number; // sum of bankaNetPoints across all 3 matchups
}

interface ScoringOptions {
  pointsPerSegment?: number; // default 1
  sweepBonus?: number; // extra points for winning all 3 segments, default 0 (off)
}

/**
 * Scores banka's hand against each of the 3 other players' hands.
 * A fouled hand loses all 3 segments automatically to a non-fouled opponent.
 * If both foul, that matchup is a full tie (0 net points).
 */
export function scoreRound(
  banka: PlayerHandResult,
  others: PlayerHandResult[],
  options: ScoringOptions = {}
): RoundScoreResult {
  const pointsPerSegment = options.pointsPerSegment ?? 1;
  const sweepBonus = options.sweepBonus ?? 0;

  if (others.length !== 3) {
    throw new Error("scoreRound requires exactly 3 non-banka players");
  }

  const matchups: MatchupResult[] = others.map((player, playerIndex) => {
    const segments: SegmentResult[] = [];
    let bankaWins = 0;
    let playerWins = 0;

    if (banka.fouled && player.fouled) {
      // both foul: full tie, no points either way
      segments.push(
        { segment: "front", winner: "tie" },
        { segment: "middle", winner: "tie" },
        { segment: "back", winner: "tie" }
      );
    } else if (banka.fouled) {
      segments.push(
        { segment: "front", winner: "player" },
        { segment: "middle", winner: "player" },
        { segment: "back", winner: "player" }
      );
      playerWins = 3;
    } else if (player.fouled) {
      segments.push(
        { segment: "front", winner: "banka" },
        { segment: "middle", winner: "banka" },
        { segment: "back", winner: "banka" }
      );
      bankaWins = 3;
    } else {
      const pairs: Array<["front" | "middle" | "back", number]> = [
        ["front", compareHands(banka.frontEval, player.frontEval)],
        ["middle", compareHands(banka.middleEval, player.middleEval)],
        ["back", compareHands(banka.backEval, player.backEval)],
      ];
      for (const [segment, cmp] of pairs) {
        if (cmp > 0) {
          segments.push({ segment, winner: "banka" });
          bankaWins++;
        } else if (cmp < 0) {
          segments.push({ segment, winner: "player" });
          playerWins++;
        } else {
          segments.push({ segment, winner: "tie" });
        }
      }
    }

    let bankaNetPoints = (bankaWins - playerWins) * pointsPerSegment;
    let sweepBonusApplied = false;
    if (sweepBonus > 0) {
      if (bankaWins === 3) {
        bankaNetPoints += sweepBonus;
        sweepBonusApplied = true;
      } else if (playerWins === 3) {
        bankaNetPoints -= sweepBonus;
        sweepBonusApplied = true;
      }
    }

    return { playerIndex, segments, bankaNetPoints, sweepBonusApplied };
  });

  const bankaTotalPoints = matchups.reduce((sum, m) => sum + m.bankaNetPoints, 0);

  return { matchups, bankaTotalPoints };
}

export interface SpecialMatchupResult extends MatchupResult {
  resolvedBySpecial: boolean;
  bankaSpecial: DetectedSpecial | null;
  playerSpecial: DetectedSpecial | null;
}

export interface SpecialRoundScoreResult {
  matchups: SpecialMatchupResult[];
  bankaTotalPoints: number;
}

/**
 * Scores a round, checking for special ("natural") hands first. A special
 * hand wins outright against a non-special hand for fixed bonus points and
 * skips normal front/middle/back comparison entirely. If banka has a
 * special, banka wins every matchup UNLESS that specific player also has a
 * special worth more points, in which case that one matchup flips to the
 * player instead. Needs each player's raw 13-card hand (pre-arrangement) to
 * check for specials, plus their already-built PlayerHandResult for the
 * normal-scoring fallback path.
 */
export function scoreRoundWithSpecials(
  bankaCards: Card[],
  banka: PlayerHandResult,
  othersCards: Card[][],
  others: PlayerHandResult[],
  options: ScoringOptions = {}
): SpecialRoundScoreResult {
  if (othersCards.length !== 3 || others.length !== 3) {
    throw new Error("scoreRoundWithSpecials requires exactly 3 non-banka players");
  }

  const bankaSpecial = detectSpecial(bankaCards);
  const normalResult = scoreRound(banka, others, options);

  const matchups: SpecialMatchupResult[] = normalResult.matchups.map((normalMatchup, i) => {
    const playerSpecial = detectSpecial(othersCards[i]);

    if (!bankaSpecial && !playerSpecial) {
      return { ...normalMatchup, resolvedBySpecial: false, bankaSpecial: null, playerSpecial: null };
    }

    // Both have specials: higher point value wins; a true tie in points is
    // a no-op (0 net, treated as if neither had a special for that matchup).
    if (bankaSpecial && playerSpecial) {
      if (bankaSpecial.points === playerSpecial.points) {
        return { ...normalMatchup, resolvedBySpecial: false, bankaSpecial, playerSpecial };
      }
      const bankaWinsIt = bankaSpecial.points > playerSpecial.points;
      const points = Math.max(bankaSpecial.points, playerSpecial.points);
      return {
        playerIndex: normalMatchup.playerIndex,
        segments: [
          { segment: "front", winner: bankaWinsIt ? "banka" : "player" },
          { segment: "middle", winner: bankaWinsIt ? "banka" : "player" },
          { segment: "back", winner: bankaWinsIt ? "banka" : "player" },
        ],
        bankaNetPoints: bankaWinsIt ? points : -points,
        sweepBonusApplied: false,
        resolvedBySpecial: true,
        bankaSpecial,
        playerSpecial,
      };
    }

    // Exactly one side has a special.
    const bankaWinsIt = !!bankaSpecial;
    const points = (bankaSpecial ?? playerSpecial)!.points;
    return {
      playerIndex: normalMatchup.playerIndex,
      segments: [
        { segment: "front", winner: bankaWinsIt ? "banka" : "player" },
        { segment: "middle", winner: bankaWinsIt ? "banka" : "player" },
        { segment: "back", winner: bankaWinsIt ? "banka" : "player" },
      ],
      bankaNetPoints: bankaWinsIt ? points : -points,
      sweepBonusApplied: false,
      resolvedBySpecial: true,
      bankaSpecial,
      playerSpecial,
    };
  });

  const bankaTotalPoints = matchups.reduce((sum, m) => sum + m.bankaNetPoints, 0);
  return { matchups, bankaTotalPoints };
}

/**
 * Given a starting banka seat index (0-3) and the current round number
 * (1-indexed), returns which seat is banka. Banka rotates every 3 rounds,
 * in seat order.
 */
export function getBankaSeatForRound(roundNumber: number, startingSeat = 0, totalSeats = 4): number {
  const cycle = Math.floor((roundNumber - 1) / 3);
  return (startingSeat + cycle) % totalSeats;
}
