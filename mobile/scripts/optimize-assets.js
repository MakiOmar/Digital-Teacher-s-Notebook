/* One-off: compress/resize bundled image assets for a smaller APK. */
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

async function writeIfSmaller(file, buf, label) {
  const before = fs.statSync(file).size;
  if (buf.length >= before) {
    console.log(`keep  ${(before / 1024).toFixed(1)}KB ${label}`);
    return false;
  }
  fs.writeFileSync(file, buf);
  console.log(
    `ok    ${(before / 1024).toFixed(1)}KB -> ${(buf.length / 1024).toFixed(1)}KB  ${label}`
  );
  return true;
}

async function pngIcon(rel, maxEdge) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) return;
  const meta = await sharp(file).metadata();
  const w = meta.width || 0;
  const h = meta.height || 0;
  let pipeline = sharp(file).ensureAlpha();
  if (maxEdge && Math.max(w, h) > maxEdge) {
    pipeline = pipeline.resize({
      width: w >= h ? maxEdge : undefined,
      height: h > w ? maxEdge : undefined,
      fit: "inside",
      withoutEnlargement: true,
    });
  }
  const buf = await pipeline
    .png({ compressionLevel: 9, palette: true, quality: 85, effort: 10 })
    .toBuffer();
  await writeIfSmaller(file, buf, `${rel} (${w}x${h})`);
}

async function toWebp(relPng, maxEdge, quality) {
  const png = path.join(root, relPng);
  if (!fs.existsSync(png)) return;
  const webpRel = relPng.replace(/\.png$/i, ".webp");
  const webp = path.join(root, webpRel);
  const meta = await sharp(png).metadata();
  const w = meta.width || 0;
  const h = meta.height || 0;
  let pipeline = sharp(png);
  if (maxEdge && Math.max(w, h) > maxEdge) {
    pipeline = pipeline.resize({
      width: w >= h ? maxEdge : undefined,
      height: h > w ? maxEdge : undefined,
      fit: "inside",
      withoutEnlargement: true,
    });
  }
  const buf = await pipeline.webp({ quality, effort: 6 }).toBuffer();
  fs.writeFileSync(webp, buf);
  const before = fs.statSync(png).size;
  console.log(
    `webp  ${(before / 1024).toFixed(1)}KB png -> ${(buf.length / 1024).toFixed(1)}KB ${webpRel}`
  );
}

(async () => {
  // Soft photo / wash backgrounds → WebP (require sites updated separately)
  await toWebp("assets/images/blueprint-bg.png", 1600, 68);
  await toWebp("assets/images/profile.png", 512, 78);
  await toWebp("assets/images/logo.png", 1024, 82);

  // Native + Expo splash wordmark (same art as Home logo.webp)
  if (fs.existsSync(path.join(root, "assets/images/logo.webp"))) {
    await sharp(path.join(root, "assets/images/logo.webp"))
      .png()
      .toFile(path.join(root, "assets/images/splash-logo.png"));
    console.log("wrote assets/images/splash-logo.png");
  }

  // Flat UI / launcher icons stay PNG (palette)
  for (const [rel, edge] of [
    ["assets/images/splash-icon.png", 512],
    ["assets/images/icon.png", 512],
    ["assets/images/android-icon-foreground.png", 512],
    ["assets/images/star.png", 128],
    ["assets/icons/icon-today.png", 192],
    ["assets/icons/icon-schedule.png", 192],
    ["assets/icons/icon-groups.png", 192],
    ["assets/icons/icon-students.png", 192],
    ["assets/icons/icon-payments.png", 192],
    ["assets/icons/icon-years.png", 192],
    ["assets/icons/icon-backup.png", 192],
    ["assets/icons/icon-more.png", 192],
  ]) {
    await pngIcon(rel, edge);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
