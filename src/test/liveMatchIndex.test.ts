import * as assert from "node:assert";
import { describe, it } from "node:test";
import {
  applySavedFeature,
  indexFeatureFileKeys,
  removeSavedFeature,
  renameSavedFeature,
} from "../core/gherkin/featureFileSync";
import { DomainGroup, FeatureInfo, OutlineExample, ScenarioInfo } from "../core/gherkin/model";
import { featureClassName, sanitizeIdentifier } from "../core/runner/filterBuilder";
import { outlineRowKey, scenarioKey } from "../core/runner/runScope";
import {
  buildLiveMatchIndex,
  collectLiveOutcomeKeysIndexed,
  collectLiveOutcomeKeysScan,
  LiveMatchIndex,
  selectLiveMatchCandidates,
} from "../core/results/liveMatchIndex";
import { TestOutcome } from "../core/results/trxParser";
import { OutcomeStore } from "../providers/outcomeStore";

function scenario(partial: Partial<ScenarioInfo> & Pick<ScenarioInfo, "name" | "line">): ScenarioInfo {
  return {
    tags: [],
    isOutline: false,
    ...partial,
  };
}

function feature(
  name: string,
  filePath: string,
  scenarios: ScenarioInfo[],
  tags: string[] = [],
): FeatureInfo {
  return { name, filePath, tags, scenarios };
}

function domainsOf(...features: FeatureInfo[]): DomainGroup[] {
  return [{ name: "Orders", features }];
}

function row(rowIndex: number, values: string[], headers = ["amount", "receipt"]): OutlineExample {
  return {
    rowIndex,
    line: 20 + rowIndex,
    headers,
    values,
    label: values.join(","),
  };
}

function fqn(featureName: string, scenarioName: string, suffix = ""): string {
  return `Acme.${featureClassName(featureName)}.${sanitizeIdentifier(scenarioName)}${suffix}`;
}

function applySequence(
  domains: DomainGroup[],
  events: Array<{ testName: string; outcome: TestOutcome }>,
  mode: "scan" | "indexed",
  index?: LiveMatchIndex,
): Record<string, TestOutcome> {
  const store = new OutcomeStore();
  const active = index ?? buildLiveMatchIndex(domains);
  for (const event of events) {
    const keys =
      mode === "scan"
        ? collectLiveOutcomeKeysScan(domains, event.testName)
        : collectLiveOutcomeKeysIndexed(active, event.testName).keys;
    for (const key of keys) {
      store.set(key, event.outcome);
    }
  }
  const snapshot: Record<string, TestOutcome> = {};
  for (const domain of domains) {
    for (const item of domain.features) {
      for (const leaf of item.scenarios) {
        if (leaf.examples && leaf.examples.length > 0) {
          for (const example of leaf.examples) {
            const key = outlineRowKey(item, leaf, example.rowIndex);
            const outcome = store.get(key);
            if (outcome) {
              snapshot[key] = outcome;
            }
          }
        }
        const key = scenarioKey(item, leaf);
        const outcome = store.get(key);
        if (outcome) {
          snapshot[key] = outcome;
        }
      }
    }
  }
  return snapshot;
}

function assertEquivalent(
  domains: DomainGroup[],
  events: Array<{ testName: string; outcome: TestOutcome }>,
  index = buildLiveMatchIndex(domains),
): void {
  const scan = applySequence(domains, events, "scan");
  const indexed = applySequence(domains, events, "indexed", index);
  assert.deepStrictEqual(indexed, scan);
  for (const event of events) {
    assert.deepStrictEqual(
      collectLiveOutcomeKeysIndexed(index, event.testName).keys,
      collectLiveOutcomeKeysScan(domains, event.testName),
    );
  }
}

