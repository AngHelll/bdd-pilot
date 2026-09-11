import * as assert from "assert";
import { describe, it } from "node:test";
import {
  computeRollup,
  containerHealth,
  ContainerHealth,
  OutcomeRollup,
  rollupSeverity,
} from "../core/gherkin/outcomeRollup";
import { TestOutcome } from "../core/results/trxParser";

function rollupOf(
  passed: number,
  failed: number,
  skipped: number,
  unknown = 0,
): OutcomeRollup {
  const outcomes: TestOutcome[] = [
    ...Array<TestOutcome>(passed).fill("passed"),
    ...Array<TestOutcome>(failed).fill("failed"),
    ...Array<TestOutcome>(skipped).fill("skipped"),
    ...Array<TestOutcome>(unknown).fill("unknown"),
  ];
  return computeRollup(outcomes);
}

const fixtures: Array<{
  name: string;
  passed: number;
  failed: number;
  skipped: number;
  unknown?: number;
  health: ContainerHealth | undefined;
  severity: ReturnType<typeof rollupSeverity>;
}> = [
  { name: "all passed", passed: 40, failed: 0, skipped: 0, health: "passed", severity: "passed" },
  { name: "1 of 40 watch", passed: 39, failed: 1, skipped: 0, health: "watch", severity: "failed" },
  { name: "2 of 20 watch at 10%", passed: 18, failed: 2, skipped: 0, health: "watch", severity: "failed" },
  { name: "2 of 19 failed by rate", passed: 17, failed: 2, skipped: 0, health: "failed", severity: "failed" },
  { name: "1 of 9 failed by N", passed: 8, failed: 1, skipped: 0, health: "failed", severity: "failed" },
  { name: "1 of 3 failed", passed: 2, failed: 1, skipped: 0, health: "failed", severity: "failed" },
  { name: "3 of 40 failed by count", passed: 37, failed: 3, skipped: 0, health: "failed", severity: "failed" },
  { name: "5 of 10 failed", passed: 5, failed: 5, skipped: 0, health: "failed", severity: "failed" },
  { name: "only skipped", passed: 0, failed: 0, skipped: 4, health: "skipped", severity: "skipped" },
  { name: "1 fail among skips is watch", passed: 9, failed: 1, skipped: 20, health: "watch", severity: "failed" },
  {
    name: "unknown does not inflate N",
    passed: 0,
    failed: 1,
    skipped: 0,
    unknown: 9,
    health: "failed",
    severity: "failed",
  },
  { name: "empty", passed: 0, failed: 0, skipped: 0, health: undefined, severity: undefined },
];

describe("containerHealth", () => {
  for (const row of fixtures) {
    it(row.name, () => {
      const rollup = rollupOf(row.passed, row.failed, row.skipped, row.unknown ?? 0);
      assert.strictEqual(containerHealth(rollup), row.health);
      assert.strictEqual(rollupSeverity(rollup), row.severity);
    });
  }
});
