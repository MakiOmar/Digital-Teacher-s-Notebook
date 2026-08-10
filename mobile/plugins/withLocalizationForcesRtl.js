const { withStringsXml } = require("expo/config-plugins");

/**
 * Keep Expo Localization from forcing RTL on every launch.
 * Preferred language (ar/en) controls I18nManager.forceRTL at runtime.
 */
function upsertString(resources, name, value) {
  if (!resources.string) resources.string = [];
  const list = Array.isArray(resources.string)
    ? resources.string
    : [resources.string];
  const existing = list.find((item) => item?.$?.name === name);
  if (existing) {
    existing._ = value;
    if (!existing.$) existing.$ = { name, translatable: "false" };
    else existing.$.translatable = "false";
  } else {
    list.push({
      $: { name, translatable: "false" },
      _: value,
    });
  }
  resources.string = list;
  return resources;
}

function withLocalizationForcesRtl(config) {
  return withStringsXml(config, (cfg) => {
    cfg.modResults.resources = upsertString(
      cfg.modResults.resources || {},
      "ExpoLocalization_forcesRTL",
      "false"
    );
    cfg.modResults.resources = upsertString(
      cfg.modResults.resources,
      "ExpoLocalization_supportsRTL",
      "true"
    );
    return cfg;
  });
}

module.exports = withLocalizationForcesRtl;
