import * as assert from "assert";
import { describe, it } from "node:test";
import {
  buildDiagnosticsByDomainRollUp,
  formatDiagnosticsByDomainLines,
  MIN_DOMAINS_WITH_FAILS,
  MIN_TOTAL_FAILS,
  shouldEmitDiagnosticsByDomain,
  UNMAPPED_DOMAIN_KEY,
} from "../core/diagnostics/diagnosticsByDomain";
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
const betaRefund = scenario("Refund", 22);
const betaCheckout = scenario("Checkout", 24);
const betaFeature = feature("BetaPay", "/repo/Features/Beta/Pay.feature", [
  betaPay,
  betaRefund,
  betaCheckout,
]);
const domains: DomainGroup[] = [
  { name: "Alpha", features: [alphaFeature] },
  { name: "Beta", features: [betaFeature] },
];

describe("diagnosticsByDomain", () => {
  it("counts distinct failed rows across Alpha and Beta", () => {
    const results: TestResult[] = [
      failed("AlphaLoginFeature.Login", "No matching step definition"),
      failed("AlphaLoginFeature.Signup", "XUnitPendingStepException: pending"),
      failed("BetaPayFeature.Pay", "No available users in pool"),
      failed("BetaPayFeature.Refund", "The array cannot be null or empty"),
      failed("BetaPayFeature.Checkout", "Refit.ApiException: boom"),
      failed("Acme.Helpers.BuildQuestionnairePlan", "unexpected"),
    ];
    const rollUp = buildDiagnosticsByDomainRollUp(results, domains);
    assert.strictEqual(rollUp.totalFails, 6);
    assert.strictEqual(rollUp.byDomain.get("Alpha")?.pending, 2);
    assert.strictEqual(rollUp.byDomain.get("Beta")?.testData, 2);
    assert.strictEqual(rollUp.byDomain.get("Beta")?.http, 1);
    assert.strictEqual(rollUp.byDomain.get(UNMAPPED_DOMAIN_KEY)?.other, 1);
    assert.strictEqual(shouldEmitDiagnosticsByDomain(rollUp), true);
    assert.ok(MIN_DOMAINS_WITH_FAILS >= 2);
    assert.ok(MIN_TOTAL_FAILS >= 3);
  });

  it("does not emit for a single domain even with many fails", () => {
    const alphaOnly = feature("AlphaLogin", "/repo/Features/Alpha/Login.feature", [
      scenario("Login", 10),
      scenario("Signup", 12),
      scenario("Reset", 14),
      scenario("Verify", 16),
    ]);
    const oneDomain: DomainGroup[] = [{ name: "Alpha", features: [alphaOnly] }];
    const many = [
      failed("AlphaLoginFeature.Login", "No matching step definition"),
      failed("AlphaLoginFeature.Signup", "No matching step definition"),
      failed("AlphaLoginFeature.Reset", "No matching step definition"),
      failed("AlphaLoginFeature.Verify", "No matching step definition"),
    ];
    const rollUp = buildDiagnosticsByDomainRollUp(many, oneDomain);
    assert.strictEqual(shouldEmitDiagnosticsByDomain(rollUp), false);
    assert.deepStrictEqual(formatDiagnosticsByDomainLines(rollUp, "en"), []);
  });

  it("formats capped lines with stable bucket ids", () => {
    const results = [
      failed("AlphaLoginFeature.Login", "No matching step definition"),
      failed("AlphaLoginFeature.Signup", "No matching step definition"),
      failed("BetaPayFeature.Pay", "No available users"),
      failed("BetaPayFeature.Refund", "No available users"),
      failed("BetaPayFeature.Checkout", "Refit.ApiException"),
    ];
    const rollUp = buildDiagnosticsByDomainRollUp(results, domains);
    const lines = formatDiagnosticsByDomainLines(rollUp, "en");
    assert.ok(lines.length >= 3);
    assert.match(lines[0]!, /Diagnostics by domain/i);
    assert.match(lines.join("\n"), /Beta:.*testData=/);
    assert.match(lines.join("\n"), /Alpha:.*pending=/);
  });
});
