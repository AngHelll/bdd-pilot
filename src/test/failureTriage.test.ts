import * as assert from "assert";
import { describe, it } from "node:test";
import {
  buildFailureTriage,
  formatFailureTriageLines,
  formatFailureTriageToastHint,
  MAX_TRIAGE_BUCKETS_SHOWN,
  REVIEW_BUCKET_ORDER,
} from "../core/diagnostics/failureTriage";
import { DomainGroup, FeatureInfo, ScenarioInfo } from "../core/gherkin/model";
import { TestResult } from "../core/results/trxParser";

function scenario(name: string, line: number): ScenarioInfo {
  return { name, line, tags: [], isOutline: false };
}

function feature(name: string, filePath: string, scenarios: ScenarioInfo[]): FeatureInfo {
  return { name, filePath, tags: [], scenarios };
}

function failed(testName: string, errorMessage: string): TestResult {
  return { testName, outcome: "failed", errorMessage };
}

const alphaLogin = scenario("Login", 10);
const alphaSignup = scenario("Signup", 12);
const alphaFeature = feature("AlphaLogin", "/repo/Features/Alpha/Login.feature", [
  alphaLogin,
  alphaSignup,
]);
const betaPay = scenario("Pay", 20);
const betaFeature = feature("BetaPay", "/repo/Features/Beta/Pay.feature", [betaPay]);
const domains: DomainGroup[] = [
  { name: "Alpha", features: [alphaFeature] },
  { name: "Beta", features: [betaFeature] },
];

describe("failureTriage", () => {
  it("returns undefined when no failed rows", () => {
    assert.strictEqual(buildFailureTriage([{ testName: "x", outcome: "passed" }], domains), undefined);
  });

  it("picks pending as topBucket over assert even when assert has higher count", () => {
    const results = [
      failed("AlphaLoginFeature.Login", "No matching step definition"),
      failed("AlphaLoginFeature.Signup", "Xunit.Sdk.EqualException"),
      failed("BetaPayFeature.Pay", "Xunit.Sdk.EqualException"),
    ];
    const triage = buildFailureTriage(results, domains);
    assert.ok(triage);
    assert.strictEqual(triage!.topBucket, "pending");
    assert.strictEqual(triage!.counts.pending, 1);
    assert.strictEqual(triage!.counts.assert, 2);
    assert.strictEqual(REVIEW_BUCKET_ORDER[0], "pending");
  });

  it("caps orderedBuckets and formats Review first + Hotspot", () => {
    const results = [
      failed("AlphaLoginFeature.Login", "No matching step definition"),
      failed("AlphaLoginFeature.Signup", "No matching step definition"),
      failed("BetaPayFeature.Pay", "No available users"),
      failed("Acme.Other", "Refit.ApiException"),
      failed("Acme.Assert", "Xunit.Sdk.EqualException"),
      failed("Acme.Code", "NullReferenceException"),
    ];
    const triage = buildFailureTriage(results, domains);
    assert.ok(triage);
    assert.ok(triage!.orderedBuckets.length <= MAX_TRIAGE_BUCKETS_SHOWN);
    assert.strictEqual(triage!.orderedBuckets[0]?.bucket, "pending");
    assert.strictEqual(triage!.hotspotDomain, "Alpha");
    assert.strictEqual(triage!.hotspotFailCount, 2);

    const lines = formatFailureTriageLines(triage!, "en");
    assert.match(lines[0]!, /Review first: pending \(2\)/);
    assert.match(lines[0]!, /then testData/);
    assert.match(lines[1]!, /Hotspot: Alpha \(2 fails\)/);

    const hint = formatFailureTriageToastHint(triage!, "en");
    assert.match(hint, /Review first: pending \(2\)/);
  });

  it("emits triage for mono-domain runs", () => {
    const oneDomain: DomainGroup[] = [{ name: "Alpha", features: [alphaFeature] }];
    const results = [
      failed("AlphaLoginFeature.Login", "No matching step definition"),
      failed("AlphaLoginFeature.Signup", "Xunit.Sdk.EqualException"),
    ];
    const triage = buildFailureTriage(results, oneDomain);
    assert.ok(triage);
    assert.strictEqual(triage!.topBucket, "pending");
    assert.strictEqual(triage!.hotspotDomain, "Alpha");
    const lines = formatFailureTriageLines(triage!, "es");
    assert.match(lines[0]!, /Revisar primero/);
  });
});
