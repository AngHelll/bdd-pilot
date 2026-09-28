import * as assert from "assert";
import { describe, it } from "node:test";
import { DomainGroup, FeatureInfo } from "../core/gherkin/model";
import { parseFeature } from "../core/gherkin/parser";
import {
  FEATURE_SAVE_REFRESH_DEBOUNCE_MS,
  applySavedFeature,
  createFeatureFileSync,
  featureFileKey,
  indexFeatureFileKeys,
  isFeatureFileInProject,
  normalizeFeaturePath,
  removeSavedFeature,
  renameSavedFeature,
  resolveTheoryEnrichAction,
  theoryDiscoveryKey,
} from "../core/gherkin/featureFileSync";

const PROJECT = "/proj";
const LOGIN = "/proj/Features/Login.feature";
const OUTLINE = "/proj/Features/Trading/Add.feature";

const LOGIN_TEXT = ["Feature: Login", "  Scenario: Ok", "    Then done"].join("\n");
const OUTLINE_TEXT = ["Feature: Add", "  Scenario Outline: Sum", "    Then <a>"].join("\n");

function harness(initial?: { domains: DomainGroup[]; fileKeys: Map<string, string> }) {
  let domains = initial?.domains ?? [];
  let fileKeys = initial?.fileKeys ?? new Map<string, string>();
  let runActive = false;
  let managedRefreshes = 0;
  let enrichSchedules = 0;
  let reapplies = 0;
  let queued: (() => void) | undefined;
  const reads = new Map<string, string>();

  const sync = createFeatureFileSync({
    getProjectDir: () => PROJECT,
    isRunActive: () => runActive,
    applySavedFeature: (feature) => {
      const next = applySavedFeature(domains, fileKeys, feature);
      domains = next.domains;
      fileKeys = next.fileKeys;
      return next.changed;
    },
    removeFeature: (filePath) => {
      const next = removeSavedFeature(domains, fileKeys, filePath);
      domains = next.domains;
      fileKeys = next.fileKeys;
      return next.changed;
    },
    renameFeature: (oldPath, newPath) => {
      const next = renameSavedFeature(domains, fileKeys, oldPath, newPath);
      domains = next.domains;
      fileKeys = next.fileKeys;
      return next.changed;
    },
    refreshManaged: () => {
      managedRefreshes += 1;
    },
    reapplyTheory: async () => {
      reapplies += 1;
      return true;
    },
    scheduleEnrich: () => {
      enrichSchedules += 1;
    },
    readFeatureText: (filePath) => reads.get(filePath),
    setTimer: (fn) => {
      queued = fn;
      return 1;
    },
    clearTimer: () => undefined,
  });

  return {
    sync,
    reads,
    flush: () => {
      const run = queued;
      queued = undefined;
      run?.();
    },
    setRunActive: (active: boolean) => {
      runActive = active;
    },
    snapshot: () => ({
      domains,
      fileKeys,
      managedRefreshes,
      enrichSchedules,
      reapplies,
    }),
  };
}

describe("feature file identity", () => {
  it("keeps the same model when the saved file identity did not change", () => {
    const feature = parseFeature(LOGIN, LOGIN_TEXT);
    const first = applySavedFeature([], new Map(), feature);
    assert.strictEqual(first.changed, true);
    const second = applySavedFeature(first.domains, first.fileKeys, feature);
    assert.strictEqual(second.changed, false);
    assert.strictEqual(second.domains, first.domains);
  });

  it("treats an Examples cell edit as a structural change", () => {
    const before = parseFeature(
      OUTLINE,
      ["Feature: Add", "  Scenario Outline: Sum", "    Then <a>", "    Examples:", "      | a |", "      | 1 |"].join(
        "\n",
      ),
    );
    const after = parseFeature(
      OUTLINE,
      ["Feature: Add", "  Scenario Outline: Sum", "    Then <a>", "    Examples:", "      | a |", "      | 2 |"].join(
        "\n",
      ),
    );
    assert.notStrictEqual(featureFileKey(before), featureFileKey(after));
    const applied = applySavedFeature([domainOf(before)], indexFeatureFileKeys([domainOf(before)]), after);
    assert.strictEqual(applied.changed, true);
    assert.strictEqual(applied.domains[0].features[0].scenarios[0].examples?.[0].values[0], "2");
  });

  it("removes and renames without a full rediscovery", () => {
    const feature = parseFeature(LOGIN, LOGIN_TEXT);
    const indexed = applySavedFeature([], new Map(), feature);
    const removed = removeSavedFeature(indexed.domains, indexed.fileKeys, LOGIN);
    assert.strictEqual(removed.changed, true);
    assert.strictEqual(removed.domains.length, 0);
    assert.strictEqual(removeSavedFeature(removed.domains, removed.fileKeys, LOGIN).changed, false);

    const renamed = renameSavedFeature(
      indexed.domains,
      indexed.fileKeys,
      LOGIN,
      "/proj/Features/Trading/Login.feature",
    );
    assert.strictEqual(renamed.changed, true);
    assert.strictEqual(renamed.domains[0].name, "Trading");
    assert.strictEqual(renamed.domains[0].features[0].filePath, "/proj/Features/Trading/Login.feature");
  });

  it("accepts only feature files inside the project", () => {
    assert.strictEqual(isFeatureFileInProject(PROJECT, LOGIN), true);
    assert.strictEqual(isFeatureFileInProject(PROJECT, "/other/Login.feature"), false);
    assert.strictEqual(isFeatureFileInProject(PROJECT, "/proj/../etc/Login.feature"), false);
    assert.strictEqual(normalizeFeaturePath("C:\\proj\\A.feature"), "C:/proj/A.feature");
    assert.strictEqual(FEATURE_SAVE_REFRESH_DEBOUNCE_MS, 300);
  });
});

