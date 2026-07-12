import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { createRequire } from "node:module";
import { describe, it } from "node:test";

const requireLib = createRequire(__filename);
const ROOT = path.join(__dirname, "../..");
const SAMPLE = path.join(ROOT, "samples/minimal-bdd");
const MCP_SERVER = path.join(ROOT, "scripts/pilot-mcp-server.js");
const {
  handleAnalyzeLog,
  handleDiscoverBdd,
  handleBuildFilter,
  handleFailureContext,
  MAX_ARTIFACT_BYTES,
} = requireLib("../../scripts/pilot-mcp-lib");

const PENDING_STEPS_LOG = [
  "Test run for /repo/bin/Debug/net8.0/App.dll",
  "Reqnroll.xUnit.ReqnrollPlugin.XUnitPendingStepException : Test pending: No matching step definition",
  "in Login.feature:line 12",
  "Failed!  - Failed:   6, Passed:     0, Skipped:     0, Total:     6",
].join("\n");

function writeTempInRoot(name: string, content: string): string {
  const file = path.join(ROOT, `.bdd-pilot-mcp-test-${Date.now()}-${Math.random().toString(36).slice(2)}${name}`);
  fs.writeFileSync(file, content, "utf8");
  return file;
}

describe("pilot-mcp-lib", () => {
  it("discovers minimal-bdd with smoke tag", () => {
    const result = handleDiscoverBdd({ projectDir: SAMPLE }, ROOT);
    assert.strictEqual(result.ok, true);
    assert.ok(result.structuredContent.featureCount >= 1);
    assert.ok(result.structuredContent.tags.some((entry: { tag: string }) => entry.tag === "smoke"));
  });

  it("builds Category=smoke filter", () => {
    const result = handleBuildFilter(
      { projectDir: SAMPLE, scope: "tag", tag: "smoke" },
      ROOT,
    );
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.structuredContent.filter, "Category=smoke");
  });

  it("analyzes pending-step log", () => {
    const logPath = writeTempInRoot(".log", PENDING_STEPS_LOG);
    try {
      const result = handleAnalyzeLog({ logPath }, ROOT);
      assert.strictEqual(result.ok, true);
      assert.strictEqual(result.structuredContent.primary, "PENDING_STEPS");
    } finally {
      fs.unlinkSync(logPath);
    }
  });

  it("returns failure context markdown for TRX+log", () => {
    const trx = writeTempInRoot(
      ".trx",
      `<?xml version="1.0" encoding="UTF-8"?>
<TestRun xmlns="http://microsoft.com/schemas/VisualStudio/TeamTest/2010">
  <Results>
    <UnitTestResult testName="SmokeFeature.SystemIsReady" outcome="Failed">
      <Output><ErrorInfo><Message>Expected true but was false</Message></ErrorInfo></Output>
    </UnitTestResult>
  </Results>
</TestRun>`,
    );
    const log = writeTempInRoot(".log", PENDING_STEPS_LOG);
    try {
      const result = handleFailureContext(
        { projectDir: SAMPLE, trxPath: trx, logPath: log },
        ROOT,
      );
      assert.strictEqual(result.ok, true);
      assert.match(result.structuredContent.markdown, /## Run/);
      assert.strictEqual(result.structuredContent.primaryDiagnostic, "PENDING_STEPS");
    } finally {
      fs.unlinkSync(trx);
      fs.unlinkSync(log);
    }
  });

  it("rejects paths outside workspace root", () => {
    const outside = path.join(os.tmpdir(), `bdd-pilot-outside-${Date.now()}.log`);
    fs.writeFileSync(outside, PENDING_STEPS_LOG, "utf8");
    try {
      const result = handleAnalyzeLog({ logPath: outside }, ROOT);
      assert.strictEqual(result.ok, false);
      assert.strictEqual(result.isError, true);
      assert.match(result.message, /outside workspace root/);
    } finally {
      fs.unlinkSync(outside);
    }
  });

  it("redacts secrets from analyze output", () => {
    const logPath = writeTempInRoot(
      ".log",
      `${PENDING_STEPS_LOG}\npassword=super-secret-token`,
    );
    try {
      const result = handleAnalyzeLog({ logPath }, ROOT);
      assert.strictEqual(result.ok, true);
      const serialized = JSON.stringify(result.structuredContent);
      assert.ok(!serialized.includes("super-secret-token"));
    } finally {
      fs.unlinkSync(logPath);
    }
  });

  it("redacts secrets from failure context markdown", () => {
    const logPath = writeTempInRoot(
      ".log",
      `${PENDING_STEPS_LOG}\npassword=super-secret-token`,
    );
    try {
      const result = handleFailureContext({ projectDir: SAMPLE, logPath }, ROOT);
      assert.strictEqual(result.ok, true);
      assert.ok(!result.structuredContent.markdown.includes("super-secret-token"));
    } finally {
      fs.unlinkSync(logPath);
    }
  });

  it("rejects log files larger than 5 MB", () => {
    const logPath = writeTempInRoot(".log", "x");
    try {
      fs.truncateSync(logPath, MAX_ARTIFACT_BYTES + 1);
      const result = handleAnalyzeLog({ logPath }, ROOT);
      assert.strictEqual(result.ok, false);
      assert.match(result.message, /too large/);
    } finally {
      fs.unlinkSync(logPath);
    }
  });

  it("returns error for invalid scope", () => {
    const result = handleBuildFilter({ projectDir: SAMPLE, scope: "nope" }, ROOT);
    assert.strictEqual(result.ok, false);
  });
});

describe("pilot-mcp-server", () => {
  it("starts without immediate crash on stdio", async () => {
    const { spawn } = await import("node:child_process");
    const child = spawn(process.execPath, [MCP_SERVER], { cwd: ROOT, stdio: "pipe" });
    await new Promise((resolve) => setTimeout(resolve, 300));
    try {
      assert.strictEqual(child.exitCode, null);
      assert.strictEqual(child.killed, false);
    } finally {
      child.kill();
    }
  });
});
