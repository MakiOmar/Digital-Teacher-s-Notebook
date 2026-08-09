const { withAppBuildGradle } = require("expo/config-plugins");
const path = require("path");

/**
 * Wire release builds to credentials/keystore.properties (gitignored).
 * Path is resolved relative to the android/ project root.
 */
function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;

    if (contents.includes("signingConfigs.release")) {
      return cfg;
    }

    const propsLoader = `
// --- begin release signing (credentials/keystore.properties) ---
def credsPropsFile = rootProject.file("../credentials/keystore.properties")
def credsProps = new Properties()
if (credsPropsFile.exists()) {
    credsPropsFile.withInputStream { credsProps.load(it) }
}
// --- end release signing loader ---
`;

    if (!contents.includes("credsPropsFile")) {
      contents = contents.replace(
        /android\s*\{/,
        `${propsLoader}\nandroid {`
      );
    }

    const releaseSigningConfig = `
        release {
            if (credsPropsFile.exists()) {
                // Paths in keystore.properties are relative to android/ (rootProject).
                storeFile rootProject.file(credsProps['storeFile'])
                storePassword credsProps['storePassword']
                keyAlias credsProps['keyAlias']
                keyPassword credsProps['keyPassword']
            }
        }`;

    contents = contents.replace(
      /signingConfigs\s*\{([\s\S]*?)debug\s*\{([\s\S]*?)\n\s*\}/,
      (match, before, debugBody) => {
        return `signingConfigs {${before}debug {${debugBody}\n        }${releaseSigningConfig}`;
      }
    );

    // Prefer release keystore for release builds when present.
    contents = contents.replace(
      /release\s*\{[\s\S]*?signingConfig signingConfigs\.debug/,
      (match) =>
        match.replace(
          "signingConfig signingConfigs.debug",
          `signingConfig credsPropsFile.exists() ? signingConfigs.release : signingConfigs.debug`
        )
    );

    cfg.modResults.contents = contents;
    return cfg;
  });
}

module.exports = withAndroidReleaseSigning;