describe("theory enrich decision", () => {
  it("skips files that already have an Examples table", () => {
    const feature = parseFeature(
      OUTLINE,
      ["Feature: Add", "  Scenario Outline: Sum", "    Then <a>", "    Examples:", "      | a |", "      | 1 |"].join(
        "\n",
      ),
    );
    assert.strictEqual(theoryDiscoveryKey(feature), undefined);
    assert.strictEqual(resolveTheoryEnrichAction(feature, { names: undefined, key: undefined }, false), "skip");
  });

  it("spawns, defers, or reapplies from the cached list", () => {
    const feature = parseFeature(OUTLINE, OUTLINE_TEXT);
    const key = theoryDiscoveryKey(feature);
    assert.ok(key);
    assert.strictEqual(resolveTheoryEnrichAction(feature, { names: undefined, key: undefined }, false), "spawn");
    assert.strictEqual(resolveTheoryEnrichAction(feature, { names: undefined, key: undefined }, true), "defer");
    assert.strictEqual(
      resolveTheoryEnrichAction(feature, { names: [], key }, false),
      "reapply",
    );
  });
});

describe("feature file sync", () => {
  it("coalesces saves and skips refresh when the text identity is unchanged", () => {
    const box = harness();
    box.sync.onSaved(LOGIN, LOGIN_TEXT);
    box.sync.onSaved(LOGIN, LOGIN_TEXT.replace("done", "done "));
    box.flush();
    const first = box.snapshot();
    assert.strictEqual(first.domains[0].features[0].name, "Login");
    assert.strictEqual(first.managedRefreshes, 1);
    assert.strictEqual(first.enrichSchedules, 0);

    box.sync.onSaved(LOGIN, LOGIN_TEXT);
    box.flush();
    assert.strictEqual(box.snapshot().managedRefreshes, 1);
  });

  it("schedules list-tests once, then reapplies when only the feature title changes", async () => {
    const box = harness();
    box.sync.onSaved(OUTLINE, OUTLINE_TEXT);
    box.flush();
    assert.strictEqual(box.snapshot().enrichSchedules, 1);

    const feature = parseFeature(OUTLINE, OUTLINE_TEXT);
    const key = theoryDiscoveryKey(feature);
    assert.ok(key);
    box.sync.noteTheoryList(["Sum(a: 1)"], new Map([[normalizeFeaturePath(OUTLINE), key]]));

    box.sync.onSaved(OUTLINE, OUTLINE_TEXT.replace("Feature: Add", "Feature: Add numbers"));
    box.flush();
    await Promise.resolve();
    const after = box.snapshot();
    assert.strictEqual(after.enrichSchedules, 1);
    assert.strictEqual(after.reapplies, 1);
    assert.strictEqual(after.managedRefreshes, 2);
  });

  it("defers list-tests until the run lock is free", () => {
    const box = harness();
    box.setRunActive(true);
    box.sync.onSaved(OUTLINE, OUTLINE_TEXT);
    box.flush();
    assert.strictEqual(box.snapshot().enrichSchedules, 0);
    assert.strictEqual(box.snapshot().managedRefreshes, 1);

    box.sync.flushDeferredEnrich();
    assert.strictEqual(box.snapshot().enrichSchedules, 0);

    box.setRunActive(false);
    box.sync.flushDeferredEnrich();
    assert.strictEqual(box.snapshot().enrichSchedules, 1);
  });

  it("drops a deleted feature and follows a rename", () => {
    const box = harness();
    box.sync.onSaved(LOGIN, LOGIN_TEXT);
    box.flush();
    box.sync.onDeleted([LOGIN]);
    assert.strictEqual(box.snapshot().domains.length, 0);

    box.sync.onSaved(LOGIN, LOGIN_TEXT);
    box.flush();
    const moved = "/proj/Features/Trading/Login.feature";
    box.sync.onRenamed([{ oldPath: LOGIN, newPath: moved }]);
    const after = box.snapshot();
    assert.strictEqual(after.domains[0].name, "Trading");
    assert.strictEqual(after.domains[0].features[0].filePath, moved);
  });

  it("ignores a feature saved outside the project", () => {
    const box = harness();
    box.sync.onSaved("/other/Login.feature", LOGIN_TEXT);
    box.flush();
    assert.strictEqual(box.snapshot().domains.length, 0);
    assert.strictEqual(box.snapshot().managedRefreshes, 0);
  });
});

function domainOf(feature: FeatureInfo): DomainGroup {
  return { name: "Trading", features: [feature] };
}
