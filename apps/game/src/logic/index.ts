/**
 * Public surface of the pure game engine, for the screens (step 3) to import.
 * Extensionless re-export so Metro resolves the source cleanly; the tests
 * import ./engine.ts directly with the explicit extension node requires.
 */
export * from "./engine";
export * from "./notifications";
export * from "./challenge";
