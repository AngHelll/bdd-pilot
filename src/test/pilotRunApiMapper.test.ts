import * as assert from "assert";
import * as path from "path";
import { describe, it } from "node:test";
import { OutcomeRollup } from "../core/gherkin/outcomeRollup";
import { RunHistoryEntry } from "../core/results/runHistory";
import { buildSessionRunSnapshot } from "../core/results/sessionRunSnapshot";
import {
  countOutcomeStoreLeaves,
  mapHistoryEntry,
  mapLastRun,
  mapRollup,
  mapRunHistory,
  toAbsolutePath,
} from "../api/pilotRunApiMapper";
import { DomainGroup } from "../core/gherkin/model";

describe("pilotRunApiMapper", () => {
  it("mapRollup computes pending from total leaves", () => {
    const rollup: OutcomeRollup = { passed: 2, failed: 1, skipped: 0, withResults: 3 };
    assert.deepStrictEqual(mapRollup(rollup, 5), {
      passed: 2,
      failed: 1,
      skipped: 0,
      withResults: 3,
      pending: 2,
    });
  });

  it("countOutcomeStoreLeaves counts outline rows", () => {
    const domains: DomainGroup[] = [
      {
        name: "Demo",
        features: [
          {
            name: "Demo",
            filePath: "/proj/Features/Demo.feature",
            tags: [],
            scenarios: [
              {
                name: "Plain",
                line: 5,
                tags: [],
                isOutline: false,
              },
              {
                name: "Outline",
                line: 10,
                tags: [],
                isOutline: true,
                examples: [
                  { rowIndex: 0, line: 12, headers: ["x"], values: ["a"], label: "a" },
                  { rowIndex: 1, line: 13, headers: ["x"], values: ["b"], label: "b" },
                ],
              },
            ],
          },
        ],
      },
    ];
    assert.strictEqual(countOutcomeStoreLeaves(domains), 3);
  });

  it("mapLastRun returns all-green snapshot with empty failures", () => {
    const snapshot = buildSessionRunSnapshot({
      timestamp: 1,
      stage: "dev",
      mode: "sequential",
      scopeLabels: ["all tests"],
      projectDir: "/proj",
      exitCode: 0,
      status: "completed",
      summary: { passed: 3, failed: 0, skipped: 0, total: 3, source: "trx" },
      failedScenarios: [],
      evidence: [],
      trxPath: "TestResults/bdd-pilot-1.trx",
      outputBuffer: "",
    });

    const dto = mapLastRun(snapshot);
    assert.strictEqual(dto.status, "completed");
    assert.strictEqual(dto.summary.failed, 0);
    assert.deepStrictEqual(dto.failedScenarios, []);
    assert.deepStrictEqual(dto.diagnostics, []);
    assert.strictEqual(dto.trxPath, path.resolve("/proj", "TestResults/bdd-pilot-1.trx"));
  });

  it("mapLastRun maps canceled status", () => {
    const snapshot = buildSessionRunSnapshot({
      timestamp: 1,
      stage: "dev",
      mode: "sequential",
      scopeLabels: ["@smoke (tag)"],
      projectDir: "/proj",
      exitCode: null,
      status: "canceled",
      summary: { passed: 1, failed: 0, skipped: 0, total: 1 },
      failedScenarios: [],
      evidence: [{ kind: "screenshot", path: "/proj/evidence/a.png" }],
      outputBuffer: "",
    });

    assert.strictEqual(mapLastRun(snapshot).status, "canceled");
  });

  it("mapHistoryEntry sanitizes scenario error messages", () => {
    const entry: RunHistoryEntry = {
      id: "run-1",
      timestamp: 1,
      stage: "dev",
      mode: "sequential",
      passed: 0,
      failed: 1,
      skipped: 0,
      total: 1,
      scenarios: [
        {
          featurePath: "/proj/Features/A.feature",
          scenarioLine: 3,
          scenarioName: "Fail",
          outcome: "failed",
          errorMessage: "password=secret",
        },
      ],
      trxPath: "/proj/TestResults/bdd-pilot-1.trx",
    };

    const dto = mapHistoryEntry(entry);
    assert.match(dto.scenarios[0].errorMessage ?? "", /REDACTED/);
    assert.strictEqual(dto.trxPath, "/proj/TestResults/bdd-pilot-1.trx");
  });

  it("mapRunHistory returns deep copies", () => {
    const entries: RunHistoryEntry[] = [
      {
        id: "run-1",
        timestamp: 1,
        stage: "dev",
        mode: "sequential",
        passed: 1,
        failed: 0,
        skipped: 0,
        total: 1,
        scenarios: [],
      },
    ];
    const first = mapRunHistory(entries);
    first[0].passed = 99;
    const second = mapRunHistory(entries);
    assert.strictEqual(second[0].passed, 1);
  });

  it("mapLastRun deep copy is independent", () => {
    const snapshot = buildSessionRunSnapshot({
      timestamp: 1,
      stage: "dev",
      mode: "sequential",
      scopeLabels: ["all tests"],
      projectDir: "/proj",
      exitCode: 0,
      status: "completed",
      summary: { passed: 1, failed: 0, skipped: 0, total: 1 },
      failedScenarios: [],
      evidence: [],
      outputBuffer: "",
    });
    const first = mapLastRun(snapshot);
    first.scopeLabels.push("extra");
    const second = mapLastRun(snapshot);
    assert.deepStrictEqual(second.scopeLabels, ["all tests"]);
  });

  it("toAbsolutePath resolves relative trx paths", () => {
    assert.strictEqual(
      toAbsolutePath("TestResults/a.trx", "/proj"),
      path.resolve("/proj", "TestResults/a.trx"),
    );
    assert.strictEqual(toAbsolutePath("/abs/a.trx"), "/abs/a.trx");
  });
});
