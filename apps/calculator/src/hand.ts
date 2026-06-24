/** A fresh random hand: four card values (A–K = 1–13) and four random suits. */
export function randomHand(): { values: number[]; suits: number[] } {
  return {
    values: Array.from({ length: 4 }, () => 1 + Math.floor(Math.random() * 13)),
    suits: Array.from({ length: 4 }, () => Math.floor(Math.random() * 4)),
  };
}
