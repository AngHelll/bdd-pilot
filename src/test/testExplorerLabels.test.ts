import * as assert from "assert";
import { describe, it } from "node:test";
import { FeatureInfo, ScenarioInfo, DomainGroup } from "../core/gherkin/model";
import { TagGroup } from "../core/gherkin/groupByTag";
import {
  buildTestExplorerDomainDescription,
  buildTestExplorerFeatureDescription,
  buildTestExplorerLeafDescription,
  buildTestExplorerOutlineRowDescription,
  buildTestExplorerScenarioDescription,
  buildTestExplorerTagDescription,
  formatOutcomeLabel,
  OutcomeReader,
} from "../core/gherkin/testExplorerLabels";
import { DEFAULT_COMPACT_TAG_LIMIT, DEFAULT_TAG_DISPLAY } from "../core/gherkin/treeLabels";
import { DEFAULT_DURATION_DISPLAY } from "../core/results/durationFormat";

const display = {
  tagDisplay: DEFAULT_TAG_DISPLAY,
  compactTagLimit: DEFAULT_COMPACT_TAG_LIMIT,
  durationDisplay: DEFAULT_DURATION_DISPLAY,
};

class MemoryStore implements OutcomeReader {
  private outcomes = new Map<string, "passed" | "failed" | "skipped">();
  private durations = new Map<string, number>();

  set(key: string, outcome: "passed" | "failed" | "skipped", durationMs?: number): void {
    this.outcomes.set(key, outcome);
    if (durationMs !== undefined) {
      this.durations.set(key, durationMs);
    }
  }

  get(key: string) {
    return this.outcomes.get(key);
  }

  getDuration(key: string) {
    return this.durations.get(key);
  }
}

function feature(name: string, scenarios: ScenarioInfo[] = []): FeatureInfo {
  return { name, filePath: `/f/${name}.feature`, tags: ["Smoke"], scenarios };
}

function plainScenario(name: string, line: number): ScenarioInfo {
  return { name, tags: [], line, isOutline: false };
}

describe("testExplorerLabels", () => {
  it("formatOutcomeLabel localizes outcomes", () => {
    assert.strictEqual(formatOutcomeLabel("passed", "en"), "passed");
    assert.strictEqual(formatOutcomeLabel("failed", "es"), "fallido");
  });

  it("buildTestExplorerLeafDescription joins outcome, duration, and context", () => {
    const desc = buildTestExplorerLeafDescription("passed", 450, display, "en", "Login");
    assert.strictEqual(desc, "passed · 450 ms · Login");
  });

  it("buildTestExplorerLeafDescription uses Spanish outcome label", () => {
    const desc = buildTestExplorerLeafDescription("failed", undefined, display, "es", "Login");
    assert.strictEqual(desc, "fallido · Login");
  });

  it("buildTestExplorerScenarioDescription includes feature hint under tag group", () => {
    const f = feature("Login", [plainScenario("User logs in", 10)]);
    const store = new MemoryStore();
    store.set("/f/Login.feature::10::User logs in", "passed", 1200);

    const desc = buildTestExplorerScenarioDescription(
      f,
      f.scenarios[0],
      store,
      display,
      "en",
      true,
    );
    assert.strictEqual(desc, "passed · 1.2 s · Login");
  });

  it("buildTestExplorerScenarioDescription rollups outline rows", () => {
    const scenario: ScenarioInfo = {
      name: "Outline",
      tags: [],
      line: 5,
      isOutline: true,
      examples: [{ rowIndex: 0, line: 8, headers: ["a"], values: ["1"], label: "a=1" }],
    };
    const f = feature("Outline", [scenario]);
    const store = new MemoryStore();
    store.set("/f/Outline.feature::5::Outline::row0", "failed");

    const desc = buildTestExplorerScenarioDescription(f, scenario, store, display, "en", false);
    assert.strictEqual(desc, "1 failed · @Smoke");
  });

  it("buildTestExplorerOutlineRowDescription includes tag summary", () => {
    const scenario = plainScenario("Row scenario", 3);
    const f = feature("Feat", [scenario]);
    const store = new MemoryStore();
    store.set("/f/Feat.feature::3::Row scenario::row0", "passed", 90);

    const desc = buildTestExplorerOutlineRowDescription(f, scenario, store, display, "en", 0);
    assert.ok(desc?.startsWith("passed · 90 ms"));
    assert.ok(desc?.includes("@Smoke"));
  });

  it("buildTestExplorerDomainDescription includes localized rollup", () => {
    const scenario = plainScenario("A", 1);
    const f = feature("F", [scenario]);
    const domain: DomainGroup = { name: "Trading", features: [f] };
    const store = new MemoryStore();
    store.set("/f/F.feature::1::A", "failed");

    const desc = buildTestExplorerDomainDescription(domain, store, "es");
    assert.ok(desc.includes("1 fallidos"));
    assert.ok(desc.includes("1 feature"));
  });

  it("buildTestExplorerTagDescription includes scenario count", () => {
    const f = feature("F", [plainScenario("A", 1), plainScenario("B", 2)]);
    const group: TagGroup = {
      tag: "smoke",
      scenarios: [
        { feature: f, scenario: f.scenarios[0] },
        { feature: f, scenario: f.scenarios[1] },
      ],
    };
    const store = new MemoryStore();
    store.set("/f/F.feature::1::A", "passed");
    store.set("/f/F.feature::2::B", "passed");

    const desc = buildTestExplorerTagDescription(group, store, "en");
    assert.strictEqual(desc, "2 passed · 2 scenarios");
  });

  it("buildTestExplorerFeatureDescription prepends rollup to feature summary", () => {
    const f = feature("Checkout", [plainScenario("Pay", 4)]);
    const store = new MemoryStore();
    store.set("/f/Checkout.feature::4::Pay", "skipped");

    const desc = buildTestExplorerFeatureDescription(f, store, display, "en");
    assert.ok(desc.startsWith("1 skipped"));
    assert.ok(desc.includes("1 scenario"));
  });
});
