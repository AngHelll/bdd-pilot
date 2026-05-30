import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { describe, it } from "node:test";
import { discoverProjectCandidates } from "../core/config/projectLocator";
import { resolveProject } from "../core/config/projectResolution";
import { discoverFeatures } from "../core/gherkin/discovery";
import { buildFilter } from "../core/runner/filterBuilder";
import { estimateTestCount } from "../core/runner/runEstimate";

const repoRoot = path.resolve(__dirname, "..", "..");
const sampleDir = path.join(repoRoot, "samples", "minimal-bdd");
const sampleCsproj = path.join(sampleDir, "MinimalBdd.csproj");

describe("samples/minimal-bdd smoke", () => {
  it("sample project exists on disk", () => {
    assert.ok(fs.existsSync(sampleCsproj), "MinimalBdd.csproj should exist");
    assert.ok(fs.existsSync(path.join(sampleDir, "Features", "Smoke.feature")));
  });

  it("discovers and parses Smoke.feature", () => {
    const features = discoverFeatures(sampleDir);
    assert.strictEqual(features.length, 1);

    const smoke = features[0];
    assert.strictEqual(smoke.name, "Smoke");
    assert.ok(smoke.tags.includes("bdd-pilot-smoke"));
    assert.strictEqual(smoke.scenarios.length, 2);

    const outline = smoke.scenarios.find((s) => s.isOutline);
    assert.ok(outline);
    assert.strictEqual(outline!.examples?.length, 2);
  });

  it("estimates three executable tests (1 scenario + 2 outline rows)", () => {
    const total = estimateTestCount([{ kind: "all" }], sampleDir);
    assert.strictEqual(total, 3);
  });

  it("auto-detects a single project candidate from features", () => {
    const candidates = discoverProjectCandidates([sampleDir]);
    assert.strictEqual(candidates.length, 1);
    assert.strictEqual(candidates[0].testTarget, sampleCsproj);
    assert.strictEqual(candidates[0].kind, "csproj");
  });

  it("builds dotnet filters aligned with Reqnroll/xUnit naming", () => {
    const features = discoverFeatures(sampleDir);
    const smoke = features[0];
    const scenario = smoke.scenarios.find((s) => !s.isOutline)!;
    const outline = smoke.scenarios.find((s) => s.isOutline)!;
    const example = outline.examples![0];

    assert.strictEqual(buildFilter({ kind: "tag", tag: "smoke" }), "Category=smoke");
    assert.strictEqual(buildFilter({ kind: "feature", feature: smoke }), "FullyQualifiedName~SmokeFeature");
    assert.strictEqual(
      buildFilter({ kind: "scenario", feature: smoke, scenario }),
      "FullyQualifiedName~SmokeFeature.SystemIsReady",
    );
    assert.ok(
      buildFilter({ kind: "outlineRow", feature: smoke, scenario: outline, example })?.includes("DisplayName~"),
    );
  });

  it("resolveProject picks the sample when workspace root is samples/minimal-bdd", () => {
    const resolved = resolveProject([sampleDir], "");
    assert.ok(resolved);
    assert.strictEqual(resolved!.testTarget, sampleCsproj);
  });
});
