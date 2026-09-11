#!/usr/bin/env node
// A4/A5: extract bdd-pilot.vsix to a temp dir outside the repo and parse a TRX
// fixture without resolving fast-xml-parser from the workspace node_modules.
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const VSIX = path.join(ROOT, "bdd-pilot.vsix");
const FIXTURE = path.join(ROOT, "src/test/fixtures/trx/minimal-failed.trx");

function fail(message) {
  console.error(`vsix-trx-smoke: ${message}`);
  process.exit(1);
}

function emptyNodeEnv() {
  const env = { ...process.env };
  delete env.NODE_PATH;
  env.NODE_PATH = "";
  return env;
}

function assertNoExternalXmlParser(trxParserJs) {
  const source = fs.readFileSync(trxParserJs, "utf8");
  if (/require\(['"]fast-xml-parser['"]\)/.test(source)) {
    fail(`packaged trxParser still require()s fast-xml-parser: ${trxParserJs}`);
  }
}

function extractVsix(extractRoot) {
  const unzip = spawnSync("unzip", ["-q", "-o", VSIX, "-d", extractRoot], {
    encoding: "utf8",
  });
  if (unzip.status !== 0) {
    fail(`unzip failed: ${unzip.stderr || unzip.stdout || `exit ${unzip.status}`}`);
  }
  const extensionDir = path.join(extractRoot, "extension");
  if (!fs.existsSync(extensionDir)) {
    fail(`VSIX extract missing extension/ under ${extractRoot}`);
  }
  return extensionDir;
}

function runIsolated(js, envExtra) {
  const result = spawnSync(process.execPath, ["-e", js], {
    encoding: "utf8",
    cwd: os.tmpdir(),
    env: { ...emptyNodeEnv(), ...envExtra },
  });
  return result;
}

function main() {
  if (!fs.existsSync(VSIX)) {
    fail(`bdd-pilot.vsix not found (run npm run package first)`);
  }
  if (!fs.existsSync(FIXTURE)) {
    fail(`missing fixture ${FIXTURE}`);
  }

  const trxXml = fs.readFileSync(FIXTURE, "utf8");
  const extractRoot = fs.mkdtempSync(path.join(os.tmpdir(), "bdd-pilot-vsix-trx-"));
  try {
    const extensionDir = extractVsix(extractRoot);
    const trxParserJs = path.join(extensionDir, "dist/headless/core/results/trxParser.js");
    const snapshotJs = path.join(
      extensionDir,
      "dist/headless/core/diagnostics/failureSnapshotFromArtifacts.js",
    );
    const cliJs = path.join(extensionDir, "dist/pilot-cli.js");

    if (!fs.existsSync(trxParserJs)) {
      fail(`missing packaged trxParser at ${trxParserJs}`);
    }
    assertNoExternalXmlParser(trxParserJs);

    const parseJs = `
      const fs = require("fs");
      const { parseTrx } = require(${JSON.stringify(trxParserJs)});
      const summary = parseTrx(fs.readFileSync(${JSON.stringify(FIXTURE)}, "utf8"));
      if (!summary || summary.failed < 1) {
        throw new Error("expected failed >= 1, got " + JSON.stringify(summary));
      }
      console.log(JSON.stringify({ failed: summary.failed, passed: summary.passed }));
    `;
    const parsed = runIsolated(parseJs);
    if (parsed.status !== 0) {
      fail(`A4 parseTrx failed: ${parsed.stderr || parsed.stdout}`);
    }

    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "bdd-pilot-vsix-proj-"));
    const trxCopy = path.join(projectDir, "minimal-failed.trx");
    fs.writeFileSync(trxCopy, trxXml, "utf8");

    const snapshotEval = `
      const { buildFailureSnapshotFromArtifacts } = require(${JSON.stringify(snapshotJs)});
      const snapshot = buildFailureSnapshotFromArtifacts({
        projectDir: ${JSON.stringify(projectDir)},
        trxPath: ${JSON.stringify(trxCopy)},
      });
      if (!snapshot || snapshot.summary.failed < 1) {
        throw new Error("expected snapshot.summary.failed >= 1");
      }
      console.log(JSON.stringify({ failed: snapshot.summary.failed }));
    `;
    const snapshotResult = runIsolated(snapshotEval);
    if (snapshotResult.status !== 0) {
      fail(`A5 snapshot failed: ${snapshotResult.stderr || snapshotResult.stdout}`);
    }

    if (!fs.existsSync(cliJs)) {
      fail(`missing packaged pilot-cli at ${cliJs}`);
    }
    const cli = spawnSync(
      process.execPath,
      [
        cliJs,
        "failure-context",
        "--project-dir",
        projectDir,
        "--trx",
        trxCopy,
      ],
      {
        encoding: "utf8",
        cwd: os.tmpdir(),
        env: {
          ...emptyNodeEnv(),
          BDD_PILOT_EXTENSION_PATH: extensionDir,
          BDD_PILOT_OUT_TEST: path.join(extensionDir, "dist/headless"),
          BDD_PILOT_WORKSPACE_ROOT: projectDir,
        },
      },
    );
    if (cli.status !== 0) {
      fail(`A5 failure-context CLI failed: ${cli.stderr || cli.stdout}`);
    }
    let payload;
    try {
      payload = JSON.parse(cli.stdout);
    } catch {
      fail(`A5 failure-context did not emit JSON: ${cli.stdout}`);
    }
    if (!payload?.summary || payload.summary.failed < 1) {
      fail(`A5 expected summary.failed >= 1, got ${cli.stdout}`);
    }
    if (typeof payload.markdown !== "string" || payload.markdown.length === 0) {
      fail("A5 expected markdown failure context");
    }

    console.log("vsix-trx-smoke OK:", parsed.stdout.trim(), payload.summary);
  } finally {
    fs.rmSync(extractRoot, { recursive: true, force: true });
  }
}

main();
