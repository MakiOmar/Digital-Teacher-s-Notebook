const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Expo already blocks exact `android/.gradle`, but Metro still watches nested
// paths like `android/.gradle/build-attribution` and crashes on Windows.
const extraBlockList = [
  /[/\\]android[/\\]\.gradle([\\/].*)?$/,
  /[/\\]android[/\\]build([\\/].*)?$/,
  /[/\\]android[/\\]app[/\\]build([\\/].*)?$/,
  /[/\\]ios[/\\]Pods([\\/].*)?$/,
  /[/\\]ios[/\\]build([\\/].*)?$/,
];

const existing = config.resolver.blockList;
if (Array.isArray(existing)) {
  config.resolver.blockList = [...existing, ...extraBlockList];
} else if (existing) {
  config.resolver.blockList = [existing, ...extraBlockList];
} else {
  config.resolver.blockList = extraBlockList;
}

module.exports = config;
