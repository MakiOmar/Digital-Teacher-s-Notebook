/**
 * Build Google Play Feature Graphic at exact 1024×500 (cover crop, no letterbox).
 */
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const W = 1024;
const H = 500;
const src =
  "C:/Users/mo7am/.cursor/projects/e-tutoring-manager/assets/play-feature-graphic-wide.png";
const outDir = __dirname;
const outPng = path.join(outDir, "google-play-feature-graphic.png");
const outJpg = path.join(outDir, "google-play-feature-graphic.jpg");

(async () => {
  const meta = await sharp(src).metadata();
  const sw = meta.width;
  const sh = meta.height;
  const targetRatio = W / H;

  // Extract the widest centered band that matches 1024:500, then scale.
  let left = 0;
  let top = 0;
  let width = sw;
  let height = sh;
  const srcRatio = sw / sh;
  if (srcRatio > targetRatio) {
    // Source too wide — crop sides
    width = Math.round(sh * targetRatio);
    left = Math.round((sw - width) / 2);
  } else {
    // Source too tall — crop top/bottom (our case)
    height = Math.round(sw / targetRatio);
    top = Math.round((sh - height) / 2);
  }

  await sharp(src)
    .extract({ left, top, width, height })
    .resize(W, H, { fit: "fill" })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outPng);

  await sharp(outPng)
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(outJpg);

  for (const p of [outPng, outJpg]) {
    const m = await sharp(p).metadata();
    const st = fs.statSync(p);
    console.log(
      path.basename(p),
      `${m.width}x${m.height}`,
      `${(st.size / 1024).toFixed(1)} KB`
    );
  }
  console.log("crop window", { left, top, width, height });
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
