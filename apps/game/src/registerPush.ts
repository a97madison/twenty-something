/**
 * Mint this device's Expo push token and register it with the backend. Wrapped
 * in a try/catch that swallows EVERYTHING on purpose: `getExpoPushTokenAsync`
 * only works in a native dev/prod build on a real device with an EAS projectId —
 * in Expo Go, on web, or on a simulator it throws, and we just skip. So this is
 * ready to start working the moment a dev build exists, and harmlessly no-ops
 * until then. Permission is asked at a value moment (after a finished game), not
 * on cold launch.
 */
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

import { storage } from "./storage";
import { registerPushToken } from "./backend/push";

let attempted = false;

export async function registerForPush(playerId: string): Promise<void> {
  if (attempted || !playerId) return; // once per app run
  attempted = true;
  try {
    if (Platform.OS === "web") return; // no native push on web
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== "granted") return;
    // projectId is inferred from the app config (EAS) inside a real build.
    const { data: token } = await Notifications.getExpoPushTokenAsync();
    if (token) await registerPushToken(storage, playerId, token);
  } catch {
    // No dev build / no projectId / Expo Go → silently skip; ready for later.
  }
}