describe("liveMatchIndex equivalence", () => {
  const place = scenario({ name: "Place order", line: 4 });
  const batch = scenario({ name: "Place order batch", line: 12 });
  const orders = feature("Orders", "/tmp/Orders.feature", [place, batch], ["smoke"]);
  const reports = feature("Reports", "/tmp/Reports.feature", [
    scenario({ name: "Place order", line: 4, tags: ["smoke", "regression"] }),
  ]);
  const tree = domainsOf(orders, reports);

  it("matches one plain scenario and leaves the homonym in another feature", () => {
    const events = [{ testName: fqn("Orders", "Place order"), outcome: "passed" as const }];
    assertEquivalent(tree, events);
    const indexed = collectLiveOutcomeKeysIndexed(buildLiveMatchIndex(tree), events[0].testName);
    assert.deepStrictEqual(indexed.keys, [scenarioKey(orders, place)]);
    assert.strictEqual(indexed.mode, "fqn");
    assert.ok(indexed.candidates < 3);
  });

  it("does not let PlaceOrderBatch satisfy Place order", () => {
    assertEquivalent(tree, [{ testName: fqn("Orders", "Place order batch"), outcome: "failed" }]);
    const keys = collectLiveOutcomeKeysScan(tree, fqn("Orders", "Place order batch"));
    assert.deepStrictEqual(keys, [scenarioKey(orders, batch)]);
  });

  it("matches every homonym when the feature title and scenario title are the same", () => {
    const again = feature("Orders", "/tmp/OrdersCopy.feature", [scenario({ name: "Place order", line: 8 })]);
    const domains = domainsOf(orders, again);
    const testName = fqn("Orders", "Place order");
    assertEquivalent(domains, [{ testName, outcome: "passed" }]);
    const keys = collectLiveOutcomeKeysScan(domains, testName);
    assert.strictEqual(keys.length, 2);
  });

  it("keeps tags out of the outcome key", () => {
    const testName = fqn("Reports", "Place order");
    const keys = collectLiveOutcomeKeysIndexed(buildLiveMatchIndex(tree), testName).keys;
    assert.deepStrictEqual(keys, [scenarioKey(reports, reports.scenarios[0])]);
    assert.ok(!keys[0].includes("smoke"));
  });

  it("resolves a Theory outline row and does not write the scenario key", () => {
    const outline = scenario({
      name: "Add two numbers",
      line: 6,
      isOutline: true,
      examples: [
        row(0, ["1", "2", "3"], ["first", "second", "result"]),
        row(1, ["4", "5", "9"], ["first", "second", "result"]),
      ],
    });
    const calc = feature("Calculator", "/tmp/Calculator.feature", [outline]);
    const domains = domainsOf(calc);
    const testName =
      'Acme.CalculatorFeature.AddTwoNumbers(first: "1", second: "2", result: "3", exampleTags: [])';
    assertEquivalent(domains, [{ testName, outcome: "passed" }]);
    const keys = collectLiveOutcomeKeysScan(domains, testName);
    assert.deepStrictEqual(keys, [outlineRowKey(calc, outline, 0)]);
  });

  it("treats an outline without example rows as a scenario key", () => {
    const bare = scenario({ name: "Add two numbers", line: 6, isOutline: true });
    const calc = feature("Calculator", "/tmp/Calculator.feature", [bare]);
    const domains = domainsOf(calc);
    assertEquivalent(domains, [{ testName: fqn("Calculator", "Add two numbers"), outcome: "skipped" }]);
    assert.deepStrictEqual(collectLiveOutcomeKeysScan(domains, fqn("Calculator", "Add two numbers")), [
      scenarioKey(calc, bare),
    ]);
  });

  it("writes nothing when several example rows match and none is chosen", () => {
    const outline = scenario({
      name: "Pay invoice",
      line: 6,
      isOutline: true,
      examples: [row(0, ["1"]), row(1, ["10"])],
    });
    const pay = feature("Billing", "/tmp/Billing.feature", [outline]);
    const domains = domainsOf(pay);
    const testName = `${fqn("Billing", "Pay invoice")}(10)`;
    assertEquivalent(domains, [{ testName, outcome: "failed" }]);
    assert.deepStrictEqual(collectLiveOutcomeKeysScan(domains, testName), []);
  });

  it("ignores a test name that matches nothing", () => {
    const testName = "Acme.MissingFeature.NotAScenario";
    assertEquivalent(tree, [{ testName, outcome: "failed" }]);
    assert.deepStrictEqual(collectLiveOutcomeKeysScan(tree, testName), []);
    const indexed = collectLiveOutcomeKeysIndexed(buildLiveMatchIndex(tree), testName);
    assert.strictEqual(indexed.keys.length, 0);
    assert.strictEqual(indexed.mode, "fqn");
  });

  it("matches accented Spanish titles through the same FQN rule", () => {
    const item = scenario({ name: "Añadir ítem", line: 3 });
    const pedidos = feature("Pedidos café", "/tmp/Pedidos.feature", [item]);
    const domains = domainsOf(pedidos);
    const testName = fqn("Pedidos café", "Añadir ítem");
    assertEquivalent(domains, [{ testName, outcome: "passed" }]);
    assert.deepStrictEqual(collectLiveOutcomeKeysScan(domains, testName), [scenarioKey(pedidos, item)]);
  });

  it("uses the legacy substring fallback for a name that is not a feature-class FQN", () => {
    const testName = "place order";
    const index = buildLiveMatchIndex(tree);
    const selected = selectLiveMatchCandidates(index, testName);
    assert.strictEqual(selected.mode, "fallback");
    assert.strictEqual(selected.scenarios, index.all);
    const indexed = collectLiveOutcomeKeysIndexed(index, testName);
    assert.strictEqual(indexed.mode, "fallback");
    assert.strictEqual(indexed.candidates, 3);
    assertEquivalent(tree, [{ testName, outcome: "passed" }]);
    const keys = collectLiveOutcomeKeysScan(tree, testName);
    assert.ok(keys.includes(scenarioKey(orders, place)));
    assert.ok(keys.includes(scenarioKey(reports, reports.scenarios[0])));
    assert.ok(!keys.includes(scenarioKey(orders, batch)));
  });

  it("is case-insensitive for the class and method tokens", () => {
    const testName = fqn("Orders", "Place order").toUpperCase();
    assertEquivalent(tree, [{ testName, outcome: "passed" }]);
  });

  it("applies a burst in arrival order and lets a later outcome replace an earlier one", () => {
    const outline = scenario({
      name: "Add two numbers",
      line: 9,
      isOutline: true,
      examples: [
        row(0, ["1", "2", "3"], ["first", "second", "result"]),
        row(1, ["8", "9", "17"], ["first", "second", "result"]),
      ],
    });
    const calc = feature("Calculator", "/tmp/Calculator.feature", [outline]);
    const domains = domainsOf(orders, reports, calc);
    const events: Array<{ testName: string; outcome: TestOutcome }> = [
      { testName: fqn("Orders", "Place order"), outcome: "passed" },
      { testName: "not a test", outcome: "failed" },
      {
        testName: 'Acme.CalculatorFeature.AddTwoNumbers(first: "8", second: "9", result: "17", exampleTags: [])',
        outcome: "failed",
      },
      { testName: fqn("Orders", "Place order"), outcome: "skipped" },
      { testName: fqn("Reports", "Place order"), outcome: "passed" },
    ];
    assertEquivalent(domains, events);
    const final = applySequence(domains, events, "indexed");
    assert.strictEqual(final[scenarioKey(orders, place)], "skipped");
    assert.strictEqual(final[outlineRowKey(calc, outline, 1)], "failed");
    assert.strictEqual(final[scenarioKey(reports, reports.scenarios[0])], "passed");
    assert.strictEqual(final[outlineRowKey(calc, outline, 0)], undefined);
  });

  it("drops a stale index when discovery replaces the domain array", () => {
    const first = domainsOf(orders);
    const index = buildLiveMatchIndex(first);
    const moved = scenario({ name: "Place order", line: 4 });
    const nextFeature = feature("Shipping", "/tmp/Shipping.feature", [moved]);
    const next = domainsOf(nextFeature);
    assert.notStrictEqual(index.domains, next);
    const stale = collectLiveOutcomeKeysIndexed(index, fqn("Shipping", "Place order"));
    assert.deepStrictEqual(stale.keys, []);
    const rebuilt = buildLiveMatchIndex(next);
    assert.deepStrictEqual(collectLiveOutcomeKeysIndexed(rebuilt, fqn("Shipping", "Place order")).keys, [
      scenarioKey(nextFeature, moved),
    ]);
    assert.deepStrictEqual(
      collectLiveOutcomeKeysIndexed(rebuilt, fqn("Shipping", "Place order")).keys,
      collectLiveOutcomeKeysScan(next, fqn("Shipping", "Place order")),
    );
  });

  it("keeps the full scan when a feature-class name contains Greek sigma", () => {
    const pay = scenario({ name: "Pay ς", line: 4 });
    const ship = scenario({ name: "Ship", line: 8 });
    const ordersFeature = feature("Orders", "/tmp/Orders.feature", [pay, ship]);
    const domains = domainsOf(ordersFeature);
    const index = buildLiveMatchIndex(domains);
    const unsanitized = `Acme.${featureClassName("Orders")}.Payς`;
    const selected = selectLiveMatchCandidates(index, unsanitized);
    assert.strictEqual(selected.mode, "fallback");
    assert.strictEqual(selected.scenarios, index.all);
    assertEquivalent(domains, [{ testName: unsanitized, outcome: "passed" }], index);
    const sanitized = fqn("Orders", "Pay ς");
    assert.ok(sanitized.includes("Σ"));
    assert.strictEqual(selectLiveMatchCandidates(index, sanitized).mode, "fallback");
    assertEquivalent(domains, [{ testName: sanitized.toUpperCase(), outcome: "failed" }], index);
  });

  it("rejects a compatibility character that shares a lower-case key but not the regex", () => {
    const run = scenario({ name: "K", line: 4 });
    const ordersFeature = feature("Orders", "/tmp/Orders.feature", [run]);
    const domains = domainsOf(ordersFeature);
    const testName = `Acme.${featureClassName("Orders")}.\u212A`;
    const indexed = collectLiveOutcomeKeysIndexed(buildLiveMatchIndex(domains), testName);
    assert.strictEqual(indexed.mode, "fqn");
    assert.strictEqual(indexed.candidates, 1);
    assert.deepStrictEqual(indexed.keys, []);
    assert.deepStrictEqual(collectLiveOutcomeKeysScan(domains, testName), []);
  });

  it("rebuilds when save, delete, or rename replaces the domain array", () => {
    const original = feature("Orders", "/tmp/Features/Orders/Orders.feature", [place]);
    const created = applySavedFeature([], new Map(), original);
    assert.strictEqual(created.changed, true);
    let index = buildLiveMatchIndex(created.domains);

    const unchanged = applySavedFeature(created.domains, created.fileKeys, original);
    assert.strictEqual(unchanged.changed, false);
    assert.strictEqual(unchanged.domains, created.domains);
    assert.strictEqual(unchanged.domains, index.domains);

    const added = scenario({ name: "Ship order", line: 9 });
    const saved = applySavedFeature(
      created.domains,
      indexFeatureFileKeys(created.domains),
      feature("Shipping", "/tmp/Features/Shipping/Shipping.feature", [added]),
    );
    assert.strictEqual(saved.changed, true);
    assert.notStrictEqual(saved.domains, created.domains);
    assert.deepStrictEqual(collectLiveOutcomeKeysIndexed(index, fqn("Shipping", "Ship order")).keys, []);
    index = buildLiveMatchIndex(saved.domains);
    assertEquivalent(saved.domains, [{ testName: fqn("Shipping", "Ship order"), outcome: "passed" }], index);

    const removed = removeSavedFeature(saved.domains, saved.fileKeys, original.filePath);
    assert.strictEqual(removed.changed, true);
    assert.notStrictEqual(removed.domains, saved.domains);
    const renamed = renameSavedFeature(
      removed.domains,
      removed.fileKeys,
      "/tmp/Features/Shipping/Shipping.feature",
      "/tmp/Features/Shipping/Moved.feature",
    );
    assert.strictEqual(renamed.changed, true);
    assert.notStrictEqual(renamed.domains, removed.domains);
    const moved = buildLiveMatchIndex(renamed.domains);
    const testName = fqn("Shipping", "Ship order");
    assert.deepStrictEqual(
      collectLiveOutcomeKeysIndexed(moved, testName).keys,
      collectLiveOutcomeKeysScan(renamed.domains, testName),
    );
    assert.ok(collectLiveOutcomeKeysScan(renamed.domains, testName)[0]?.includes("Moved.feature"));
  });

  it("reads example rows added in place without rebuilding the index", () => {
    const bare = scenario({ name: "Add two numbers", line: 6, isOutline: true });
    const calc = feature("Calculator", "/tmp/Calculator.feature", [bare]);
    const domains = domainsOf(calc);
    const index = buildLiveMatchIndex(domains);
    const plainName = fqn("Calculator", "Add two numbers");
    assert.deepStrictEqual(collectLiveOutcomeKeysIndexed(index, plainName).keys, [scenarioKey(calc, bare)]);
    bare.examples = [
      row(0, ["1", "2", "3"], ["first", "second", "result"]),
      row(1, ["4", "5", "9"], ["first", "second", "result"]),
    ];
    const theory =
      'Acme.CalculatorFeature.AddTwoNumbers(first: "4", second: "5", result: "9", exampleTags: [])';
    assert.deepStrictEqual(collectLiveOutcomeKeysIndexed(index, theory).keys, [
      outlineRowKey(calc, bare, 1),
    ]);
    assert.deepStrictEqual(
      collectLiveOutcomeKeysIndexed(index, theory).keys,
      collectLiveOutcomeKeysScan(domains, theory),
    );
  });
});
