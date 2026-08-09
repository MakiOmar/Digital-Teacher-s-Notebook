const { withAppBuildGradle } = require("expo/config-plugins");

/**
 * Wire release builds to credentials/keystore.properties (gitignored).
 * Paths in that file are resolved relative to android/ (rootProject).
 */
function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;

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

    // Ensure signingConfigs.release exists (after signingConfigs.debug).
    if (!/signingConfigs\s*\{[\s\S]*?\brelease\s*\{/.test(contents)) {
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
        /signingConfigs\s*\{([\s\S]*?)(\n\s*\})/,
        (match, body, closer) => {
          if (/\brelease\s*\{/.test(body)) {
            return match;
          }
          return `signingConfigs {${body}${releaseSigningConfig}${closer}`;
        }
      );
    }

    // Force buildTypes.release (not signingConfigs.release) to use the upload key.
    const releaseSigningLine =
      "signingConfig credsPropsFile.exists() ? signingConfigs.release : signingConfigs.debug";

    contents = contents.replace(
      /buildTypes\s*\{([\s\S]*?\n\s*)\}/,
      (match, body) => {
        let next = body.replace(
          /(\brelease\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.(?:debug|release)/,
          `$1${releaseSigningLine}`
        );

        // If release block has no signingConfig line yet, inject one after "release {".
        if (!/\brelease\s*\{[\s\S]*?signingConfig\s/.test(next)) {
          next = next.replace(
            /\brelease\s*\{/,
            `release {\n            ${releaseSigningLine}`
          );
        }

        // Do not leave debug builds using the upload key by accident.
        next = next.replace(
          /(\bdebug\s*\{[\s\S]*?)signingConfig\s+credsPropsFile\.exists\(\)\s*\?\s*signingConfigs\.release\s*:\s*signingConfigs\.debug/,
          "$1signingConfig signingConfigs.debug"
        );

        return `buildTypes {${next}}`;
      }
    );

    cfg.modResults.contents = contents;
    return cfg;
  });
}

module.exports = withAndroidReleaseSigning;
