import { Card, EvaluatedHand, HandCategory } from "./types";

function sortDesc(nums: number[]): number[] {
  return [...nums].sort((a, b) => b - a);
}

function countByRank(cards: Card[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const c of cards) {
    counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1);
  }
  return counts;
}

function isFlush(cards: Card[]): boolean {
  return cards.every((c) => c.suit === cards[0].suit);
}

// Returns the high card of the straight if cards form a straight, else null.
// Handles wheel (A-2-3-4-5) as a low straight with high card 5.
function straightHighCard(cards: Card[]): number | null {
  const ranks = Array.from(new Set(cards.map((c) => c.rank))).sort((a, b) => a - b);
  if (ranks.length !== cards.length) return null; // duplicates -> not a straight

  // Standard consecutive check
  if (ranks[ranks.length - 1] - ranks[0] === ranks.length - 1) {
    return ranks[ranks.length - 1];
  }

  // Wheel check: A,2,3,4,5 -> ranks would be [2,3,4,5,14]
  const wheel = [2, 3, 4, 5, 14];
  if (cards.length === 5 && ranks.every((r, i) => r === wheel[i])) {
    return 5; // 5-high straight
  }

  return null;
}

/**
 * Evaluates a 5-card poker hand (used for middle and back).
 */
export function evaluateFive(cards: Card[]): EvaluatedHand {
  if (cards.length !== 5) throw new Error("evaluateFive requires exactly 5 cards");

  const counts = countByRank(cards);
  const flush = isFlush(cards);
  const straightHigh = straightHighCard(cards);

  // Group ranks by frequency, each group sorted descending by rank.
  const groups = Array.from(counts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]; // higher count first
    return b[0] - a[0]; // then higher rank first
  });
  const groupCounts = groups.map((g) => g[1]);
  const groupRanks = groups.map((g) => g[0]);

  if (straightHigh !== null && flush) {
    return { category: HandCategory.StraightFlush, tiebreak: [straightHigh], cards };
  }
  if (groupCounts[0] === 4) {
    return { category: HandCategory.FourOfAKind, tiebreak: [groupRanks[0], groupRanks[1]], cards };
  }
  if (groupCounts[0] === 3 && groupCounts[1] === 2) {
    return { category: HandCategory.FullHouse, tiebreak: [groupRanks[0], groupRanks[1]], cards };
  }
  if (flush) {
    return { category: HandCategory.Flush, tiebreak: sortDesc(cards.map((c) => c.rank)), cards };
  }
  if (straightHigh !== null) {
    return { category: HandCategory.Straight, tiebreak: [straightHigh], cards };
  }
  if (groupCounts[0] === 3) {
    return {
      category: HandCategory.ThreeOfAKind,
      tiebreak: [groupRanks[0], ...sortDesc(groupRanks.slice(1))],
      cards,
    };
  }
  if (groupCounts[0] === 2 && groupCounts[1] === 2) {
    const pairRanks = sortDesc([groupRanks[0], groupRanks[1]]);
    return { category: HandCategory.TwoPair, tiebreak: [...pairRanks, groupRanks[2]], cards };
  }
  if (groupCounts[0] === 2) {
    return {
      category: HandCategory.Pair,
      tiebreak: [groupRanks[0], ...sortDesc(groupRanks.slice(1))],
      cards,
    };
  }
  return { category: HandCategory.HighCard, tiebreak: sortDesc(cards.map((c) => c.rank)), cards };
}

/**
 * Evaluates a 3-card front hand. Only High Card, Pair, and Three of a Kind
 * are possible (straights/flushes don't count in a 3-card hand).
 */
export function evaluateFront(cards: Card[]): EvaluatedHand {
  if (cards.length !== 3) throw new Error("evaluateFront requires exactly 3 cards");

  const counts = countByRank(cards);
  const groups = Array.from(counts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });
  const groupCounts = groups.map((g) => g[1]);
  const groupRanks = groups.map((g) => g[0]);

  if (groupCounts[0] === 3) {
    return { category: HandCategory.ThreeOfAKind, tiebreak: [groupRanks[0]], cards };
  }
  if (groupCounts[0] === 2) {
    return {
      category: HandCategory.Pair,
      tiebreak: [groupRanks[0], groupRanks[1]],
      cards,
    };
  }
  return { category: HandCategory.HighCard, tiebreak: sortDesc(cards.map((c) => c.rank)), cards };
}

/**
 * Compares two evaluated hands of the SAME size class (both fronts, or both
 * middle/back). Returns >0 if a beats b, <0 if b beats a, 0 if exactly tied.
 */
export function compareHands(a: EvaluatedHand, b: EvaluatedHand): number {
  if (a.category !== b.category) return a.category - b.category;
  for (let i = 0; i < Math.max(a.tiebreak.length, b.tiebreak.length); i++) {
    const diff = (a.tiebreak[i] ?? 0) - (b.tiebreak[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0; // true tie (possible with exact same ranks, different suits)
}
