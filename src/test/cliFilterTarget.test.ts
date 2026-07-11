import * as assert from "assert";
import * as path from "path";
import { describe, it } from "node:test";
import { resolveCliFilterTarget, CliFilterNotFoundError } from "../core/runner/cliFilterTarget";
import { buildFilter } from "../core/runner/filterBuilder";

const repoRoot = path.resolve(__dirname, "..", "..");
const sampleDir = path.join(repoRoot, "samples", "minimal-bdd");

describe("cliFilterTarget", () => {
  it("resolves --all to run-all target", () => {
    const { target, scopeLabel } = resolveCliFilterTarget(sampleDir, { kind: "all" });
    assert.strictEqual(target.kind, "all");
    assert.strictEqual(scopeLabel, "all tests");
    assert.strictEqual(buildFilter(target), undefined);
  });

  it("resolves tag smoke to Category=smoke filter", () => {
    const { target, scopeLabel } = resolveCliFilterTarget(sampleDir, { kind: "tag", tag: "smoke" });
    assert.strictEqual(target.kind, "tag");
    if (target.kind === "tag") {
      assert.strictEqual(target.tag, "smoke");
    }
    assert.strictEqual(scopeLabel, "@smoke (tag)");
    assert.strictEqual(buildFilter(target), "Category=smoke");
  });

  it("accepts @ prefix on tag", () => {
    const { target } = resolveCliFilterTarget(sampleDir, { kind: "tag", tag: "@smoke" });
    assert.strictEqual(target.kind, "tag");
    if (target.kind === "tag") {
      assert.strictEqual(target.tag, "smoke");
    }
  });

  it("resolves feature by relative path", () => {
    const { target, scopeLabel } = resolveCliFilterTarget(sampleDir, {
      kind: "feature",
      featurePath: "Features/Smoke.feature",
    });
    assert.strictEqual(target.kind, "feature");
    assert.match(scopeLabel, /Smoke\.feature \(feature\)/);
    assert.strictEqual(buildFilter(target), "FullyQualifiedName~SmokeFeature");
  });

  it("resolves feature + scenario", () => {
    const { target } = resolveCliFilterTarget(sampleDir, {
      kind: "feature",
      featurePath: "Features/Smoke.feature",
      scenarioName: "System is ready",
    });
    assert.strictEqual(target.kind, "scenario");
    assert.strictEqual(
      buildFilter(target),
      "FullyQualifiedName~SmokeFeature.SystemIsReady",
    );
  });

  it("throws when tag is missing", () => {
    assert.throws(
      () => resolveCliFilterTarget(sampleDir, { kind: "tag", tag: "does-not-exist" }),
      CliFilterNotFoundError,
    );
  });

  it("throws when feature path is missing", () => {
    assert.throws(
      () => resolveCliFilterTarget(sampleDir, { kind: "feature", featurePath: "Features/Nope.feature" }),
      CliFilterNotFoundError,
    );
  });

  it("throws when scenario name is missing", () => {
    assert.throws(
      () =>
        resolveCliFilterTarget(sampleDir, {
          kind: "feature",
          featurePath: "Features/Smoke.feature",
          scenarioName: "Missing scenario",
        }),
      CliFilterNotFoundError,
    );
  });
});
