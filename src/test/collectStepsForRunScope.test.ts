import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { describe, it } from "node:test";
import {
  collectStepsForRunScope,
  shouldSkipBindingGate,
} from "../core/bindings/collectStepsForRunScope";
import { DomainGroup, FeatureInfo, ScenarioInfo } from "../core/gherkin/model";

function writeFeature(dir: string, name: string, content: string): FeatureInfo {
  const filePath = path.join(dir, `${name}.feature`);
  fs.writeFileSync(filePath, content, "utf8");
  return {
    name,
    filePath,
    tags: [],
    scenarios: [
      { name: "Scenario A", tags: [], line: 5, isOutline: false },
      { name: "Scenario B", tags: ["smoke"], line: 9, isOutline: false },
    ],
  };
}

const FEATURE_CONTENT = `Feature: Sample

  Background:
    Given bg step

  Scenario: Scenario A
    When step a

  @smoke
  Scenario: Scenario B
    Then step b
`;

describe("collectStepsForRunScope", () => {
  it("shouldSkipBindingGate for raw filter and empty targets", () => {
    assert.strictEqual(shouldSkipBindingGate("Category=smoke", [{ kind: "tag", tag: "smoke" }]), true);
    assert.strictEqual(shouldSkipBindingGate(undefined, []), true);
    assert.strictEqual(shouldSkipBindingGate(undefined, [{ kind: "all" }]), false);
  });

  it("collects all steps for run-all", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pilot-gate-"));
    const feature = writeFeature(dir, "Sample", FEATURE_CONTENT);
    const domains: DomainGroup[] = [{ name: "General", features: [feature] }];

    const locations = collectStepsForRunScope([{ kind: "all" }], domains);
    assert.ok(locations.some((l) => l.scenarioName === "Background"));
    assert.ok(locations.some((l) => l.stepText.includes("step a")));
    assert.ok(locations.some((l) => l.stepText.includes("step b")));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("scopes to a single scenario and includes Background", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pilot-gate-"));
    const feature = writeFeature(dir, "Sample", FEATURE_CONTENT);
    const domains: DomainGroup[] = [{ name: "General", features: [feature] }];
    const scenario: ScenarioInfo = feature.scenarios[0];

    const locations = collectStepsForRunScope(
      [{ kind: "scenario", feature, scenario }],
      domains,
    );

    assert.ok(locations.some((l) => l.scenarioName === "Background"));
    assert.ok(locations.some((l) => l.stepText.includes("step a")));
    assert.ok(!locations.some((l) => l.stepText.includes("step b")));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("returns empty when raw filter is set", () => {
    const feature: FeatureInfo = {
      name: "X",
      filePath: "/x/X.feature",
      tags: [],
      scenarios: [],
    };
    const domains: DomainGroup[] = [{ name: "G", features: [feature] }];
    assert.deepStrictEqual(
      collectStepsForRunScope([{ kind: "all" }], domains, "Category=smoke"),
      [],
    );
  });
});
