import { Card } from "./types";

export enum SpecialType {
  RoyalFlush = "RoyalFlush",
  StraightFlush = "StraightFlush",
  Quadro = "Quadro", // four of a kind anywhere in the 13
  SixPairs = "SixPairs",
  ThreeFlushes = "ThreeFlushes",
  ThreeStraights = "ThreeStraights",
  ThreeTrios = "ThreeTrios",
  OneMan = "OneMan", // exactly one face card (J/Q/K) in the whole hand
  OneBlack = "OneBlack", // exactly one black card in the whole hand
  OneRed = "OneRed", // exactly one red card in the whole hand
}

// Default bonus points per special. Tweak freely — order here also acts as
// the "which special wins if both banka and a player have one" ranking,
// since higher points = stronger.
export const SPECIAL_POINTS: Record<SpecialType, number> = {
  [SpecialType.RoyalFlush]: 10,
  [SpecialType.StraightFlush]: 8,
  [SpecialType.SixPairs]: 6,
  [SpecialType.Quadro]: 6,
  [SpecialType.ThreeFlushes]: 5,
  [SpecialType.ThreeStraights]: 5,
  [SpecialType.ThreeTrios]: 4,
  [SpecialType.OneMan]: 3,
  [SpecialType.OneBlack]: 3,
  [SpecialType.OneRed]: 3,
};

export interface DetectedSpecial {
  type: SpecialType;
  points: number;
}

function rankCounts(cards: Card[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const c of cards) m.set(c.rank, (m.get(c.rank) ?? 0) + 1);
  return m;
}

function suitCounts(cards: Card[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const c of cards) m.set(c.suit, (m.get(c.suit) ?? 0) + 1);
  return m;
}

function checkSixPairs(cards: Card[]): boolean {
  const counts = rankCounts(cards);
  let pairs = 0;
  for (const count of counts.values()) {
    pairs += Math.floor(count / 2); // a rank with 4 copies counts as 2 pairs
  }
  return pairs >= 6;
}

function checkQuadro(cards: Card[]): boolean {
  const counts = rankCounts(cards);
  return Array.from(counts.values()).some((c) => c >= 4);
}

// Finds the best 5-card same-suit straight (straight flush) in the hand, if any.
// Returns "royal" | "straight" | null.
function checkFlushStraight(cards: Card[]): "royal" | "straight" | null {
  const bySuit = new Map<string, number[]>();
  for (const c of cards) {
    if (!bySuit.has(c.suit)) bySuit.set(c.suit, []);
    bySuit.get(c.suit)!.push(c.rank);
  }
  for (const ranks of bySuit.values()) {
    if (ranks.length < 5) continue;
    const unique = Array.from(new Set(ranks)).sort((a, b) => a - b);
    // check every 5-length consecutive window
    for (let start = 2; start <= 10; start++) {
      const needed = [start, start + 1, start + 2, start + 3, start + 4];
      if (needed.every((r) => unique.includes(r))) {
        if (start === 10) return "royal"; // 10-J-Q-K-A
        return "straight";
      }
    }
    // wheel: A-2-3-4-5
    if ([2, 3, 4, 5, 14].every((r) => unique.includes(r))) {
      return "straight";
    }
  }
  return null;
}

function checkThreeTrios(cards: Card[]): boolean {
  const counts = rankCounts(cards);
  const tripEligibleRanks = Array.from(counts.values()).filter((c) => c >= 3).length;
  return tripEligibleRanks >= 3;
}

function checkThreeFlushes(cards: Card[]): boolean {
  const counts = Array.from(suitCounts(cards).values()).filter((c) => c > 0);
  const sorted = [...counts].sort((a, b) => a - b);
  return sorted.length === 3 && sorted[0] === 3 && sorted[1] === 5 && sorted[2] === 5;
}

// Brute-force check: can the 13 ranks be split into a 3-run, a 5-run, and
// another 5-run (all consecutive), using each card exactly once?
function checkThreeStraights(cards: Card[]): boolean {
  // available[rank] = how many copies of that rank we have left to use
  const available = new Map<number, number>();
  for (const c of cards) available.set(c.rank, (available.get(c.rank) ?? 0) + 1);

  function canTakeRun(start: number, length: number, avail: Map<number, number>): Map<number, number> | null {
    const next = new Map(avail);
    for (let r = start; r < start + length; r++) {
      const have = next.get(r) ?? 0;
      if (have < 1) return null;
      next.set(r, have - 1);
    }
    return next;
  }

  // front: 3-run, starts 2..12 (no wheel needed for length 3 given rank range)
  for (let frontStart = 2; frontStart <= 12; frontStart++) {
    const afterFront = canTakeRun(frontStart, 3, available);
    if (!afterFront) continue;

    // middle: 5-run, starts 2..10, plus wheel
    const middleStarts: number[] = [2, 3, 4, 5, 6, 7, 8, 9, 10];
    for (const midStart of middleStarts) {
      const afterMiddle = canTakeRun(midStart, 5, afterFront);
      if (!afterMiddle) continue;

      for (const backStart of middleStarts) {
        const afterBack = canTakeRun(backStart, 5, afterMiddle);
        if (!afterBack) continue;
        // all 13 cards must be used up
        const remaining = Array.from(afterBack.values()).reduce((a, b) => a + b, 0);
        if (remaining === 0) return true;
      }
    }
  }
  return false;
}

function checkOneMan(cards: Card[]): boolean {
  const faceCount = cards.filter((c) => c.rank === 11 || c.rank === 12 || c.rank === 13).length;
  return faceCount === 1;
}

function checkOneColor(cards: Card[]): "OneBlack" | "OneRed" | null {
  const blackCount = cards.filter((c) => c.suit === "S" || c.suit === "C").length;
  const redCount = cards.length - blackCount;
  if (blackCount === 1) return "OneBlack"; // 1 black card, 12 red
  if (redCount === 1) return "OneRed"; // 1 red card, 12 black
  return null;
}

/**
 * Detects the strongest special ("natural") hand present in a raw 13-card
 * hand, or null if none apply. If multiple qualify, the highest-value one
 * wins (per SPECIAL_POINTS).
 */
export function detectSpecial(cards: Card[]): DetectedSpecial | null {
  if (cards.length !== 13) throw new Error("detectSpecial requires exactly 13 cards");

  const found: SpecialType[] = [];

  const flushStraight = checkFlushStraight(cards);
  if (flushStraight === "royal") found.push(SpecialType.RoyalFlush);
  else if (flushStraight === "straight") found.push(SpecialType.StraightFlush);

  if (checkSixPairs(cards)) found.push(SpecialType.SixPairs);
  if (checkQuadro(cards)) found.push(SpecialType.Quadro);
  if (checkThreeFlushes(cards)) found.push(SpecialType.ThreeFlushes);
  if (checkThreeStraights(cards)) found.push(SpecialType.ThreeStraights);
  if (checkThreeTrios(cards)) found.push(SpecialType.ThreeTrios);
  if (checkOneMan(cards)) found.push(SpecialType.OneMan);
  const oneColor = checkOneColor(cards);
  if (oneColor === "OneBlack") found.push(SpecialType.OneBlack);
  if (oneColor === "OneRed") found.push(SpecialType.OneRed);

  if (found.length === 0) return null;

  found.sort((a, b) => SPECIAL_POINTS[b] - SPECIAL_POINTS[a]);
  return { type: found[0], points: SPECIAL_POINTS[found[0]] };
}
