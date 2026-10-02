const { withAppBuildGradle } = require("expo/config-plugins");

/**
 * Wire release builds to credentials/keystore.properties (gitignored).
 * Paths in that file are resolved relative to android/ (rootProject).
 */
const PROPS_LOADER = `
// --- begin release signing (credentials/keystore.properties) ---
def credsPropsFile = rootProject.file("../credentials/keystore.properties")
def credsProps = new Properties()
if (credsPropsFile.exists()) {
    credsPropsFile.withInputStream { credsProps.load(it) }
}
// --- end release signing loader ---
`;

const RELEASE_SIGNING_CONFIG = `
        release {
            if (credsPropsFile.exists()) {
                // Paths in keystore.properties are relative to android/ (rootProject).
                storeFile rootProject.file(credsProps['storeFile'])
                storePassword credsProps['storePassword']
                keyAlias credsProps['keyAlias']
                keyPassword credsProps['keyPassword']
            }
        }
`;

const RELEASE_SIGNING_LINE =
  "signingConfig credsPropsFile.exists() ? signingConfigs.release : signingConfigs.debug";

/**
 * Locate `name { ... }` by brace matching (regex alone cannot see nested blocks).
 * Returns indices of the opening and closing braces, or null.
 */
function findBlock(src, name, from = 0, to = src.length) {
  const re = new RegExp(`\\b${name}\\s*\\{`, "g");
  re.lastIndex = from;
  const match = re.exec(src);
  if (!match || match.index >= to) return null;
  const open = match.index + match[0].length - 1;
  let depth = 0;
  for (let i = open; i < to; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return { open, close: i };
  }
  return null;
}

function ensureReleaseSigningConfig(src) {
  const block = findBlock(src, "signingConfigs");
  if (!block) return src;
  if (findBlock(src, "release", block.open, block.close)) return src;
  return (
    src.slice(0, block.close).trimEnd() +
    RELEASE_SIGNING_CONFIG +
    "    " +
    src.slice(block.close)
  );
}

function ensureReleaseBuildTypeSigning(src) {
  const buildTypes = findBlock(src, "buildTypes");
  if (!buildTypes) return src;
  const release = findBlock(src, "release", buildTypes.open, buildTypes.close);
  if (!release) return src;

  const body = src.slice(release.open + 1, release.close);
  const signingRe =
    /signingConfig\s+(?:signingConfigs\.(?:debug|release)|credsPropsFile\.exists\(\)[^\n]*)/;
  const nextBody = signingRe.test(body)
    ? body.replace(signingRe, RELEASE_SIGNING_LINE)
    : `\n            ${RELEASE_SIGNING_LINE}${body}`;

  return src.slice(0, release.open + 1) + nextBody + src.slice(release.close);
}

function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;

    if (!contents.includes("credsPropsFile")) {
      contents = contents.replace(/android\s*\{/, `${PROPS_LOADER}\nandroid {`);
    }
    contents = ensureReleaseSigningConfig(contents);
    contents = ensureReleaseBuildTypeSigning(contents);

    cfg.modResults.contents = contents;
    return cfg;
  });
}

module.exports = withAndroidReleaseSigning;
