/**
 * Design tokens — the paper + green-felt identity, ported from the prototype.
 * Single source of visual truth for every component. Mirrors the CSS variables
 * the HTML prototype used, so the app and that spec stay aligned.
 */

export const colors = {
  bg: "#efeade", // warm paper
  panel: "#ffffff", // raised surfaces
  panel2: "#f4efe3", // pressed/secondary surface
  ink: "#1f2a22", // near-black with a faint green cast
  inkDim: "#5c6258", // muted body
  inkFaint: "#9aa08c", // hints/labels
  line: "#d6cdb8", // hairline on paper
  line2: "#c4baa1", // stronger border
  accent: "#1f6b4a", // card-table felt green
  accentSoft: "#2f8a5f", // lighter felt for outlines / 4th-card
  accentInk: "#eff5ef", // text on the felt button
  good: "#1f6b4a", // success = felt green
  bad: "#a8392b", // card red, doubles as error
  cardFace: "#ffffff",
  cardRed: "#a8392b",
  cardBlack: "#1f2a22",
  verdictOkBg: "#e3efe7",
  verdictOkInk: "#16503a",
  verdictNoBg: "#f4e4e1",
  verdictNoInk: "#7d281d",
} as const;

/**
 * Font families. The actual font files are loaded at app start; these names
 * are placeholders for a serif display face + system fallbacks. The prototype
 * used Georgia; on device we'll bundle a comparable serif. Mono is for the
 * math expressions, sans for utility labels.
 */
export const fonts = {
  serif: "Georgia", // display: wordmark, target, card pips, buttons, verdicts
  mono: "Menlo", // math expressions
  sans: "System", // small utility labels
} as const;

export const radius = {
  sm: 8,
  md: 10,
} as const;

export const space = {
  xxl: 30,
} as const;

export type Colors = typeof colors;
