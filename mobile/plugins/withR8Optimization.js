const {
  withAppBuildGradle,
  withGradleProperties,
} = require("expo/config-plugins");

/**
 * Play Console "Improve memory and performance with R8" recommendations:
 * - full R8 optimization (the default proguard-android.txt forces -dontoptimize)
 * - optimized resource shrinking (AGP 8.12+)
 * Keep rules for reflection-heavy libs stay in expo-build-properties extraProguardRules.
 */

function setGradleProperty(items, key, value) {
  const existing = items.find(
    (item) => item.type === "property" && item.key === key
  );
  if (existing) {
    existing.value = value;
  } else {
    items.push({ type: "property", key, value });
  }
}

function withR8Optimization(config) {
  config = withGradleProperties(config, (cfg) => {
    setGradleProperty(
      cfg.modResults,
      "android.r8.optimizedResourceShrinking",
      "true"
    );
    return cfg;
  });

  config = withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = cfg.modResults.contents.replace(
      'getDefaultProguardFile("proguard-android.txt")',
      'getDefaultProguardFile("proguard-android-optimize.txt")'
    );
    return cfg;
  });

  return config;
}

module.exports = withR8Optimization;
