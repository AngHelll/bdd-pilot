import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { describe, it } from "node:test";
import { discoverProjectCandidates } from "../core/config/projectLocator";
import {
  discoveryRoot,
  resolveExecutionTarget,
} from "../core/config/projectResolution";

function writeMinimalBddProject(dir: string, csprojName: string): string {
  fs.mkdirSync(path.join(dir, "Features"), { recursive: true });
  const csproj = path.join(dir, csprojName);
  fs.writeFileSync(csproj, "<Project Sdk='Microsoft.NET.Sdk'></Project>");
  fs.writeFileSync(
    path.join(dir, "Features", "Sample.feature"),
    "Feature: Sample\n  Scenario: ok\n    Then ok",
  );
  return csproj;
}

describe("resolveExecutionTarget", () => {
  it("returns csproj unchanged", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bdd-exec-csproj-"));
    const csproj = writeMinimalBddProject(dir, "Tests.csproj");
    const project = {
      projectDir: dir,
      testTarget: csproj,
      kind: "csproj" as const,
      label: "Tests.csproj",
    };
    assert.strictEqual(resolveExecutionTarget(project, [dir]).testTarget, csproj);
  });

  it("prefers single BDD csproj when stored target is solution", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bdd-exec-sln-"));
    const csproj = writeMinimalBddProject(dir, "BddTests.csproj");
    const slnx = path.join(dir, "App.slnx");
    fs.writeFileSync(slnx, "<Solution></Solution>");
    const stored = {
      projectDir: dir,
      testTarget: slnx,
      kind: "sln" as const,
      label: "App.slnx",
    };
    const execution = resolveExecutionTarget(stored, [dir]);
    assert.strictEqual(execution.kind, "csproj");
    assert.strictEqual(execution.testTarget, csproj);
  });

  it("keeps solution when no BDD csproj candidates exist", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bdd-exec-no-feat-"));
    const slnx = path.join(dir, "App.slnx");
    fs.writeFileSync(slnx, "<Solution></Solution>");
    const stored = {
      projectDir: dir,
      testTarget: slnx,
      kind: "sln" as const,
      label: "App.slnx",
    };
    assert.strictEqual(resolveExecutionTarget(stored, [dir]).testTarget, slnx);
  });

  it("keeps solution when multiple BDD csproj candidates exist", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "bdd-exec-multi-"));
    const slnx = path.join(root, "App.slnx");
    fs.writeFileSync(slnx, "<Solution></Solution>");
    writeMinimalBddProject(path.join(root, "A"), "A.csproj");
    writeMinimalBddProject(path.join(root, "B"), "B.csproj");
    assert.strictEqual(discoverProjectCandidates([root]).length, 2);
    const stored = {
      projectDir: root,
      testTarget: slnx,
      kind: "sln" as const,
      label: "App.slnx",
    };
    assert.strictEqual(resolveExecutionTarget(stored, [root]).testTarget, slnx);
  });

  it("does not alter discoveryRoot when execution resolves to csproj", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bdd-exec-disc-"));
    writeMinimalBddProject(dir, "BddTests.csproj");
    const slnx = path.join(dir, "App.slnx");
    fs.writeFileSync(slnx, "<Solution></Solution>");
    const stored = {
      projectDir: dir,
      testTarget: slnx,
      kind: "sln" as const,
      label: "App.slnx",
    };
    assert.strictEqual(discoveryRoot(stored, [dir]), dir);
    assert.notStrictEqual(resolveExecutionTarget(stored, [dir]).testTarget, slnx);
  });
});
