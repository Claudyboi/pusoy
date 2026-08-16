import { Card, PlayerArrangement } from "./types";
import { evaluateFive, evaluateFront, compareHands } from "./evaluate";

function combinations<T>(items: T[], k: number): T[][] {
  const results: T[][] = [];
  const combo: T[] = [];
  function backtrack(start: number) {
    if (combo.length === k) {
      results.push([...combo]);
      return;
    }
    for (let i = start; i < items.length; i++) {
      combo.push(items[i]);
      backtrack(i + 1);
      combo.pop();
    }
  }
  backtrack(0);
  return results;
}

function remaining(all: Card[], used: Card[]): Card[] {
  const usedKeys = new Set(used.map((c) => `${c.rank}${c.suit}`));
  return all.filter((c) => !usedKeys.has(`${c.rank}${c.suit}`));
}

/**
 * Picks a reasonably strong, legal arrangement for a 13-card hand: tries to
 * maximize the back hand, then the middle hand, while avoiding a foul
 * (front > middle or middle > back) whenever a legal option exists. Not a
 * perfect solver, but good enough for a bot opponent.
 */
export function autoArrange(cards: Card[]): PlayerArrangement {
  if (cards.length !== 13) throw new Error("autoArrange requires exactly 13 cards");

  const backCandidates = combinations(cards, 5)
    .map((back) => ({ back, backEval: evaluateFive(back) }))
    .sort((a, b) => compareHands(b.backEval, a.backEval)); // strongest back first

  let bestLegal: PlayerArrangement | null = null;
  let bestLegalMiddleEval = null as ReturnType<typeof evaluateFive> | null;
  let fallback: PlayerArrangement | null = null;

  // Only search the top slice of back candidates for speed; strongest backs
  // are tried first, so a legal arrangement is usually found quickly.
  const searchLimit = Math.min(backCandidates.length, 300);

  for (let i = 0; i < searchLimit; i++) {
    const { back, backEval } = backCandidates[i];
    const rest8 = remaining(cards, back);
    const middleCandidates = combinations(rest8, 5)
      .map((middle) => ({ middle, middleEval: evaluateFive(middle) }))
      .filter((m) => compareHands(m.middleEval, backEval) <= 0) // middle <= back
      .sort((a, b) => compareHands(b.middleEval, a.middleEval)); // strongest middle first

    if (middleCandidates.length === 0) {
      if (!fallback) {
        // no valid middle at all for this back; still record something
        const anyMiddle = combinations(rest8, 5)[0];
        const front = remaining(rest8, anyMiddle);
        fallback = { front, middle: anyMiddle, back };
      }
      continue;
    }

    for (const { middle, middleEval } of middleCandidates) {
      const front = remaining(rest8, middle);
      // front's own strength doesn't need separate evaluation to check
      // legality against middle beyond category+rank comparison, reuse
      // evaluateFive-style comparison isn't directly valid for 3 cards, so
      // approximate via a lightweight front check using evaluateFront.
      const frontEval = evaluateFront(front);
      const legal = compareHands(frontEval, middleEval) <= 0;

      if (!fallback) fallback = { front, middle, back };

      if (legal) {
        bestLegal = { front, middle, back };
        bestLegalMiddleEval = middleEval;
        break; // strongest legal middle for this (strongest) back found
      }
    }

    if (bestLegal) break; // strongest back with a legal split found, done
  }

  return bestLegal ?? fallback ?? { front: cards.slice(0, 3), middle: cards.slice(3, 8), back: cards.slice(8, 13) };
}
