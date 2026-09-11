#!/usr/bin/env node
// Inline fast-xml-parser into dist/headless trxParser so the VSIX does not
// require() a missing node_modules package (vsce --no-dependencies).
const esbuild = require("esbuild");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DEFAULT_OUTFILE = path.join(ROOT, "dist/headless/core/results/trxParser.js");

async function bundleHeadlessTrxParser(outfile = DEFAULT_OUTFILE) {
  await esbuild.build({
    entryPoints: [path.join(ROOT, "src/core/results/trxParser.ts")],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile,
    logLevel: "warning",
  });
}

module.exports = { bundleHeadlessTrxParser, DEFAULT_OUTFILE };

if (require.main === module) {
  bundleHeadlessTrxParser(process.argv[2])
    .then(() => undefined)
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
