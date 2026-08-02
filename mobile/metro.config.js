const path = require("path");
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

const shimPath = path.resolve(__dirname, "src/theme/react-native-cairo.tsx");
const rnEntry = require.resolve("react-native");
const projectRoot = path.resolve(__dirname).replace(/\\/g, "/");

/**
 * Route app imports of `react-native` through our Cairo Text shim.
 * node_modules and the shim itself still resolve to the real package.
 */
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "react-native") {
    const origin = (context.originModulePath || "").replace(/\\/g, "/");
    const fromShimOrTypography =
      origin.endsWith("/src/theme/react-native-cairo.tsx") ||
      origin.endsWith("/src/theme/typography.ts");
    const inAppCode =
      origin.startsWith(projectRoot + "/app/") ||
      origin.startsWith(projectRoot + "/src/") ||
      origin.startsWith(projectRoot + "/components/");
    if (fromShimOrTypography || !inAppCode) {
      return { filePath: rnEntry, type: "sourceFile" };
    }
    return { filePath: shimPath, type: "sourceFile" };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
