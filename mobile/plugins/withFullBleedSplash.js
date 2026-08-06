const { withMainActivity, withAndroidStyles } = require("expo/config-plugins");

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
    // White app window with wordmark drawable; JS SplashBackground uses the same mark.
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
