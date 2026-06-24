// Metro bundler config for the monorepo.
//
// React Native's Metro bundler, unlike Node, does NOT by default look outside
// the app's own folder or follow workspace symlinks. In a monorepo that means
// `import ... from "@twenty-something/core"` fails to resolve. The two settings
// below fix that:
//   - watchFolders: tell Metro to watch the whole monorepo, so changes in
//     packages/core trigger reloads and its files are bundleable.
//   - nodeModulesPaths: resolve modules from BOTH the app's node_modules and
//     the hoisted root node_modules (where workspaces install shared deps).
//
// This is the standard Expo-in-a-monorepo setup.

const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Don't let Metro resolve a second copy of React from the package's own tree.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
