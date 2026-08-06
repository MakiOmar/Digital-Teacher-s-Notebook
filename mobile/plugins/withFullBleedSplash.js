const {
  withMainActivity,
  withAndroidStyles,
  withDangerousMod,
} = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const SPLASH_FULL_XML = `<?xml version="1.0" encoding="utf-8"?>
<!--
  White splash with the home wordmark so native boot frames match JS.
-->
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
  <item android:drawable="@color/splashscreen_background" />
  <item
    android:width="260dp"
    android:height="260dp"
    android:gravity="center">
    <bitmap
      android:gravity="fill"
      android:src="@drawable/splashscreen_logo" />
  </item>
</layer-list>
`;

/**
 * Android splash / theme:
 * - Skip AndroidX SplashScreen (API 31+ centered icon)
 * - Splash + app window: white + home wordmark drawable (matches JS SplashBackground)
 */
function withFullBleedSplash(config) {
  config = withAndroidStyles(config, (cfg) => {
    const styles = cfg.modResults;
    const styleList = styles.resources.style ?? [];

    const appThemeItems = [
      {
        $: { name: "android:editTextBackground" },
        _: "@drawable/rn_edit_text_material",
      },
      { $: { name: "colorPrimary" }, _: "@color/colorPrimary" },
      {
        $: { name: "android:statusBarColor" },
        _: "@android:color/transparent",
      },
      {
        $: { name: "android:navigationBarColor" },
        _: "@android:color/transparent",
      },
      {
        $: { name: "android:windowBackground" },
        _: "@drawable/splashscreen_full",
      },
    ];

    const splashThemeItems = [
      {
        $: { name: "android:windowBackground" },
        _: "@drawable/splashscreen_full",
      },
      {
        $: { name: "android:statusBarColor" },
        _: "@android:color/transparent",
      },
      {
        $: { name: "android:navigationBarColor" },
        _: "@android:color/transparent",
      },
      { $: { name: "android:windowNoTitle" }, _: "true" },
    ];

    const without = styleList.filter(
      (s) =>
        s.$?.name !== "AppTheme" && s.$?.name !== "Theme.App.SplashScreen"
    );

    styles.resources.style = [
      ...without,
      {
        $: {
          name: "AppTheme",
          parent: "Theme.AppCompat.DayNight.NoActionBar",
        },
        item: appThemeItems,
      },
      {
        $: {
          name: "Theme.App.SplashScreen",
          parent: "Theme.AppCompat.DayNight.NoActionBar",
        },
        item: splashThemeItems,
      },
    ];

    return cfg;
  });

  config = withDangerousMod(config, [
    "android",
    async (cfg) => {
      const drawableDir = path.join(
        cfg.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "res",
        "drawable"
      );
      fs.mkdirSync(drawableDir, { recursive: true });
      fs.writeFileSync(
        path.join(drawableDir, "splashscreen_full.xml"),
        SPLASH_FULL_XML,
        "utf8"
      );
      return cfg;
    },
  ]);

  config = withMainActivity(config, (cfg) => {
    let src = cfg.modResults.contents;

    src = src.replace(
      /import\s+expo\.modules\.splashscreen\.SplashScreenManager\s*\n?/g,
      ""
    );
    src = src.replace(
      /\/\/ @generated begin expo-splashscreen[\s\S]*?\/\/ @generated end expo-splashscreen\s*/g,
      ""
    );
    src = src.replace(
      /SplashScreenManager\.registerOnActivity\(this\)\s*/g,
      ""
    );

    if (!src.includes("setTheme(R.style.AppTheme)")) {
      src = src.replace(
        /override fun onCreate\(savedInstanceState: Bundle\?\) \{\s*/,
        `override fun onCreate(savedInstanceState: Bundle?) {
    // Wordmark window background; JS SplashBackground uses the same mark.
    setTheme(R.style.AppTheme)
    `
      );
    }

    cfg.modResults.contents = src;
    return cfg;
  });

  return config;
}

module.exports = withFullBleedSplash;
