/**
 * Static require() map for the bundled playing-card PNGs (public-domain art,
 * MIT-packaged — see assets/cards/LICENSE.txt). Metro only resolves asset
 * require()s with literal string paths, so every card is listed explicitly.
 * Keyed by `${rank}_${suit}`; rank ∈ ace,2..10,jack,queen,king, suit by name.
 */

type ImageSource = number; // RN asset module id from require()

const CARDS: Record<string, ImageSource> = {
  "ace_clubs": require("../assets/cards/ace_of_clubs.png"),
  "ace_diamonds": require("../assets/cards/ace_of_diamonds.png"),
  "ace_hearts": require("../assets/cards/ace_of_hearts.png"),
  "ace_spades": require("../assets/cards/ace_of_spades.png"),
  "2_clubs": require("../assets/cards/2_of_clubs.png"),
  "2_diamonds": require("../assets/cards/2_of_diamonds.png"),
  "2_hearts": require("../assets/cards/2_of_hearts.png"),
  "2_spades": require("../assets/cards/2_of_spades.png"),
  "3_clubs": require("../assets/cards/3_of_clubs.png"),
  "3_diamonds": require("../assets/cards/3_of_diamonds.png"),
  "3_hearts": require("../assets/cards/3_of_hearts.png"),
  "3_spades": require("../assets/cards/3_of_spades.png"),
  "4_clubs": require("../assets/cards/4_of_clubs.png"),
  "4_diamonds": require("../assets/cards/4_of_diamonds.png"),
  "4_hearts": require("../assets/cards/4_of_hearts.png"),
  "4_spades": require("../assets/cards/4_of_spades.png"),
  "5_clubs": require("../assets/cards/5_of_clubs.png"),
  "5_diamonds": require("../assets/cards/5_of_diamonds.png"),
  "5_hearts": require("../assets/cards/5_of_hearts.png"),
  "5_spades": require("../assets/cards/5_of_spades.png"),
  "6_clubs": require("../assets/cards/6_of_clubs.png"),
  "6_diamonds": require("../assets/cards/6_of_diamonds.png"),
  "6_hearts": require("../assets/cards/6_of_hearts.png"),
  "6_spades": require("../assets/cards/6_of_spades.png"),
  "7_clubs": require("../assets/cards/7_of_clubs.png"),
  "7_diamonds": require("../assets/cards/7_of_diamonds.png"),
  "7_hearts": require("../assets/cards/7_of_hearts.png"),
  "7_spades": require("../assets/cards/7_of_spades.png"),
  "8_clubs": require("../assets/cards/8_of_clubs.png"),
  "8_diamonds": require("../assets/cards/8_of_diamonds.png"),
  "8_hearts": require("../assets/cards/8_of_hearts.png"),
  "8_spades": require("../assets/cards/8_of_spades.png"),
  "9_clubs": require("../assets/cards/9_of_clubs.png"),
  "9_diamonds": require("../assets/cards/9_of_diamonds.png"),
  "9_hearts": require("../assets/cards/9_of_hearts.png"),
  "9_spades": require("../assets/cards/9_of_spades.png"),
  "10_clubs": require("../assets/cards/10_of_clubs.png"),
  "10_diamonds": require("../assets/cards/10_of_diamonds.png"),
  "10_hearts": require("../assets/cards/10_of_hearts.png"),
  "10_spades": require("../assets/cards/10_of_spades.png"),
  "jack_clubs": require("../assets/cards/jack_of_clubs.png"),
  "jack_diamonds": require("../assets/cards/jack_of_diamonds.png"),
  "jack_hearts": require("../assets/cards/jack_of_hearts.png"),
  "jack_spades": require("../assets/cards/jack_of_spades.png"),
  "queen_clubs": require("../assets/cards/queen_of_clubs.png"),
  "queen_diamonds": require("../assets/cards/queen_of_diamonds.png"),
  "queen_hearts": require("../assets/cards/queen_of_hearts.png"),
  "queen_spades": require("../assets/cards/queen_of_spades.png"),
  "king_clubs": require("../assets/cards/king_of_clubs.png"),
  "king_diamonds": require("../assets/cards/king_of_diamonds.png"),
  "king_hearts": require("../assets/cards/king_of_hearts.png"),
  "king_spades": require("../assets/cards/king_of_spades.png"),
};

/** The card back (used for the deal-flip animation). */
export const CARD_BACK: ImageSource = require("../assets/cards/back.png");

const RANK_BY_VALUE: Record<number, string> = {
  1: "ace", 2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7",
  8: "8", 9: "9", 10: "10", 11: "jack", 12: "queen", 13: "king",
};

const SUIT_BY_GLYPH: Record<string, string> = {
  "♠": "spades", "♥": "hearts", "♦": "diamonds", "♣": "clubs",
};

/**
 * Resolve the bundled PNG for a card. `value` is A–K = 1–13; `suitGlyph` is the
 * unicode suit (♠♥♦♣) — taken from the caller's suitData so the mapping doesn't
 * depend on any particular suit-index order. Returns null for out-of-range input.
 */
export function cardImage(value: number, suitGlyph: string): ImageSource | null {
  const rank = RANK_BY_VALUE[value];
  const suit = SUIT_BY_GLYPH[suitGlyph];
  if (rank === undefined || suit === undefined) return null;
  return CARDS[`${rank}_${suit}`] ?? null;
}
