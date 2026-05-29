// End-to-end smoke run using the extension's real runner + TRX parser.
// Usage: node scripts/smoke-run.js <projectDir> <stage> <mode> <filter>
const fs = require("fs");
const { buildArgs, runDotnetTest } = require("../out-test/core/runner/dotnetTest");
const { MODE_PROFILES } = require("../out-test/core/config/types");
const { parseTrx } = require("../out-test/core/results/trxParser");
const { loadStageEnv } = require("../out-test/core/config/envFile");

async function main() {
  const [projectDir, stage = "test", mode = "debug", filter] = process.argv.slice(2);
  if (!projectDir) {
    console.error("Usage: node scripts/smoke-run.js <projectDir> <stage> <mode> <filter>");
    process.exit(1);
  }

  const loadedEnv = loadStageEnv(projectDir, stage);

  const req = {
    dotnetPath: "dotnet",
    projectDir,
    filter,
    stage,
    mode: MODE_PROFILES[mode],
    resultsDir: "TestResults",
    trxFileName: `bdd-pilot-smoke-${Date.now()}.trx`,
    extraEnv: loadedEnv.vars,
  };

  console.log("ARGS:", buildArgs(req).join(" "));
  console.log("STAGE:", stage, "| filter:", filter || "(none)");
  console.log(
    "ENV:",
    loadedEnv.loadedFiles.map((f) => f.split("/").pop()).join(", ") || "(none)",
    `(${Object.keys(loadedEnv.vars).length} vars, values hidden)`,
  );

  const controller = new AbortController();
  const result = await runDotnetTest(
    req,
    {
      onStart: (cmd) => console.log("[start]", cmd),
      onStdout: (c) => process.stdout.write(c),
      onStderr: (c) => process.stderr.write(c),
    },
    controller.signal,
  );

  console.log(`\n[exit] code=${result.exitCode} canceled=${result.canceled}`);
  console.log(`[trx] ${result.trxPath}`);
  if (fs.existsSync(result.trxPath)) {
    const summary = parseTrx(fs.readFileSync(result.trxPath, "utf8"));
    console.log(
      `[results] passed=${summary.passed} failed=${summary.failed} skipped=${summary.skipped} total=${summary.total}`,
    );
    for (const r of summary.results) {
      console.log(`   ${r.outcome.toUpperCase().padEnd(7)} ${r.testName} ${r.durationMs ?? "?"}ms`);
    }
  } else {
    console.log("[results] no TRX produced");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
