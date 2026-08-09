const {
  withMainActivity,
  withAndroidStyles,
  withDangerousMod,
  withAndroidManifest,
} = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const SPLASH_FULL_XML = `<?xml version="1.0" encoding="utf-8"?>
<!--
  White splash with the home wordmark so first frames match JS SplashBackground.
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
 * - Skip Android 12+ SplashScreenManager ownership (when Metro is slow it
 *   times out / leaves a black covering surface forever)
 * - windowDisablePreview skips the stuck system splash window
 * - AppTheme windowBackground shows the wordmark until JS paints
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
      {
        $: { name: "android:colorBackground" },
        _: "@color/splashscreen_background",
      },
      // Avoid black "preview" frames while the activity warms up
      { $: { name: "android:windowDisablePreview" }, _: "true" },
    ];

    const splashThemeItems = [
      {
        $: { name: "android:windowBackground" },
        _: "@drawable/splashscreen_full",
      },
      {
        $: { name: "android:colorBackground" },
        _: "@color/splashscreen_background",
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
      { $: { name: "android:windowDisablePreview" }, _: "true" },
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
          parent: "Theme.AppCompat.Light.NoActionBar",
        },
        item: appThemeItems,
      },
      {
        $: {
          name: "Theme.App.SplashScreen",
          parent: "Theme.AppCompat.Light.NoActionBar",
        },
        item: splashThemeItems,
      },
    ];

    return cfg;
  });

  config = withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    const activities = app?.activity ?? [];
    for (const activity of activities) {
      const name = activity.$?.["android:name"] ?? "";
      if (name.endsWith(".MainActivity") || name === "MainActivity") {
        activity.$["android:theme"] = "@style/Theme.App.SplashScreen";
      }
    }
    return cfg;
  });

  config = withDangerousMod(config, [
    "android",
    async (cfg) => {
      const projectRoot = cfg.modRequest.platformProjectRoot;
      const drawableDir = path.join(
        projectRoot,
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

      const appName = (
        cfg.name ||
        cfg.expo?.name ||
        "دفتر المعلم الرقمي"
      ).toString();
      const valuesDir = path.join(
        projectRoot,
        "app",
        "src",
        "main",
        "res",
        "values"
      );
      fs.mkdirSync(valuesDir, { recursive: true });
      fs.writeFileSync(
        path.join(valuesDir, "strings.xml"),
        `<resources>\n  <string name="app_name">${appName}</string>\n  <string name="expo_splash_screen_resize_mode" translatable="false">contain</string>\n</resources>\n`,
        "utf8"
      );
      return cfg;
    },
  ]);

  config = withMainActivity(config, (cfg) => {
    let src = cfg.modResults.contents;

    // Do NOT call SplashScreenManager.registerOnActivity — installSplashScreen
    // + OnPreDraw while Metro is cold leaves a timed-out black covering layer.
    src = src.replace(
      /import\s+expo\.modules\.splashscreen\.SplashScreenManager\s*\n?/g,
      ""
    );
    src = src.replace(
      /SplashScreenManager\.registerOnActivity\(this\)\s*/g,
      ""
    );
    src = src.replace(
      /\/\/\s*SplashScreenManager\.registerOnActivity\(this\)\s*/g,
      ""
    );

    if (!src.includes("setTheme(R.style.AppTheme)")) {
      src = src.replace(
        /override fun onCreate\(savedInstanceState: Bundle\?\) \{\s*/,
        `override fun onCreate(savedInstanceState: Bundle?) {
    // Wordmark windowBackground; JS SplashBackground covers until bootReady.
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
