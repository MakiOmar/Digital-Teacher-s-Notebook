const {
  withMainActivity,
  withAndroidStyles,
  withDangerousMod,
  withAndroidManifest,
} = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

/** Soft mint → sky brand wash behind the full wordmark (matches JS SplashBackground). */
const SPLASH_GRADIENT_XML = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
  android:shape="rectangle">
  <gradient
    android:type="linear"
    android:angle="135"
    android:startColor="#DFF7F2"
    android:centerColor="#B5E2F0"
    android:endColor="#7ECAE6" />
</shape>
`;

/** Full wordmark centered on brand gradient — not the circular Android 12+ splash icon. */
const SPLASH_FULL_XML = `<?xml version="1.0" encoding="utf-8"?>
<!--
  Full-bleed splash wordmark (no circular Android 12 icon mask).
  Wider than tall so Arabic + English brand text stay visible.
  Includes a static progress track under the logo so Arabic cold-start
  still shows a loader before JS SplashBackground mounts.
-->
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
  <item android:drawable="@drawable/splashscreen_gradient" />
  <item
    android:width="320dp"
    android:height="200dp"
    android:gravity="center">
    <bitmap
      android:gravity="center"
      android:src="@drawable/splashscreen_logo" />
  </item>
  <!-- Track (high-contrast, just under wordmark — visible before JS mounts) -->
  <item
    android:width="180dp"
    android:height="14dp"
    android:gravity="center"
    android:top="118dp">
    <shape android:shape="rectangle">
      <solid android:color="#590F766E" />
      <corners android:radius="999dp" />
      <stroke
        android:width="2dp"
        android:color="#DE115E59" />
    </shape>
  </item>
  <!-- Thumb (left-biased static stand-in until JS sliding bar mounts) -->
  <item
    android:width="64dp"
    android:height="14dp"
    android:gravity="center"
    android:top="118dp"
    android:left="-52dp">
    <shape android:shape="rectangle">
      <solid android:color="#115E59" />
      <corners android:radius="999dp" />
    </shape>
  </item>
</layer-list>
`;

/** Invisible animated-icon placeholder if any Theme.SplashScreen remnant remains. */
const SPLASH_EMPTY_ICON_XML = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
  android:shape="rectangle">
  <size android:width="1dp" android:height="1dp" />
  <solid android:color="@android:color/transparent" />
</shape>
`;

const STYLES_XML = `<?xml version="1.0" encoding="utf-8"?>
<resources xmlns:tools="http://schemas.android.com/tools">
  <!--
    App + launch themes deliberately avoid Theme.SplashScreen so Android 12+
    does not clip the brand into a circle. Brand shows via windowBackground.
  -->
  <style name="AppTheme" parent="Theme.AppCompat.Light.NoActionBar">
    <item name="android:editTextBackground">@drawable/rn_edit_text_material</item>
    <item name="colorPrimary">@color/colorPrimary</item>
    <item name="android:statusBarColor">@android:color/transparent</item>
    <item name="android:navigationBarColor">@android:color/transparent</item>
    <item name="android:windowBackground">@drawable/splashscreen_full</item>
    <item name="android:colorBackground">@color/splashscreen_background</item>
    <item name="android:windowDisablePreview">true</item>
  </style>
  <style name="Theme.App.SplashScreen" parent="Theme.AppCompat.Light.NoActionBar">
    <item name="android:windowBackground">@drawable/splashscreen_full</item>
    <item name="android:colorBackground">@color/splashscreen_background</item>
    <item name="android:statusBarColor">@android:color/transparent</item>
    <item name="android:navigationBarColor">@android:color/transparent</item>
    <item name="android:windowNoTitle">true</item>
    <item name="android:windowDisablePreview">true</item>
  </style>
</resources>
`;

/**
 * Android splash / theme:
 * - Skip Android 12+ circular SplashScreen icon API
 * - windowDisablePreview skips the stuck system splash window
 * - AppTheme windowBackground shows the full wordmark until JS paints
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
      const resRoot = path.join(projectRoot, "app", "src", "main", "res");
      const drawableDir = path.join(resRoot, "drawable");
      const valuesDir = path.join(resRoot, "values");
      fs.mkdirSync(drawableDir, { recursive: true });
      fs.mkdirSync(valuesDir, { recursive: true });

      fs.writeFileSync(
        path.join(drawableDir, "splashscreen_gradient.xml"),
        SPLASH_GRADIENT_XML,
        "utf8"
      );
      fs.writeFileSync(
        path.join(drawableDir, "splashscreen_full.xml"),
        SPLASH_FULL_XML,
        "utf8"
      );
      fs.writeFileSync(
        path.join(drawableDir, "splashscreen_empty_icon.xml"),
        SPLASH_EMPTY_ICON_XML,
        "utf8"
      );
      // Keep solid fallback color aligned with mid-gradient (Expo / solid themes).
      const colorsPath = path.join(valuesDir, "colors.xml");
      if (fs.existsSync(colorsPath)) {
        let colorsXml = fs.readFileSync(colorsPath, "utf8");
        colorsXml = colorsXml.replace(
          /(<color name="splashscreen_background">)#[0-9A-Fa-f]{6,8}(<\/color>)/,
          "$1#B5E2F0$2"
        );
        fs.writeFileSync(colorsPath, colorsXml, "utf8");
      }
      // Last-write wins over expo-splash-screen Theme.SplashScreen circular icon.
      fs.writeFileSync(path.join(valuesDir, "styles.xml"), STYLES_XML, "utf8");

      // Remove Android 12+ override that may reintroduce circular splash icons.
      const v31 = path.join(resRoot, "values-v31", "styles.xml");
      if (fs.existsSync(v31)) {
        fs.unlinkSync(v31);
      }
      const v31Dir = path.join(resRoot, "values-v31");
      if (fs.existsSync(v31Dir) && fs.readdirSync(v31Dir).length === 0) {
        fs.rmdirSync(v31Dir);
      }

      return cfg;
    },
  ]);

  config = withMainActivity(config, (cfg) => {
    let src = cfg.modResults.contents;

    src = src.replace(
      /import\s+expo\.modules\.splashscreen\.SplashScreenManager\s*\n?/g,
      ""
    );
    // Strip Expo-generated splash registration block (reappears after prebuild).
    src = src.replace(
      /\/\/\s*@generated begin expo-splashscreen[\s\S]*?\/\/\s*@generated end expo-splashscreen\s*/g,
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
    // Full wordmark via windowBackground; avoid Android 12 circular splash icon.
    setTheme(R.style.AppTheme)
    `
      );
    }

    // Prefer keeping instance state (null wiped config changes on rotation).
    src = src.replace(
      /super\.onCreate\(null\)/,
      "super.onCreate(savedInstanceState)"
    );

    cfg.modResults.contents = src;
    return cfg;
  });

  return config;
}

module.exports = withFullBleedSplash;
