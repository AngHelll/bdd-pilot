import * as assert from "assert";
import * as path from "path";
import { describe, it } from "node:test";
import {
  resolveFeatureInDomains,
  resolveScenarioInDomains,
} from "../core/gherkin/resolveRunTarget";
import { DomainGroup, FeatureInfo, ScenarioInfo } from "../core/gherkin/model";

function makeFeature(filePath: string, name: string, scenarios: ScenarioInfo[]): FeatureInfo {
  return { name, filePath, tags: [], scenarios };
}

const scenarioA: ScenarioInfo = {
  name: "Scenario A",
  tags: [],
  line: 10,
  isOutline: false,
};

describe("resolveRunTarget", () => {
  it("matches feature by normalized path when stub uses mixed separators", () => {
    const canonical = path.join("/proj", "Features", "Trading", "Sample.feature");
    const feature = makeFeature(canonical, "Sample", [scenarioA]);
    const domains: DomainGroup[] = [{ name: "Trading", features: [feature] }];

    const stub = makeFeature("/proj/Features/Trading/Sample.feature", "Sample", [scenarioA]);
    assert.strictEqual(resolveFeatureInDomains(stub, domains), feature);

    const stubDoubled = makeFeature("/proj//Features/Trading/Sample.feature", "Sample", [scenarioA]);
    assert.strictEqual(resolveFeatureInDomains(stubDoubled, domains), feature);
  });

  it("falls back to feature name when paths differ", () => {
    const feature = makeFeature("/proj/Features/Sample.feature", "Sample", [scenarioA]);
    const domains: DomainGroup[] = [{ name: "General", features: [feature] }];

    const stub = makeFeature("/other/path.feature", "Sample", [scenarioA]);
    assert.strictEqual(resolveFeatureInDomains(stub, domains), feature);
  });

  it("returns undefined when path and name do not match", () => {
    const feature = makeFeature("/proj/X.feature", "Sample", [scenarioA]);
    const domains: DomainGroup[] = [{ name: "General", features: [feature] }];

    const stub = makeFeature("/other/Y.feature", "Other", [scenarioA]);
    assert.strictEqual(resolveFeatureInDomains(stub, domains), undefined);
  });

  it("resolves scenario by line and name, then name only", () => {
    const scenarioB: ScenarioInfo = {
      name: "Scenario B",
      tags: [],
      line: 20,
      isOutline: false,
    };
    const feature = makeFeature("/proj/X.feature", "X", [scenarioA, scenarioB]);
    const domains: DomainGroup[] = [{ name: "General", features: [feature] }];

    const resolved = resolveScenarioInDomains(
      feature,
      { name: "Scenario A", tags: [], line: 10, isOutline: false },
      domains,
    );
    assert.deepStrictEqual(resolved, { feature, scenario: scenarioA });

    const byNameOnly = resolveScenarioInDomains(
      feature,
      { name: "Scenario B", tags: [], line: 999, isOutline: false },
      domains,
    );
    assert.deepStrictEqual(byNameOnly, { feature, scenario: scenarioB });
  });

  it("matches win32-style paths via normalize on Windows", () => {
    if (process.platform !== "win32") {
      return;
    }
    const feature = makeFeature("C:\\proj\\Features\\Sample.feature", "Sample", [scenarioA]);
    const domains: DomainGroup[] = [{ name: "General", features: [feature] }];
    const stub = makeFeature("C:/proj/Features/Sample.feature", "Sample", [scenarioA]);
    assert.strictEqual(resolveFeatureInDomains(stub, domains), feature);
  });
});
