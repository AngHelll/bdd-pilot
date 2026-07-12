// Headless CLI for BDD Pilot core utilities (agents / CI).
// Requires out-test/: auto-compiled via ensureOutTest() when missing.
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const OUT_TEST_MARKER = path.join(ROOT, "out-test/core/diagnostics/analyzer.js");

const USAGE = [
  "Usage:",
  "  npm run pilot -- analyze <log-file>",
  "  npm run pilot -- discover <project-dir>",
  "  npm run pilot -- build-filter <project-dir> (--tag <name> | --feature <path> [--scenario <name>] | --all)",
  "  npm run pilot -- failure-context --project-dir <dir> (--trx <path> | --log <path> | both) [--max-output-lines <n>]",
].join("\n");

function usageError(message) {
  if (message) {
    console.error(message);
  }
  console.error(USAGE);
  process.exit(2);
}

function fatalError(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

function ensureOutTest() {
  if (fs.existsSync(OUT_TEST_MARKER)) {
    return;
  }
  try {
    execSync("npx tsc -p tsconfig.test.json", { cwd: ROOT, stdio: "pipe" });
  } catch (err) {
    const detail = err.stderr?.toString()?.trim() || err.message;
    fatalError(`failed to compile out-test/: ${detail}`);
  }
  if (!fs.existsSync(OUT_TEST_MARKER)) {
    fatalError("out-test/ still missing after compile");
  }
}

function emitJson(payload) {
  console.log(JSON.stringify(payload));
}

function resolveExistingPath(rawPath, label) {
  const resolved = path.resolve(rawPath);
  if (!fs.existsSync(resolved)) {
    console.error(`error: ${label} not found: ${resolved}`);
    process.exit(2);
  }
  return resolved;
}

function resolveExistingDir(rawPath) {
  const resolved = path.resolve(rawPath);
  if (!fs.existsSync(resolved)) {
    console.error(`error: directory not found: ${resolved}`);
    process.exit(2);
  }
  if (!fs.statSync(resolved).isDirectory()) {
    console.error(`error: not a directory: ${resolved}`);
    process.exit(2);
  }
  return resolved;
}

function serializeDiagnostics(diagnostics) {
  ensureOutTest();
  const { sanitize } = require("../out-test/security/sanitizer");
  return diagnostics.map((d) => {
    const item = {
      code: d.code,
      severity: d.severity,
      title: sanitize(d.title),
      hint: sanitize(d.hint),
    };
    if (d.detail !== undefined) {
      item.detail = sanitize(d.detail);
    }
    return item;
  });
}

function runAnalyze(logPath) {
  ensureOutTest();
  const resolved = resolveExistingPath(logPath, "file");

  let text;
  try {
    text = fs.readFileSync(resolved, "utf8");
  } catch (err) {
    console.error(`error: cannot read ${resolved}: ${err.message}`);
    process.exit(2);
  }

  const { analyzeDotnetOutput } = require("../out-test/core/diagnostics/analyzer");
  const diagnostics = serializeDiagnostics(analyzeDotnetOutput(text));
  emitJson({
    diagnostics,
    primary: diagnostics.length > 0 ? diagnostics[0].code : null,
  });
}

function runDiscover(projectDir) {
  ensureOutTest();
  resolveExistingDir(projectDir);
  const { buildCliDiscoverReport } = require("../out-test/core/gherkin/cliDiscoverReport");
  emitJson(buildCliDiscoverReport(projectDir));
}

function parseBuildFilterArgs(args) {
  const projectDir = args[0];
  if (!projectDir) {
    usageError("Missing project directory.");
  }

  let tag;
  let feature;
  let scenario;
  let all = false;

  for (let i = 1; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--all") {
      all = true;
      continue;
    }
    if (arg === "--tag") {
      tag = args[++i];
      if (!tag) {
        usageError("Missing value for --tag.");
      }
      continue;
    }
    if (arg === "--feature") {
      feature = args[++i];
      if (!feature) {
        usageError("Missing value for --feature.");
      }
      continue;
    }
    if (arg === "--scenario") {
      scenario = args[++i];
      if (!scenario) {
        usageError("Missing value for --scenario.");
      }
      continue;
    }
    usageError(`Unknown build-filter argument: ${arg}`);
  }

  const scopeCount = [all, !!tag, !!feature].filter(Boolean).length;
  if (scopeCount === 0) {
    usageError("Specify one scope: --tag, --feature, or --all.");
  }
  if (scopeCount > 1) {
    usageError("Scope flags are mutually exclusive.");
  }
  if (scenario && !feature) {
    usageError("--scenario requires --feature.");
  }

  return { projectDir, tag, feature, scenario, all };
}

