import * as assert from "assert";
import { describe, it } from "node:test";
import {
  createDotnetOutputFilterState,
  filterDotnetOutputLine,
  flushDotnetOutputFilter,
  formatOutputSectionHeader,
  formatRunContextLine,
  processDotnetOutputChunk,
} from "../core/feedback/dotnetOutputFilter";

describe("dotnetOutputFilter", () => {
  it("drops known noise lines", () => {
    assert.strictEqual(
      filterDotnetOutputLine("Starting test execution, please wait..."),
      "drop",
    );
    assert.strictEqual(
      filterDotnetOutputLine("A total of 3 test files matched the specified pattern."),
      "drop",
    );
    assert.strictEqual(filterDotnetOutputLine("Building..."), "drop");
    assert.strictEqual(filterDotnetOutputLine("Build started."), "drop");
    assert.strictEqual(filterDotnetOutputLine("Determining projects to restore..."), "drop");
    assert.strictEqual(
      filterDotnetOutputLine(
        "Restored /Users/me/samples/minimal-bdd/MinimalBdd.csproj (in 30 ms).",
      ),
      "drop",
    );
    assert.strictEqual(
      filterDotnetOutputLine("All projects are up-to-date for restore."),
      "drop",
    );
  });

  it("drops Reqnroll MSBuild inventory and dll redirect", () => {
    assert.strictEqual(
      filterDotnetOutputLine("  Processing ReqnrollFeatureFiles for project... Features"),
      "drop",
    );
    assert.strictEqual(
      filterDotnetOutputLine(
        "  ReqnrollFeatureFiles: Features/E-Commerce.feature;Features/Greetings.feature",
      ),
      "drop",
    );
    assert.strictEqual(filterDotnetOutputLine("  -> Using reqnroll.json"), "drop");
    assert.strictEqual(
      filterDotnetOutputLine("  ReqnrollGeneratedFiles: Features/Smoke.feature.cs"),
      "drop",
    );
    assert.strictEqual(
      filterDotnetOutputLine(
        "    Identity=Features/Greetings.feature (%(Identity)=Features/Greetings.feature)",
      ),
      "drop",
    );
    assert.strictEqual(
      filterDotnetOutputLine(
        "  MinimalBdd -> /Users/me/samples/minimal-bdd/bin/Debug/net8.0/MinimalBdd.dll",
      ),
      "drop",
    );
  });

  it("keeps failure and assert lines (fail-open)", () => {
    assert.strictEqual(filterDotnetOutputLine("Failed Assert.Equal(expected, actual)"), "keep");
    assert.strictEqual(filterDotnetOutputLine("  Stack Trace:"), "keep");
    assert.strictEqual(filterDotnetOutputLine("System.Exception: boom"), "keep");
    assert.strictEqual(filterDotnetOutputLine("error MSB1001"), "keep");
    assert.strictEqual(filterDotnetOutputLine("XUnitPendingStepException"), "keep");
  });

  it("keeps Pilot markers, Results File, and xUnit verdict", () => {
    assert.strictEqual(filterDotnetOutputLine("[bdd-pilot] dotnet test ..."), "keep");
    assert.strictEqual(filterDotnetOutputLine("[xUnit.net 00:00:01] Something"), "keep");
    assert.strictEqual(filterDotnetOutputLine("Passed! - Failed: 0, Passed: 6"), "keep");
    assert.strictEqual(
      filterDotnetOutputLine("Results File: /tmp/bdd-pilot-run.trx"),
      "keep",
    );
  });

  it("processDotnetOutputChunk filters and collapses blank lines", () => {
    const state = createDotnetOutputFilterState();
    const chunk =
      "Starting test execution, please wait...\n\n\nFailed Assert.Equal(1, 2)\n\n";
    const out = processDotnetOutputChunk(chunk, state, "filtered");
    assert.ok(!out.includes("Starting test execution"));
    assert.ok(out.includes("Failed Assert.Equal(1, 2)"));
    assert.ok(!/\n\n\n/.test(out));
  });

  it("raw mode passes chunk unchanged", () => {
    const state = createDotnetOutputFilterState();
    const chunk = "Starting test execution, please wait...\n";
    assert.strictEqual(processDotnetOutputChunk(chunk, state, "raw"), chunk);
  });

  it("buffers incomplete lines until newline", () => {
    const state = createDotnetOutputFilterState();
    assert.strictEqual(processDotnetOutputChunk("Starting test", state, "filtered"), "");
    const rest = processDotnetOutputChunk(" execution, please wait...\nkeep me\n", state, "filtered");
    assert.ok(!rest.includes("Starting test"));
    assert.ok(rest.includes("keep me"));
  });

  it("flush emits pending keep line", () => {
    const state = createDotnetOutputFilterState();
    processDotnetOutputChunk("Failed Assert", state, "filtered");
    assert.strictEqual(flushDotnetOutputFilter(state), "Failed Assert\n");
  });

  it("section headers and run context are localized", () => {
    assert.match(formatOutputSectionHeader("en", "run"), /Run/);
    assert.match(formatOutputSectionHeader("es", "results"), /Resultados/);
    const line = formatRunContextLine("en", {
      stage: "test",
      mode: "serial",
      scopeLabel: "@smoke",
      timestampIso: "2026-07-20T12:00:00Z",
    });
    assert.ok(line.includes("test"));
    assert.ok(line.includes("@smoke"));
    assert.ok(line.includes("2026-07-20T12:00:00Z"));
  });
});
