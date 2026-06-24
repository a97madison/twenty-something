import AsyncStorage from "@react-native-async-storage/async-storage";
import type { KeyValueStore } from "./logic";

/**
 * The real device store backing the engine's records persistence — the thin
 * AsyncStorage adapter for the engine's KeyValueStore interface. Kept out of
 * the pure logic so the engine stays node-testable with an in-memory fake.
 */
export const storage: KeyValueStore = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
};
