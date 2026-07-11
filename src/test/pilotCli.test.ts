import * as assert from "assert";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, it } from "node:test";

const ROOT = path.join(__dirname, "../..");
const CLI = path.join(ROOT, "scripts/pilot-cli.js");

interface AnalyzeResult {
  diagnostics: Array<{ code: string; severity: string; title: string; detail?: string; hint: string }>;
  primary: string | null;
}

function runPilot(args: string[]): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [CLI, ...args], { cwd: ROOT, encoding: "utf8" });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function writeTempLog(content: string): string {
  const file = path.join(
    os.tmpdir(),
    `bdd-pilot-cli-${Date.now()}-${Math.random().toString(36).slice(2)}.log`,
  );
  fs.writeFileSync(file, content, "utf8");
  return file;
}

const PENDING_STEPS_LOG = [
  "Test run for /repo/bin/Debug/net8.0/App.dll",
  "Reqnroll.xUnit.ReqnrollPlugin.XUnitPendingStepException : Test pending: No matching step definition",
  "in Login.feature:line 12",
  "Failed!  - Failed:   6, Passed:     0, Skipped:     0, Total:     6",
].join("\n");

describe("pilot-cli analyze", () => {
  it("returns PENDING_STEPS as primary for pending step log", () => {
    const logPath = writeTempLog(PENDING_STEPS_LOG);
    try {
      const { status, stdout } = runPilot(["analyze", logPath]);
      assert.strictEqual(status, 0);

      const parsed = JSON.parse(stdout) as AnalyzeResult;
      assert.strictEqual(parsed.primary, "PENDING_STEPS");
      assert.ok(parsed.diagnostics.some((d) => d.code === "PENDING_STEPS"));
      const pending = parsed.diagnostics.find((d) => d.code === "PENDING_STEPS");
      assert.ok(pending);
      assert.strictEqual(pending!.severity, "error");
      assert.ok(pending!.title.length > 0);
      assert.ok(pending!.hint.length > 0);
      assert.match(pending!.detail ?? "", /Login\.feature/);
    } finally {
      fs.unlinkSync(logPath);
    }
  });

  it("returns empty diagnostics for log with no matches", () => {
    const logPath = writeTempLog("Passed!  - Failed: 0, Passed: 10, Skipped: 0, Total: 10\n");
    try {
      const { status, stdout } = runPilot(["analyze", logPath]);
      assert.strictEqual(status, 0);

      const parsed = JSON.parse(stdout) as AnalyzeResult;
      assert.deepStrictEqual(parsed, { diagnostics: [], primary: null });
    } finally {
      fs.unlinkSync(logPath);
    }
  });

  it("exits 2 when log file argument is missing", () => {
    const { status, stderr } = runPilot(["analyze"]);
    assert.strictEqual(status, 2);
    assert.match(stderr, /Missing log file path/);
    assert.match(stderr, /npm run pilot -- analyze <log-file>/);
  });

  it("exits 2 when log file does not exist", () => {
    const missing = path.join(os.tmpdir(), "bdd-pilot-cli-missing.log");
    const { status, stderr } = runPilot(["analyze", missing]);
    assert.strictEqual(status, 2);
    assert.match(stderr, /file not found/);
    assert.match(stderr, new RegExp(missing.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });

  it("exits 2 for unknown subcommand", () => {
    const { status, stderr } = runPilot(["not-a-command"]);
    assert.strictEqual(status, 2);
    assert.match(stderr, /Unknown subcommand: not-a-command/);
  });
});

describe("pilot-cli discover", () => {
  it("returns JSON map for minimal-bdd with smoke tag", () => {
    const sampleDir = path.join(ROOT, "samples/minimal-bdd");
    const { status, stdout } = runPilot(["discover", sampleDir]);
    assert.strictEqual(status, 0);

    const parsed = JSON.parse(stdout) as {
      featureCount: number;
      tags: Array<{ tag: string; scenarioCount: number }>;
      domains: Array<{ features: Array<{ name: string }> }>;
    };
    assert.ok(parsed.featureCount >= 1);
    assert.ok(parsed.tags.some((entry) => entry.tag === "smoke"));
    const smokeFeature = parsed.domains.flatMap((d) => d.features).find((f) => f.name === "Smoke");
    assert.ok(smokeFeature);
  });

  it("exits 2 when project directory is missing", () => {
    const { status, stderr } = runPilot(["discover"]);
    assert.strictEqual(status, 2);
    assert.match(stderr, /Missing project directory/);
  });
});

describe("pilot-cli build-filter", () => {
  it("returns Category=smoke for --tag smoke", () => {
    const sampleDir = path.join(ROOT, "samples/minimal-bdd");
    const { status, stdout } = runPilot(["build-filter", sampleDir, "--tag", "smoke"]);
    assert.strictEqual(status, 0);

    const parsed = JSON.parse(stdout) as { filter: string; scopeLabel: string };
    assert.strictEqual(parsed.filter, "Category=smoke");
    assert.strictEqual(parsed.scopeLabel, "@smoke (tag)");
  });

  it("returns null filter for --all", () => {
    const sampleDir = path.join(ROOT, "samples/minimal-bdd");
    const { status, stdout } = runPilot(["build-filter", sampleDir, "--all"]);
    assert.strictEqual(status, 0);

    const parsed = JSON.parse(stdout) as { filter: string | null };
    assert.strictEqual(parsed.filter, null);
  });

  it("exits 2 when scope flags are missing", () => {
    const sampleDir = path.join(ROOT, "samples/minimal-bdd");
    const { status, stderr } = runPilot(["build-filter", sampleDir]);
    assert.strictEqual(status, 2);
    assert.match(stderr, /Specify one scope/);
  });
});

describe("pilot-cli failure-context", () => {
  it("returns markdown JSON for TRX+log fixture", () => {
    const trx = writeTempLog(`<?xml version="1.0" encoding="UTF-8"?>
<TestRun xmlns="http://microsoft.com/schemas/VisualStudio/TeamTest/2010">
  <Results>
    <UnitTestResult testName="SmokeFeature.SystemIsReady" outcome="Failed">
      <Output><ErrorInfo><Message>Expected true but was false</Message></ErrorInfo></Output>
    </UnitTestResult>
  </Results>
</TestRun>`);
    const log = writeTempLog(PENDING_STEPS_LOG);
    const sampleDir = path.join(ROOT, "samples/minimal-bdd");
    try {
      const { status, stdout } = runPilot([
        "failure-context",
        "--project-dir",
        sampleDir,
        "--trx",
        trx,
        "--log",
        log,
      ]);
      assert.strictEqual(status, 0);

      const parsed = JSON.parse(stdout) as {
        markdown: string;
        summary: { failed: number };
        primaryDiagnostic: string | null;
      };
      assert.match(parsed.markdown, /## Run/);
      assert.ok(parsed.summary.failed >= 1);
      assert.strictEqual(parsed.primaryDiagnostic, "PENDING_STEPS");
    } finally {
      fs.unlinkSync(trx);
      fs.unlinkSync(log);
    }
  });

  it("exits 2 when no failure context is available", () => {
    const trx = writeTempLog(`<?xml version="1.0" encoding="UTF-8"?>
<TestRun xmlns="http://microsoft.com/schemas/VisualStudio/TeamTest/2010">
  <Results>
    <UnitTestResult testName="SmokeFeature.SystemIsReady" outcome="Passed" />
  </Results>
</TestRun>`);
    const sampleDir = path.join(ROOT, "samples/minimal-bdd");
    try {
      const { status, stderr } = runPilot([
        "failure-context",
        "--project-dir",
        sampleDir,
        "--trx",
        trx,
      ]);
      assert.strictEqual(status, 2);
      assert.match(stderr, /no failure context/);
    } finally {
      fs.unlinkSync(trx);
    }
  });
});
