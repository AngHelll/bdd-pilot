// Headless CLI for BDD Pilot core utilities (agents / CI).
// Requires out-test/: run `npm run test:unit` or `tsc -p tsconfig.test.json` first.
const fs = require("fs");
const path = require("path");

const USAGE = "Usage: npm run pilot -- analyze <log-file>";

function usageError(message) {
  if (message) {
    console.error(message);
  }
  console.error(USAGE);
  process.exit(2);
}

function serializeDiagnostics(diagnostics) {
  return diagnostics.map((d) => {
    const item = {
      code: d.code,
      severity: d.severity,
      title: d.title,
      hint: d.hint,
    };
    if (d.detail !== undefined) {
      item.detail = d.detail;
    }
    return item;
  });
}

function runAnalyze(logPath) {
  const analyzerPath = path.join(__dirname, "../out-test/core/diagnostics/analyzer.js");
  if (!fs.existsSync(analyzerPath)) {
    console.error(
      "error: out-test/ not found. Run `npm run test:unit` or `tsc -p tsconfig.test.json` first.",
    );
    process.exit(1);
  }

  if (!fs.existsSync(logPath)) {
    console.error(`error: file not found: ${logPath}`);
    process.exit(2);
  }

  let text;
  try {
    text = fs.readFileSync(logPath, "utf8");
  } catch (err) {
    console.error(`error: cannot read ${logPath}: ${err.message}`);
    process.exit(2);
  }

  const { analyzeDotnetOutput } = require("../out-test/core/diagnostics/analyzer");
  const diagnostics = serializeDiagnostics(analyzeDotnetOutput(text));
  const payload = {
    diagnostics,
    primary: diagnostics.length > 0 ? diagnostics[0].code : null,
  };
  console.log(JSON.stringify(payload));
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    usageError();
  }

  const subcommand = args[0];
  if (subcommand !== "analyze") {
    usageError(`Unknown subcommand: ${subcommand}`);
  }

  const logPath = args[1];
  if (!logPath) {
    usageError("Missing log file path.");
  }

  runAnalyze(logPath);
}

try {
  main();
} catch (err) {
  console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
