import * as assert from "assert";
import { describe, it } from "node:test";
import {
  buildMatchingDebugPack,
  computeMatchingLayoutHint,
  formatMatchingHealthBuckets,
  hasMappingGaps,
  layoutSubpathSegments,
} from "../core/results/matchingDebugPack";
import { TreeMappingReport, UnmappedLeaf } from "../core/results/trxTreeMapping";

function leaf(label: string, overrides?: Partial<UnmappedLeaf>): UnmappedLeaf {
  return {
    outcomeKey: `key:${label}`,
    featureName: "Feat",
    featurePath: "/tmp/Feat.feature",
    scenarioName: "Scen",
    line: 1,
    label,
    ...overrides,
  };
}

function baseReport(overrides?: Partial<TreeMappingReport>): TreeMappingReport {
  return {
    inScope: 2,
    mapped: 2,
    unmapped: 0,
    unmappedLeaves: [],
    unusedTrx: [],
    ambiguousLeaves: [],
    sharedChosenCount: 0,
    trxTotal: 2,
    ...overrides,
  };
}

describe("matchingDebugPack", () => {
  it("hasMappingGaps false when clean", () => {
    assert.strictEqual(hasMappingGaps(baseReport()), false);
    assert.strictEqual(formatMatchingHealthBuckets(baseReport()), undefined);
  });

  it("buildMatchingDebugPack returns undefined when no gaps", () => {
    const md = buildMatchingDebugPack({
      report: baseReport(),
      meta: { stage: "test", mode: "headless" },
    });
    assert.strictEqual(md, undefined);
  });

  it("buildMatchingDebugPack includes sections and sanitizes filter", () => {
    const report = baseReport({
      unmapped: 1,
      mapped: 1,
      unmappedLeaves: [leaf("Feat · Missing")],
      unusedTrx: [{ testName: "Acme.Unit.Other", outcome: "passed" }],
      ambiguousLeaves: [
        {
          label: "Feat · Ambiguous",
          candidateCount: 2,
          chosenTestName: "Acme.FeatFeature.Ambiguous",
        },
      ],
      sharedChosenCount: 1,
      trxTotal: 4,
    });
    const md = buildMatchingDebugPack({
      report,
      meta: {
        stage: "stg",
        mode: "headed",
        filter: "FullyQualifiedName~Foo&password=supersecret",
        extensionVersion: "1.40.0",
      },
      candidatesByLabel: [
        {
          label: "Feat · Ambiguous",
          candidateTestNames: ["Acme.FeatFeature.Ambiguous", "Acme.FeatFeature.Ambiguous2"],
          chosenTestName: "Acme.FeatFeature.Ambiguous",
        },
      ],
    });
    assert.ok(md);
    assert.match(md!, /# BDD Pilot — Matching Debug Pack/);
    assert.match(md!, /## Run/);
    assert.match(md!, /## Mapping summary/);
    assert.match(md!, /## Layout \/ grouping/);
    assert.match(md!, /layout: paths unavailable/);
    assert.match(md!, /## Unmapped/);
    assert.match(md!, /Feat · Missing/);
    assert.match(md!, /## Unused TRX/);
    assert.match(md!, /Acme\.Unit\.Other/);
    assert.match(md!, /## Ambiguous/);
    assert.match(md!, /## Shared/);
    assert.match(md!, /## Candidates/);
    assert.match(md!, /\*\*\(chosen\)\*\*/);
    assert.match(md!, /## Notes/);
    assert.match(md!, /\*\*\*REDACTED\*\*\*/);
    assert.doesNotMatch(md!, /supersecret/);
  });

  it("report-only mode notes unavailable candidates", () => {
    const md = buildMatchingDebugPack({
      report: baseReport({
        unmapped: 1,
        unmappedLeaves: [leaf("Feat · Gone")],
      }),
      meta: { stage: "test", mode: "headless" },
    });
    assert.ok(md);
    assert.match(md!, /candidates: unavailable \(session report only\)/);
  });

  it("formatMatchingHealthBuckets emits unused hint", () => {
    const line = formatMatchingHealthBuckets(
      baseReport({
        unusedTrx: [{ testName: "HasProfilingPayload", outcome: "passed" }],
        unmapped: 0,
      }),
    );
    assert.strictEqual(
      line,
      "unused=1 unused_gherkin=0 unused_other=1 · hint=likely_not_ours_or_mixed_sln",
    );
  });

  it("formatMatchingHealthBuckets unused gherkin-only hints matcher", () => {
    const line = formatMatchingHealthBuckets(
      baseReport({
        unusedTrx: [{ testName: "Acme.AlphaFeature.Orphan", outcome: "passed" }],
        unmapped: 0,
      }),
    );
    assert.strictEqual(
      line,
      "unused=1 unused_gherkin=1 unused_other=0 · hint=review_matcher_or_outline",
    );
  });

  it("formatMatchingHealthBuckets prefers matcher hint when ambiguous", () => {
    const line = formatMatchingHealthBuckets(
      baseReport({
        unmapped: 2,
        unmappedLeaves: [leaf("A"), leaf("B")],
        ambiguousLeaves: [
          { label: "A", candidateCount: 2, chosenTestName: "T" },
        ],
      }),
    );
    assert.strictEqual(line, "unmapped=2 ambiguous=1 · hint=review_matcher_or_outline");
  });

  it("formatMatchingHealthBuckets unmapped-only hint", () => {
    const line = formatMatchingHealthBuckets(
      baseReport({
        unmapped: 1,
        unmappedLeaves: [leaf("Gone")],
      }),
    );
    assert.strictEqual(line, "unmapped=1 · hint=missing_trx_or_filter");
  });

  it("buildMatchingDebugPack splits unused into Gherkin-like and Other", () => {
    const md = buildMatchingDebugPack({
      report: baseReport({
        unusedTrx: [
          { testName: "Acme.AlphaFeature.Login", outcome: "passed" },
          { testName: "HasProfilingPayload", outcome: "passed" },
        ],
        trxTotal: 3,
      }),
      meta: { stage: "test", mode: "headless" },
    });
    assert.ok(md);
    assert.match(md!, /Unused gherkin-like:\*\* 1/);
    assert.match(md!, /Unused other:\*\* 1/);
    assert.match(md!, /### Gherkin-like/);
    assert.match(md!, /### Other/);
    assert.match(md!, /HasProfilingPayload/);
  });

  it("layoutSubpathSegments extracts folders after domain", () => {
    assert.deepStrictEqual(
      layoutSubpathSegments("/repo/Features/Trading/BuyingPower/X.feature"),
      ["BuyingPower"],
    );
    assert.deepStrictEqual(
      layoutSubpathSegments("/repo/Features/Trading/A/B/X.feature"),
      ["A", "B"],
    );
    assert.deepStrictEqual(layoutSubpathSegments("/repo/Features/Login.feature"), []);
  });

  it("buildMatchingDebugPack includes layout domain path and aggregate", () => {
    const projectDir = "/repo";
    const report = baseReport({
      unmapped: 2,
      mapped: 0,
      unmappedLeaves: [
        leaf("Trading · Buy", {
          featurePath: `${projectDir}/Features/Trading/BuyingPower/Buy.feature`,
        }),
        leaf("Trading · Sell", {
          featurePath: `${projectDir}/Features/Trading/Orders/Sell.feature`,
        }),
      ],
    });
    const md = buildMatchingDebugPack({
      report,
      meta: { stage: "test", mode: "headless" },
      layout: {
        projectDir,
        groupBy: "domain",
        leaves: [
          {
            label: "Trading · Buy",
            featurePath: `${projectDir}/Features/Trading/BuyingPower/Buy.feature`,
            domain: "Trading",
          },
          {
            label: "Trading · Sell",
            featurePath: `${projectDir}/Features/Trading/Orders/Sell.feature`,
            domain: "Trading",
          },
        ],
      },
    });
    assert.ok(md);
    assert.match(md!, /\*\*groupBy:\*\* domain/);
    assert.match(md!, /gaps by domain:\*\* Trading=2/);
    assert.match(md!, /domain=Trading/);
    assert.match(md!, /path=`Features\/Trading\/BuyingPower\/Buy\.feature`/);
    assert.match(md!, /subpath=BuyingPower/);
    assert.doesNotMatch(md!, /layout: paths unavailable/);
  });

  it("computeMatchingLayoutHint clustered and general and deep", () => {
    assert.strictEqual(
      computeMatchingLayoutHint([
        { label: "a", domain: "Trading", relativePath: "a", subpath: "", subpathDepth: 0 },
        { label: "b", domain: "Trading", relativePath: "b", subpath: "", subpathDepth: 0 },
        { label: "c", domain: "Trading", relativePath: "c", subpath: "", subpathDepth: 0 },
      ]),
      "layout_clustered",
    );
    assert.strictEqual(
      computeMatchingLayoutHint([
        { label: "a", domain: "General", relativePath: "a", subpath: "", subpathDepth: 0 },
        { label: "b", domain: "General", relativePath: "b", subpath: "", subpathDepth: 0 },
        { label: "c", domain: "General", relativePath: "c", subpath: "", subpathDepth: 0 },
      ]),
      "layout_clustered",
    );
    assert.strictEqual(
      computeMatchingLayoutHint([
        { label: "a", domain: "General", relativePath: "a", subpath: "", subpathDepth: 0 },
        { label: "b", domain: "General", relativePath: "b", subpath: "", subpathDepth: 0 },
        { label: "c", domain: "General", relativePath: "c", subpath: "", subpathDepth: 0 },
        { label: "d", domain: "Other", relativePath: "d", subpath: "", subpathDepth: 0 },
        { label: "e", domain: "Other", relativePath: "e", subpath: "", subpathDepth: 0 },
      ]),
      "layout_general_bucket",
    );
    assert.strictEqual(
      computeMatchingLayoutHint([
        { label: "a", domain: "T", relativePath: "a", subpath: "A/B", subpathDepth: 2 },
        { label: "b", domain: "U", relativePath: "b", subpath: "C/D", subpathDepth: 2 },
        { label: "c", domain: "V", relativePath: "c", subpath: "E/F", subpathDepth: 2 },
      ]),
      "layout_deep_subpath",
    );
  });
});
