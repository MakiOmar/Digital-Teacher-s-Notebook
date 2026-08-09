/**
 * Verify the release AAB exists and is signed with the Play upload key (not debug).
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const aab = path.join(
  __dirname,
  "..",
  "android",
  "app",
  "build",
  "outputs",
  "bundle",
  "release",
  "app-release.aab"
);

if (!fs.existsSync(aab)) {
  console.error("Missing AAB:", aab);
  console.error("Run: npm run build:aab");
  process.exit(1);
}

const sizeMb = (fs.statSync(aab).size / (1024 * 1024)).toFixed(2);
console.log("AAB:", aab);
console.log("Size:", sizeMb, "MB");

const jarsigner = process.env.JARSIGNER || "jarsigner";
try {
  const out = execFileSync(
    jarsigner,
    ["-verify", "-verbose", "-certs", aab],
    { encoding: "utf8" }
  );
  if (!/jar verified/i.test(out)) {
    console.error(out);
    console.error("AAB signature verification failed");
    process.exit(1);
  }
  if (/CN=Android Debug/i.test(out)) {
    console.error("AAB is still signed with the DEBUG key — refusing Play upload");
    process.exit(1);
  }
  if (!/CN=Tutoring Manager Upload/i.test(out) && !/upload/i.test(out)) {
    console.warn("Warning: expected upload CN not found; inspect jarsigner output.");
  }
  console.log("Signature: OK (not debug)");
} catch (e) {
  console.error("jarsigner failed:", e.message);
  process.exit(1);
}
