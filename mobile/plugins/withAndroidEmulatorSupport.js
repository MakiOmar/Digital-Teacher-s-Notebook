const {
  withAppBuildGradle,
  withGradleProperties,
} = require("expo/config-plugins");

/**
 * Local Android Studio / x86_64 emulator support:
 * - Include x86_64 in default reactNativeArchitectures (stock AVD ABIs).
 * - Embed the JS bundle in debug so Run works without a separate Metro process.
 * - Make Clean Project reliable: ninja clean fails after library codegen dirs
 *   are deleted; delete .cxx caches instead.
 *
 * Play/release stays arm-only via: npm run build:aab
 * (-PreactNativeArchitectures=armeabi-v7a,arm64-v8a).
 */

const LOCAL_ARCHS = "armeabi-v7a,arm64-v8a,x86_64";

const NATIVE_CLEAN_MARKER = "cleanNativeCaches";

const NATIVE_CLEAN_BLOCK = `
// Android Studio "Clean Project" runs ninja clean against stale CMake caches
// that still reference library codegen/jni dirs already removed by other clean
// tasks. Skip ninja clean and delete .cxx instead.
tasks.configureEach { task ->
    if (task.name.startsWith("externalNativeBuildClean")) {
        task.enabled = false
    }
}

tasks.register("${NATIVE_CLEAN_MARKER}", Delete) {
    delete file("\${projectDir}/.cxx")
}

tasks.named("clean").configure {
    dependsOn("${NATIVE_CLEAN_MARKER}")
}
`;

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

    if (
      !contents.includes("debuggableVariants = []") &&
      contents.includes('bundleCommand = "export:embed"')
    ) {
      contents = contents.replace(
        'bundleCommand = "export:embed"',
        `bundleCommand = "export:embed"

    // Embed JS in debug so Android Studio Run works on emulators without Metro.
    debuggableVariants = []`
      );
    }

    if (!contents.includes(NATIVE_CLEAN_MARKER)) {
      contents = `${contents.trimEnd()}\n${NATIVE_CLEAN_BLOCK}\n`;
    }

    cfg.modResults.contents = contents;
    return cfg;
  });

  return config;
}

module.exports = withAndroidEmulatorSupport;
