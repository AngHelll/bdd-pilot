import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { describe, it } from "node:test";
import {
  discoverProjectCandidates,
  resolveConfiguredPath,
} from "../core/config/projectLocator";
import {
  discoveryRoot,
  listSelectableProjects,
  resolveProject,
} from "../core/config/projectResolution";

describe("projectLocator", () => {
  it("resolves configured .csproj path", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bdd-pilot-proj-"));
    const csproj = path.join(dir, "Tests.csproj");
    fs.writeFileSync(csproj, "<Project Sdk='Microsoft.NET.Sdk'></Project>");
    const featureDir = path.join(dir, "Features");
    fs.mkdirSync(featureDir);
    fs.writeFileSync(path.join(featureDir, "Sample.feature"), "Feature: S\n  Scenario: ok\n    Then ok");

    const resolved = resolveConfiguredPath([dir], csproj);
    assert.ok(resolved);
    assert.strictEqual(resolved!.testTarget, csproj);
    assert.strictEqual(resolved!.kind, "csproj");
  });

  it("discovers multiple csproj candidates from features", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "bdd-pilot-multi-"));
    const projA = path.join(root, "ServiceA");
    const projB = path.join(root, "ServiceB");
    for (const p of [projA, projB]) {
      fs.mkdirSync(path.join(p, "Features"), { recursive: true });
      fs.writeFileSync(path.join(p, `${path.basename(p)}.csproj`), "<Project Sdk='Microsoft.NET.Sdk'></Project>");
      fs.writeFileSync(
        path.join(p, "Features", "F.feature"),
        `Feature: ${path.basename(p)}\n  Scenario: s\n    Then ok`,
      );
    }

    const candidates = discoverProjectCandidates([root]);
    assert.strictEqual(candidates.length, 2);
  });

  it("resolveProject returns undefined when multiple candidates and no selection", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "bdd-pilot-ambig-"));
    const projA = path.join(root, "A");
    const projB = path.join(root, "B");
    for (const p of [projA, projB]) {
      fs.mkdirSync(path.join(p, "Features"), { recursive: true });
      fs.writeFileSync(path.join(p, "T.csproj"), "<Project Sdk='Microsoft.NET.Sdk'></Project>");
      fs.writeFileSync(path.join(p, "Features", "F.feature"), "Feature: F\n  Scenario: s\n    Then ok");
    }

    assert.strictEqual(resolveProject([root], "", undefined), undefined);
  });

  it("uses stored selection when multiple candidates exist", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "bdd-pilot-store-"));
    const projA = path.join(root, "A");
    fs.mkdirSync(path.join(projA, "Features"), { recursive: true });
    const csprojA = path.join(projA, "A.csproj");
    fs.writeFileSync(csprojA, "<Project Sdk='Microsoft.NET.Sdk'></Project>");
    fs.writeFileSync(path.join(projA, "Features", "F.feature"), "Feature: F\n  Scenario: s\n    Then ok");

    const stored = {
      testTarget: csprojA,
      projectDir: projA,
      kind: "csproj" as const,
      label: "A.csproj",
    };
    const resolved = resolveProject([root], "", stored);
    assert.strictEqual(resolved?.testTarget, csprojA);
  });

  it("discoveryRoot uses workspace root for solution targets", () => {
    const root = "/repo";
    const project = {
      projectDir: "/repo",
      testTarget: "/repo/App.sln",
      kind: "sln" as const,
      label: "App.sln",
    };
    assert.strictEqual(discoveryRoot(project, [root]), root);
  });

  it("listSelectableProjects includes solutions", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bdd-pilot-sln-"));
    fs.writeFileSync(path.join(dir, "App.sln"), "Microsoft Visual Studio Solution File, Format Version 12.00");
    const list = listSelectableProjects([dir]);
    assert.ok(list.some((p) => p.kind === "sln"));
  });
});
