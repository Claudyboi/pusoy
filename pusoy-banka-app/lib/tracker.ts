import { RoundScoreResult } from "./scoring";

export interface PlayerSessionStats {
  seat: number; // 0-3
  name: string;
  totalPoints: number; // cumulative net points across the whole session
  roundsWon: number; // rounds where this player's net points were positive
  roundsLost: number; // rounds where this player's net points were negative
  roundsTied: number; // rounds where this player's net points were exactly 0
  timesBanka: number;
}

export interface RoundLogEntry {
  roundNumber: number;
  bankaSeat: number;
  otherSeats: number[]; // seat indices for the 3 non-banka players, in matchup order
  result: RoundScoreResult;
}

export interface SessionState {
  players: PlayerSessionStats[]; // always length 4, indexed by seat
  roundLog: RoundLogEntry[];
}

export function createSession(names: [string, string, string, string]): SessionState {
  return {
    players: names.map((name, seat) => ({
      seat,
      name,
      totalPoints: 0,
      roundsWon: 0,
      roundsLost: 0,
      roundsTied: 0,
      timesBanka: 0,
    })),
    roundLog: [],
  };
}

/**
 * Records one round's result into the session. Returns a new SessionState
 * (does not mutate the input) so it's easy to store/replay in Supabase.
 *
 * otherSeats must list the 3 non-banka seats in the same order used when
 * scoreRound(banka, others) was called, so matchup.playerIndex maps back
 * to the correct seat.
 */
export function recordRound(
  session: SessionState,
  roundNumber: number,
  bankaSeat: number,
  otherSeats: [number, number, number],
  result: RoundScoreResult
): SessionState {
  // net points per seat this round, starting with banka
  const roundNetBySeat = new Map<number, number>();
  roundNetBySeat.set(bankaSeat, result.bankaTotalPoints);
  for (const matchup of result.matchups) {
    const seat = otherSeats[matchup.playerIndex];
    roundNetBySeat.set(seat, -matchup.bankaNetPoints);
  }

  const players = session.players.map((p) => {
    const net = roundNetBySeat.get(p.seat) ?? 0;
    return {
      ...p,
      totalPoints: p.totalPoints + net,
      roundsWon: p.roundsWon + (net > 0 ? 1 : 0),
      roundsLost: p.roundsLost + (net < 0 ? 1 : 0),
      roundsTied: p.roundsTied + (net === 0 ? 1 : 0),
      timesBanka: p.timesBanka + (p.seat === bankaSeat ? 1 : 0),
    };
  });

  const roundLog = [...session.roundLog, { roundNumber, bankaSeat, otherSeats: [...otherSeats], result }];

  return { players, roundLog };
}

/** Convenience: players sorted by total points, highest first (leaderboard order). */
export function leaderboard(session: SessionState): PlayerSessionStats[] {
  return [...session.players].sort((a, b) => b.totalPoints - a.totalPoints);
}
