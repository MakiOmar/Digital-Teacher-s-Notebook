/** Convert assets/icons/*.png → 128px .webp (skip if webp already newer). */
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const outDir = path.join(__dirname, "../assets/icons");

(async () => {
  for (const f of fs.readdirSync(outDir).filter((x) => x.endsWith(".png"))) {
    const src = path.join(outDir, f);
    const dest = path.join(outDir, f.replace(/\.png$/i, ".webp"));
    if (fs.existsSync(dest) && fs.statSync(dest).size > 200) {
      console.log("keep", path.basename(dest));
      continue;
    }
    const tmp = dest + ".tmp";
    await sharp(src)
      .resize(128, 128, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 86, alphaQuality: 100 })
      .toFile(tmp);
    fs.renameSync(tmp, dest);
    console.log(
      "wrote",
      path.basename(dest),
      fs.statSync(dest).size,
      "←",
      fs.statSync(src).size
    );
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
