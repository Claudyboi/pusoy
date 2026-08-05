export type Suit = "D" | "C" | "H" | "S"; // Diamonds, Clubs, Hearts, Spades

export interface Card {
  rank: number; // 2-14 (2=Two ... 11=J, 12=Q, 13=K, 14=A)
  suit: Suit;
}

export const RANK_LABELS: Record<number, string> = {
  2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9", 10: "10",
  11: "J", 12: "Q", 13: "K", 14: "A",
};

export enum HandCategory {
  HighCard = 0,
  Pair = 1,
  TwoPair = 2,
  ThreeOfAKind = 3,
  Straight = 4,
  Flush = 5,
  FullHouse = 6,
  FourOfAKind = 7,
  StraightFlush = 8,
}

export interface EvaluatedHand {
  category: HandCategory;
  // Tiebreak ranks in descending order of significance, e.g. for a full
  // house [trip rank, pair rank]; for high card, all 5 ranks descending.
  tiebreak: number[];
  cards: Card[];
}

export interface PlayerArrangement {
  front: Card[]; // 3 cards
  middle: Card[]; // 5 cards
  back: Card[]; // 5 cards
}

export interface PlayerHandResult {
  arrangement: PlayerArrangement;
  frontEval: EvaluatedHand;
  middleEval: EvaluatedHand;
  backEval: EvaluatedHand;
  fouled: boolean; // true if front > middle or middle > back
}