function runBuildFilter(args) {
  ensureOutTest();
  const parsed = parseBuildFilterArgs(args);
  resolveExistingDir(parsed.projectDir);

  const { resolveCliFilterTarget, CliFilterNotFoundError } = require("../out-test/core/runner/cliFilterTarget");
  const { buildFilter } = require("../out-test/core/runner/filterBuilder");
  const { DEFAULT_FILTER_MAPPING } = require("../out-test/core/runner/filterMapping");

  let opts;
  if (parsed.all) {
    opts = { kind: "all" };
  } else if (parsed.tag) {
    opts = { kind: "tag", tag: parsed.tag };
  } else {
    opts = { kind: "feature", featurePath: parsed.feature, scenarioName: parsed.scenario };
  }

  let resolved;
  try {
    resolved = resolveCliFilterTarget(parsed.projectDir, opts);
  } catch (err) {
    if (err instanceof CliFilterNotFoundError) {
      console.error(`error: ${err.message}`);
      process.exit(2);
    }
    throw err;
  }

  const filter = buildFilter(resolved.target, DEFAULT_FILTER_MAPPING) ?? null;
  emitJson({
    filter,
    scopeLabel: resolved.scopeLabel,
    mapping: { ...DEFAULT_FILTER_MAPPING },
    warnings: [],
  });
}

function parseFailureContextArgs(args) {
  let projectDir;
  let trxPath;
  let logPath;
  let maxOutputLines = 80;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--project-dir") {
      projectDir = args[++i];
      if (!projectDir) {
        usageError("Missing value for --project-dir.");
      }
      continue;
    }
    if (arg === "--trx") {
      trxPath = args[++i];
      if (!trxPath) {
        usageError("Missing value for --trx.");
      }
      continue;
    }
    if (arg === "--log") {
      logPath = args[++i];
      if (!logPath) {
        usageError("Missing value for --log.");
      }
      continue;
    }
    if (arg === "--max-output-lines") {
      const raw = args[++i];
      if (!raw) {
        usageError("Missing value for --max-output-lines.");
      }
      maxOutputLines = Number(raw);
      if (!Number.isFinite(maxOutputLines) || maxOutputLines < 0) {
        usageError("Invalid --max-output-lines value.");
      }
      continue;
    }
    usageError(`Unknown failure-context argument: ${arg}`);
  }

  if (!projectDir) {
    usageError("Missing --project-dir.");
  }
  if (!trxPath && !logPath) {
    usageError("At least one of --trx or --log is required.");
  }

  return { projectDir, trxPath, logPath, maxOutputLines };
}

function runFailureContext(args) {
  ensureOutTest();
  const parsed = parseFailureContextArgs(args);
  resolveExistingDir(parsed.projectDir);

  if (parsed.trxPath) {
    resolveExistingPath(parsed.trxPath, "trx file");
  }
  if (parsed.logPath) {
    resolveExistingPath(parsed.logPath, "log file");
  }

  const {
    buildFailureSnapshotFromArtifacts,
    NoFailureContextError,
  } = require("../out-test/core/diagnostics/failureSnapshotFromArtifacts");
  const { buildAiFailureContext } = require("../out-test/core/diagnostics/aiFailureContext");
  const { analyzeDotnetOutput } = require("../out-test/core/diagnostics/analyzer");

  let snapshot;
  try {
    snapshot = buildFailureSnapshotFromArtifacts({
      projectDir: parsed.projectDir,
      trxPath: parsed.trxPath,
      logPath: parsed.logPath,
    });
  } catch (err) {
    if (err instanceof NoFailureContextError) {
      console.error("error: no failure context");
      process.exit(2);
    }
    throw err;
  }

  const markdown = buildAiFailureContext(snapshot, { maxOutputLines: parsed.maxOutputLines });
  const diagnostics = analyzeDotnetOutput(snapshot.outputForAnalysis);
  emitJson({
    markdown,
    summary: {
      passed: snapshot.summary.passed,
      failed: snapshot.summary.failed,
      skipped: snapshot.summary.skipped,
      total: snapshot.summary.total,
    },
    primaryDiagnostic: diagnostics.length > 0 ? diagnostics[0].code : null,
  });
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    usageError();
  }

  const subcommand = args[0];
  const rest = args.slice(1);

  switch (subcommand) {
    case "analyze": {
      const logPath = rest[0];
      if (!logPath) {
        usageError("Missing log file path.");
      }
      runAnalyze(logPath);
      break;
    }
    case "discover": {
      const projectDir = rest[0];
      if (!projectDir) {
        usageError("Missing project directory.");
      }
      runDiscover(projectDir);
      break;
    }
    case "build-filter":
      runBuildFilter(rest);
      break;
    case "failure-context":
      runFailureContext(rest);
      break;
    default:
      usageError(`Unknown subcommand: ${subcommand}`);
  }
}

try {
  main();
} catch (err) {
  fatalError(err instanceof Error ? err.message : String(err));
}
