/**
 * Design tokens — the paper + green-felt identity, ported from the prototype.
 * Single source of visual truth for every component. Mirrors the CSS variables
 * the HTML prototype used, so the apps and that spec stay aligned. Shared by the
 * calculator and the game via @twenty-something/ui.
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
 * Font families. The serif (Fraunces) and mono (IBM Plex Mono) faces are bundled
 * and loaded at app start via `useAppFonts()` (see fonts.ts) — real cross-platform
 * typography, not the old iOS-only Georgia/Menlo placeholders. Each weight is a
 * distinct family because custom fonts don't synthesize bold on Android/web, so
 * styles set e.g. `fontFamily: fonts.serifBold` instead of `fontWeight: "700"`.
 * Sans stays on the System font on purpose — native SF/Roboto is ideal for the
 * tiny utility labels and costs no bundle weight.
 */
export const fonts = {
  serif: "Fraunces-Regular", // display body / dimmed numerals
  serifSemibold: "Fraunces-SemiBold", // medium-emphasis labels, op keys
  serifBold: "Fraunces-Bold", // wordmark, targets, buttons, headings, verdicts
  mono: "IBMPlexMono-Regular", // math expressions
  monoMedium: "IBMPlexMono-Medium", // keypad glyphs / backspace
  sans: "System", // small utility labels (native font, by design)
} as const;

export const radius = {
  sm: 8,
  md: 10,
  lg: 16, // calculator card faces + target pill
} as const;

/**
 * Elevation recipes — the "refined paper" depth language. Spread into a style
 * (`...shadows.card`). `elevation` covers Android; the shadow* props cover
 * iOS + web. Kept few and consistent so nothing floats arbitrarily.
 */
export const shadows = {
  /** Lifts a playing card / primary panel off the paper. */
  card: { shadowColor: "#2a2218", shadowOpacity: 0.16, shadowRadius: 9, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  /** Subtle lift for secondary surfaces (stat cells, ghost buttons). */
  soft: { shadowColor: "#2a2218", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  /** A felt-green glow under the primary action (Play, =, target pill). */
  accent: { shadowColor: "#1f6b4a", shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
} as const;

export const space = {
  xxl: 30,
} as const;

export type Colors = typeof colors;
