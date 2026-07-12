#!/usr/bin/env node
const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");

async function main() {
  fs.mkdirSync(DIST, { recursive: true });

  for (const file of ["pilot-out-test.js", "pilot-cli.js", "pilot-mcp-lib.js"]) {
    fs.copyFileSync(path.join(__dirname, file), path.join(DIST, file));
  }

  await esbuild.build({
    entryPoints: [path.join(__dirname, "pilot-mcp-server.js")],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: path.join(DIST, "pilot-mcp.cjs"),
    external: [],
    logLevel: "info",
  });

  const headlessMarker = path.join(DIST, "headless/core/diagnostics/analyzer.js");
  if (!fs.existsSync(headlessMarker)) {
    throw new Error(`missing ${headlessMarker} — run build:headless first`);
  }
  if (!fs.existsSync(path.join(DIST, "pilot-mcp.cjs"))) {
    throw new Error("missing dist/pilot-mcp.cjs");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
