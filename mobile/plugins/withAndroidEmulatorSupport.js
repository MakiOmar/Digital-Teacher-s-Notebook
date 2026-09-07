const {
  withAppBuildGradle,
  withGradleProperties,
} = require("expo/config-plugins");

/**
 * Local Android Studio / x86_64 emulator support:
 * - Include x86_64 in default reactNativeArchitectures (stock AVD ABIs).
 * - Embed the JS bundle in debug so Run works without a separate Metro process.
 *
 * Play/release stays arm-only via: npm run build:aab
 * (-PreactNativeArchitectures=armeabi-v7a,arm64-v8a).
 */

const LOCAL_ARCHS = "armeabi-v7a,arm64-v8a,x86_64";

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

function withAndroidEmulatorSupport(config) {
  config = withGradleProperties(config, (cfg) => {
    setGradleProperty(cfg.modResults, "reactNativeArchitectures", LOCAL_ARCHS);
    return cfg;
  });

  config = withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;
    if (contents.includes("debuggableVariants = []")) {
      return cfg;
    }
    if (!contents.includes('bundleCommand = "export:embed"')) {
      return cfg;
    }
    contents = contents.replace(
      'bundleCommand = "export:embed"',
      `bundleCommand = "export:embed"

    // Embed JS in debug so Android Studio Run works on emulators without Metro.
    debuggableVariants = []`
    );
    cfg.modResults.contents = contents;
    return cfg;
  });

  return config;
}

module.exports = withAndroidEmulatorSupport;
