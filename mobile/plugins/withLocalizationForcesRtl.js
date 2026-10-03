const { withFinalizedMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Keep expo-localization from touching I18nUtil at runtime.
 *
 * With supportsRTL/forcesRTL set, LocalizationModule.OnCreate calls
 * forceRTL(false) on every React instance (including our layout reload),
 * undoing the language-driven forceRTL from src/i18n/language.ts. Fabric
 * re-reads those prefs on each root re-measure while JS keeps the startup
 * I18nManager.isRTL, so the layout ends up mirrored the wrong way.
 * "unset" makes the module a no-op; app.json extra stays for Expo Go.
 */
const RTL_STRING_NAMES = [
  "ExpoLocalization_supportsRTL",
  "ExpoLocalization_forcesRTL",
];

function unsetRtlStrings(xml) {
  return RTL_STRING_NAMES.reduce(
    (out, name) =>
      out.replace(
        new RegExp(`(<string name="${name}"[^>]*>)[^<]*(</string>)`),
        "$1unset$2"
      ),
    xml
  );
}

function withLocalizationForcesRtl(config) {
  // Finalized: expo-localization's own strings mod has already written values.
  return withFinalizedMod(config, [
    "android",
    async (cfg) => {
      const stringsPath = path.join(
        cfg.modRequest.platformProjectRoot,
        "app/src/main/res/values/strings.xml"
      );
      if (fs.existsSync(stringsPath)) {
        const xml = fs.readFileSync(stringsPath, "utf8");
        const updated = unsetRtlStrings(xml);
        if (updated !== xml) fs.writeFileSync(stringsPath, updated);
      }
      return cfg;
    },
  ]);
}

module.exports = withLocalizationForcesRtl;
