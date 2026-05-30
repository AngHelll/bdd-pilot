import { DomainGroup } from "../core/gherkin/model";
import { collectOutcomeKeysForTargets } from "../core/runner/runScope";
import { RunTarget } from "../core/runner/filterBuilder";
import { TestOutcome } from "../core/results/trxParser";

/** Shared pass/fail decorations for the BDD tree and native Test Explorer. */
export class OutcomeStore {
  private outcomes = new Map<string, TestOutcome>();
  private durations = new Map<string, number>();

  set(key: string, outcome: TestOutcome, durationMs?: number): void {
    this.outcomes.set(key, outcome);
    if (durationMs !== undefined) {
      this.durations.set(key, durationMs);
    }
  }

  get(key: string): TestOutcome | undefined {
    return this.outcomes.get(key);
  }

  getDuration(key: string): number | undefined {
    return this.durations.get(key);
  }

  clearAll(): void {
    this.outcomes.clear();
    this.durations.clear();
  }

  clearForRunScope(targets: RunTarget[], domains: DomainGroup[]): void {
    const scope = collectOutcomeKeysForTargets(targets, domains);
    if (scope === "all") {
      this.clearAll();
      return;
    }
    if (scope.size === 0) {
      return;
    }
    for (const key of scope) {
      this.outcomes.delete(key);
      this.durations.delete(key);
    }
  }
}

export function outcomeDescription(outcome: TestOutcome | undefined): string | undefined {
  switch (outcome) {
    case "passed":
      return "passed";
    case "failed":
      return "failed";
    case "skipped":
      return "skipped";
    default:
      return undefined;
  }
}
