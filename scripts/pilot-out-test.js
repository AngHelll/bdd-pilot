// Resolve headless core output dir (out-test in repo dev, dist/headless in VSIX).
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

function getRepoRoot(fromDir) {
  if (process.env.BDD_PILOT_EXTENSION_PATH?.trim()) {
    return path.resolve(process.env.BDD_PILOT_EXTENSION_PATH.trim());
  }
  if (process.env.BDD_PILOT_REPO?.trim()) {
    return path.resolve(process.env.BDD_PILOT_REPO.trim());
  }
  return path.resolve(fromDir, "..");
}

function getOutTestDir(fromDir) {
  const fromEnv = process.env.BDD_PILOT_OUT_TEST?.trim();
  if (fromEnv) {
    return path.resolve(fromEnv);
  }
  return path.join(getRepoRoot(fromDir), "out-test");
}

function getOutTestMarker(fromDir) {
  return path.join(getOutTestDir(fromDir), "core/diagnostics/analyzer.js");
}

function isPackaged() {
  return !!process.env.BDD_PILOT_EXTENSION_PATH?.trim();
}

function requireOutTest(fromDir, modulePath) {
  return require(path.join(getOutTestDir(fromDir), modulePath));
}

function ensureOutTest(fromDir) {
  const marker = getOutTestMarker(fromDir);
  if (fs.existsSync(marker)) {
    return;
  }
  if (isPackaged()) {
    throw new Error(`headless bundle missing at ${getOutTestDir(fromDir)} (packaged extension)`);
  }
  const repoRoot = getRepoRoot(fromDir);
  execSync("npx tsc -p tsconfig.test.json", { cwd: repoRoot, stdio: "pipe" });
  if (!fs.existsSync(marker)) {
    throw new Error("out-test/ still missing after compile");
  }
}

module.exports = {
  getRepoRoot,
  getOutTestDir,
  getOutTestMarker,
  isPackaged,
  requireOutTest,
  ensureOutTest,
};
