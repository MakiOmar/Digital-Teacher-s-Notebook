const {
  withAppBuildGradle,
  withGradleProperties,
} = require("expo/config-plugins");

/**
 * Expo still resolves RN paths with Groovy String.execute() in app/build.gradle.
 * That breaks Gradle configuration cache. Rewrite those calls to providers.exec
 * (same approach as settings.gradle) and opt the project into the cache.
 */

const EXECUTE_BLOCK = `react {
    entryFile = file(["node", "-e", "require('expo/scripts/resolveAppEntry')", projectRoot, "android", "absolute"].execute(null, rootDir).text.trim())
    reactNativeDir = new File(["node", "--print", "require.resolve('react-native/package.json')"].execute(null, rootDir).text.trim()).getParentFile().getAbsoluteFile()
    hermesCommand = new File(["node", "--print", "require.resolve('hermes-compiler/package.json', { paths: [require.resolve('react-native/package.json')] })"].execute(null, rootDir).text.trim()).getParentFile().getAbsolutePath() + "/hermesc/%OS-BIN%/hermesc"
    codegenDir = new File(["node", "--print", "require.resolve('@react-native/codegen/package.json', { paths: [require.resolve('react-native/package.json')] })"].execute(null, rootDir).text.trim()).getParentFile().getAbsoluteFile()

    enableBundleCompression = (findProperty('android.enableBundleCompression') ?: false).toBoolean()
    // Use Expo CLI to bundle the app, this ensures the Metro config
    // works correctly with Expo projects.
    cliFile = new File(["node", "--print", "require.resolve('@expo/cli', { paths: [require.resolve('expo/package.json')] })"].execute(null, rootDir).text.trim())
    bundleCommand = "export:embed"`;

const PROVIDERS_BLOCK = `// Configuration-cache safe Node lookups (providers.exec instead of String.execute).
def nodeOutput = { List<String> args ->
    providers.exec {
        workingDir(rootDir)
        commandLine(args)
    }.standardOutput.asText.get().trim()
}

react {
    entryFile = file(nodeOutput(["node", "-e", "require('expo/scripts/resolveAppEntry')", projectRoot, "android", "absolute"]))
    reactNativeDir = new File(nodeOutput(["node", "--print", "require.resolve('react-native/package.json')"])).getParentFile().getAbsoluteFile()
    hermesCommand = new File(nodeOutput(["node", "--print", "require.resolve('hermes-compiler/package.json', { paths: [require.resolve('react-native/package.json')] })"])).getParentFile().getAbsolutePath() + "/hermesc/%OS-BIN%/hermesc"
    codegenDir = new File(nodeOutput(["node", "--print", "require.resolve('@react-native/codegen/package.json', { paths: [require.resolve('react-native/package.json')] })"])).getParentFile().getAbsoluteFile()

    enableBundleCompression = (findProperty('android.enableBundleCompression') ?: false).toBoolean()
    // Use Expo CLI to bundle the app, this ensures the Metro config
    // works correctly with Expo projects.
    cliFile = new File(nodeOutput(["node", "--print", "require.resolve('@expo/cli', { paths: [require.resolve('expo/package.json')] })"]))
    bundleCommand = "export:embed"`;

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

function withGradleConfigurationCache(config) {
  config = withGradleProperties(config, (cfg) => {
    setGradleProperty(cfg.modResults, "org.gradle.configuration-cache", "true");
    return cfg;
  });

  config = withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;
    if (contents.includes("def nodeOutput = { List<String> args ->")) {
      return cfg;
    }
    if (!contents.includes(".execute(null, rootDir)")) {
      return cfg;
    }
    if (!contents.includes(EXECUTE_BLOCK)) {
      // Fallback: replace any .execute(null, rootDir) usages inside react {} lines.
      contents = contents.replace(
        /\[\s*"node"[\s\S]*?\]\.execute\(null,\s*rootDir\)\.text\.trim\(\)/g,
        (match) => {
          const list = match.replace(/\.execute\(null,\s*rootDir\)\.text\.trim\(\)$/, "");
          return `nodeOutput(${list})`;
        }
      );
      if (!contents.includes("def nodeOutput = { List<String> args ->")) {
        contents = contents.replace(
          "def projectRoot = rootDir.getAbsoluteFile().getParentFile().getAbsolutePath()\n",
          `def projectRoot = rootDir.getAbsoluteFile().getParentFile().getAbsolutePath()

// Configuration-cache safe Node lookups (providers.exec instead of String.execute).
def nodeOutput = { List<String> args ->
    providers.exec {
        workingDir(rootDir)
        commandLine(args)
    }.standardOutput.asText.get().trim()
}
`
        );
      }
      cfg.modResults.contents = contents;
      return cfg;
    }
    cfg.modResults.contents = contents.replace(EXECUTE_BLOCK, PROVIDERS_BLOCK);
    return cfg;
  });

  return config;
}

module.exports = withGradleConfigurationCache;
