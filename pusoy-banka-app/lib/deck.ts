import { Card, Suit } from "./types";

const SUITS: Suit[] = ["D", "C", "H", "S"];

export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 2; rank <= 14; rank++) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

// Fisher-Yates shuffle. Accepts an optional RNG for testability.
export function shuffleDeck(deck: Card[], rng: () => number = Math.random): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Deals 13 cards each to exactly 4 players from a fresh shuffled deck.
export function dealHands(rng: () => number = Math.random): [Card[], Card[], Card[], Card[]] {
  const deck = shuffleDeck(buildDeck(), rng);
  const hands: Card[][] = [[], [], [], []];
  for (let i = 0; i < 52; i++) {
    hands[i % 4].push(deck[i]);
  }
  return hands as [Card[], Card[], Card[], Card[]];
}
