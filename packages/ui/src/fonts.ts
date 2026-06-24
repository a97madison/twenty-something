/**
 * Bundled font faces — the real typographic identity, shared by both apps.
 *
 * The theme tokens reference these by family NAME (see theme/tokens.ts). Custom
 * fonts don't synthesize weights on Android or react-native-web, so every weight
 * is registered as its own family (…-Regular / …-SemiBold / …-Bold) and styles
 * pick the family rather than leaning on `fontWeight`. Loaded once at each app's
 * root via `useAppFonts()`; UI labels deliberately stay on the System font.
 *
 * Fraunces + IBM Plex Mono, SIL OFL — see assets/fonts/LICENSE.txt.
 */
import { useFonts } from "expo-font";

/** family name → bundled .ttf (static literal paths, the way Metro needs them). */
export const fontAssets = {
  "Fraunces-Regular": require("../assets/fonts/Fraunces-Regular.ttf"),
  "Fraunces-SemiBold": require("../assets/fonts/Fraunces-SemiBold.ttf"),
  "Fraunces-Bold": require("../assets/fonts/Fraunces-Bold.ttf"),
  "IBMPlexMono-Regular": require("../assets/fonts/IBMPlexMono-Regular.ttf"),
  "IBMPlexMono-Medium": require("../assets/fonts/IBMPlexMono-Medium.ttf"),
} as const;

/**
 * Load the bundled fonts. Returns `[loaded, error]` like expo-font's useFonts;
 * the app should hold its first paint until `loaded` so text never flashes in a
 * fallback face. Call once, at the app root.
 */
export function useAppFonts() {
  return useFonts(fontAssets);
}
