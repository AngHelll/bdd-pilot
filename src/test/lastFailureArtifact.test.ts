import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { describe, it } from "node:test";
import {
  buildLastFailureArtifact,
  clearLastFailureArtifact,
  computeMaxFailureLogBytes,
  LAST_FAILURE_ARTIFACT_REL,
  readLastFailureArtifact,
  resolveLastFailureArtifactPath,
  writeLastFailureArtifact,
} from "../core/diagnostics/lastFailureArtifact";
import { LastRunSnapshot } from "../core/diagnostics/aiFailureContext";

function makeSnapshot(overrides: Partial<LastRunSnapshot> = {}): LastRunSnapshot {
  return {
    timestamp: Date.now(),
    stage: "dev",
    mode: "parallel",
    scopeLabels: ["@smoke (tag)"],
    projectDir: "/tmp/project",
    exitCode: 1,
    summary: { passed: 1, failed: 1, skipped: 0, total: 2 },
    outputForAnalysis: "Failed! password=secret-token\n",
    failedScenarios: [],
    evidence: [],
    trxPath: "TestResults/run.trx",
    ...overrides,
  };
}

describe("lastFailureArtifact", () => {
  it("builds schema v1 with relative projectDir under workspace root", () => {
    const artifact = buildLastFailureArtifact({
      snapshot: makeSnapshot({ projectDir: "/ws/samples/minimal-bdd" }),
      workspaceRoot: "/ws",
      logPath: "/ws/samples/minimal-bdd/TestResults/bdd-pilot-last-run.log",
    });
    assert.strictEqual(artifact.version, 1);
    assert.strictEqual(artifact.projectDir, "samples/minimal-bdd");
    assert.strictEqual(artifact.trxPath, "TestResults/run.trx");
    assert.strictEqual(artifact.logPath, "TestResults/bdd-pilot-last-run.log");
  });

  it("sanitizes filter and log output on write", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "bdd-pilot-artifact-"));
    try {
      const projectDir = path.join(root, "proj");
      fs.mkdirSync(projectDir, { recursive: true });
      const result = writeLastFailureArtifact({
        snapshot: makeSnapshot({
          projectDir,
          filter: "password=abc",
          outputForAnalysis: "line\npassword=super-secret\n",
        }),
      });
      assert.strictEqual(result.written, true);
      const artifact = readLastFailureArtifact(projectDir);
      assert.ok(artifact);
      assert.ok(artifact.filter?.includes("***REDACTED***"));
      assert.ok(!artifact.filter?.includes("abc"));
      const logText = fs.readFileSync(result.logPath!, "utf8");
      assert.ok(!logText.includes("super-secret"));
      assert.ok(logText.includes("***REDACTED***"));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("clears artifact and log on all-pass", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "bdd-pilot-artifact-"));
    try {
      const projectDir = path.join(root, "proj");
      fs.mkdirSync(projectDir, { recursive: true });
      writeLastFailureArtifact({
        snapshot: makeSnapshot({ projectDir, outputForAnalysis: "fail" }),
      });
      assert.ok(fs.existsSync(resolveLastFailureArtifactPath(projectDir)));
      clearLastFailureArtifact(projectDir);
      assert.ok(!fs.existsSync(resolveLastFailureArtifactPath(projectDir)));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("caps log bytes via computeMaxFailureLogBytes", () => {
    assert.strictEqual(computeMaxFailureLogBytes(80), 16000);
    assert.strictEqual(computeMaxFailureLogBytes(5000), 512 * 1024);
  });

  it("returns undefined for invalid artifact json", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "bdd-pilot-artifact-"));
    try {
      const projectDir = path.join(root, "proj");
      const artifactPath = path.join(projectDir, LAST_FAILURE_ARTIFACT_REL);
      fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
      fs.writeFileSync(artifactPath, "{not-json", "utf8");
      assert.strictEqual(readLastFailureArtifact(projectDir), undefined);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
