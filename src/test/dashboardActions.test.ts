import * as assert from "assert";
import { describe, it } from "node:test";
import { LastRunSnapshot } from "../core/diagnostics/aiFailureContext";
import { DomainGroup } from "../core/gherkin/model";
import { DEFAULT_FILTER_MAPPING } from "../core/runner/filterMapping";
import {
  buildDashboardActionsViewModel,
  buildRerunFilterFromHistoryEntry,
  canRerunFailedForTarget,
  parseDashboardWebviewMessage,
  resolveDashboardActionTarget,
} from "../core/results/dashboardActions";
import { RunHistoryEntry } from "../core/results/runHistory";

describe("dashboardActions", () => {
  const domains: DomainGroup[] = [
    {
      name: "General",
      features: [
        {
          name: "Smoke",
          filePath: "/proj/Features/Smoke.feature",
          tags: [],
          scenarios: [{ name: "Add two numbers", tags: [], line: 5, isOutline: false }],
        },
      ],
    },
  ];

  it("resolveDashboardActionTarget prefers session snapshot", () => {
    const snapshot = baseSnapshot({ failed: 2 });
    const target = resolveDashboardActionTarget([], snapshot);
    assert.strictEqual(target?.kind, "session");
    assert.strictEqual(target?.failed, 2);
  });

  it("resolveDashboardActionTarget falls back to latest completed history with failures", () => {
    const history = [
      makeHistoryEntry("1", { failed: 0 }),
      makeHistoryEntry("2", { failed: 3, status: "completed" }),
    ];
    const target = resolveDashboardActionTarget(history, undefined);
    assert.strictEqual(target?.kind, "history");
    assert.strictEqual(target?.entryId, "2");
  });

  it("resolveDashboardActionTarget uses canceled entry when no completed failures", () => {
    const history = [makeHistoryEntry("c", { failed: 1, status: "canceled" })];
    const target = resolveDashboardActionTarget(history, undefined);
    assert.strictEqual(target?.kind, "history");
    assert.strictEqual(target?.entryId, "c");
  });

  it("buildRerunFilterFromHistoryEntry ORs failed scenario clauses", () => {
    const entry = makeHistoryEntry("1", {
      failed: 2,
      scenarios: [
        {
          featurePath: "/proj/Features/Smoke.feature",
          scenarioLine: 5,
          scenarioName: "Add two numbers",
          outcome: "failed",
        },
        {
          featurePath: "/proj/Features/Smoke.feature",
          scenarioLine: 10,
          scenarioName: "Other",
          outcome: "failed",
        },
      ],
    });
    const filter = buildRerunFilterFromHistoryEntry(entry, DEFAULT_FILTER_MAPPING, domains);
    assert.ok(filter?.includes("FullyQualifiedName~SmokeFeature.AddTwoNumbers"));
    assert.ok(filter?.includes("|"));
  });

  it("canRerunFailedForTarget uses session filter for session target", () => {
    const target = resolveDashboardActionTarget([], baseSnapshot())!;
    assert.strictEqual(
      canRerunFailedForTarget(target, "FullyQualifiedName~Foo", undefined, domains, DEFAULT_FILTER_MAPPING),
      true,
    );
    assert.strictEqual(
      canRerunFailedForTarget(target, undefined, undefined, domains, DEFAULT_FILTER_MAPPING),
      false,
    );
  });

  it("buildDashboardActionsViewModel disables copy for history target", () => {
    const history = [makeHistoryEntry("1", { failed: 1 })];
    const vm = buildDashboardActionsViewModel({
      history,
      sessionRerunFilter: undefined,
      domains,
      filterMapping: DEFAULT_FILTER_MAPPING,
      aiEnabled: true,
    });
    assert.strictEqual(vm.target?.kind, "history");
    assert.strictEqual(vm.canCopyForAi, false);
    assert.strictEqual(vm.canRerunFailed, true);
  });

  it("parseDashboardWebviewMessage whitelists commands", () => {
    assert.strictEqual(parseDashboardWebviewMessage({ command: "showOutput" }), "showOutput");
    assert.strictEqual(parseDashboardWebviewMessage({ command: "evil" }), undefined);
  });
});

function baseSnapshot(overrides: Partial<LastRunSnapshot["summary"]> = {}): LastRunSnapshot {
  return {
    timestamp: 1000,
    stage: "test",
    mode: "debug",
    scopeLabels: ["all tests"],
    projectDir: "/proj",
    exitCode: 1,
    summary: { passed: 0, failed: 1, skipped: 0, total: 1, ...overrides },
    outputForAnalysis: "",
    failedScenarios: [],
    evidence: [],
  };
}

function makeHistoryEntry(
  id: string,
  opts: {
    failed?: number;
    status?: "completed" | "canceled";
    scenarios?: RunHistoryEntry["scenarios"];
  } = {},
): RunHistoryEntry {
  return {
    id,
    timestamp: Date.now(),
    stage: "test",
    mode: "debug",
    passed: 0,
    failed: opts.failed ?? 1,
    skipped: 0,
    total: opts.failed ?? 1,
    status: opts.status,
    scenarios: opts.scenarios ?? [
      {
        featurePath: "/proj/Features/Smoke.feature",
        scenarioLine: 5,
        scenarioName: "Add two numbers",
        outcome: "failed",
      },
    ],
  };
}
