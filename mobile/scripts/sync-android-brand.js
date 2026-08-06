/**
 * Refresh Android launcher mipmaps + native splash from JS assets.
 * Run from mobile/: node scripts/sync-android-brand.js
 */
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const res = path.join(root, "android/app/src/main/res");

const densities = [
  { dir: "mipmap-mdpi", icon: 48, fg: 108, splash: 200 },
  { dir: "mipmap-hdpi", icon: 72, fg: 162, splash: 300 },
  { dir: "mipmap-xhdpi", icon: 96, fg: 216, splash: 400 },
  { dir: "mipmap-xxhdpi", icon: 144, fg: 324, splash: 600 },
  { dir: "mipmap-xxxhdpi", icon: 192, fg: 432, splash: 800 },
];

async function main() {
  const icon = path.join(root, "assets/images/icon.png");
  const fgSrc = path.join(root, "assets/images/android-icon-foreground.png");
  const bgSrc = path.join(root, "assets/images/android-icon-background.png");
  const splash = path.join(root, "assets/images/splash-logo.png");
  const mono = path.join(root, "assets/images/android-icon-monochrome.png");

  for (const d of densities) {
    const dir = path.join(res, d.dir);
    fs.mkdirSync(dir, { recursive: true });

    await sharp(icon).resize(d.icon, d.icon).webp({ quality: 92 }).toFile(path.join(dir, "ic_launcher.webp"));
    await sharp(icon).resize(d.icon, d.icon).webp({ quality: 92 }).toFile(path.join(dir, "ic_launcher_round.webp"));
    await sharp(fgSrc).resize(d.fg, d.fg).webp({ quality: 92 }).toFile(path.join(dir, "ic_launcher_foreground.webp"));
    await sharp(bgSrc).resize(d.fg, d.fg).webp({ quality: 92 }).toFile(path.join(dir, "ic_launcher_background.webp"));
    if (fs.existsSync(mono)) {
      await sharp(mono).resize(d.fg, d.fg).webp({ quality: 92 }).toFile(path.join(dir, "ic_launcher_monochrome.webp"));
    }
    console.log("mipmap", d.dir);
  }

  // Drawable splash logos
  for (const d of densities) {
    const dir = path.join(res, d.dir.replace("mipmap", "drawable"));
    // also update known drawable-* folders
  }
  for (const [folder, w] of [
    ["drawable-mdpi", 200],
    ["drawable-hdpi", 300],
    ["drawable-xhdpi", 400],
    ["drawable-xxhdpi", 600],
    ["drawable-xxxhdpi", 800],
    ["drawable-nodpi", 560],
  ]) {
    const dir = path.join(res, folder);
    fs.mkdirSync(dir, { recursive: true });
    await sharp(splash).resize({ width: w, withoutEnlargement: true }).png().toFile(path.join(dir, "splashscreen_logo.png"));
  }

  // Keep strings.xml name in sync
  const name = "دفتر المعلم الرقمي";
  fs.writeFileSync(
    path.join(res, "values/strings.xml"),
    `<resources>\n  <string name="app_name">${name}</string>\n  <string name="expo_splash_screen_resize_mode" translatable="false">contain</string>\n</resources>\n`,
    "utf8"
  );

  // Sync logo.webp from transparent mark
  const mark = path.join(root, "assets/images/logo-mark.png");
  if (fs.existsSync(mark)) {
    await sharp(mark).webp({ quality: 95, alphaQuality: 100 }).toFile(path.join(root, "assets/images/logo.webp"));
  }

  console.log("done — rebuild APK to apply launcher/splash/name");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
