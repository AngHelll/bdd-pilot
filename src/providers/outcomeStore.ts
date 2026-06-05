import { DomainGroup } from "../core/gherkin/model";
import { sanitizeErrorForStore } from "../core/results/outcomeFeedback";
import { collectOutcomeKeysForTargets } from "../core/runner/runScope";
import { RunTarget } from "../core/runner/filterBuilder";
import { TestOutcome } from "../core/results/trxParser";

/** Shared pass/fail decorations for the BDD tree and native Test Explorer. */
export class OutcomeStore {
  private outcomes = new Map<string, TestOutcome>();
  private durations = new Map<string, number>();
  private errors = new Map<string, string>();

  set(key: string, outcome: TestOutcome, durationMs?: number, errorMessage?: string): void {
    this.outcomes.set(key, outcome);
    if (durationMs !== undefined) {
      this.durations.set(key, durationMs);
    }
    if (errorMessage !== undefined) {
      const clean = sanitizeErrorForStore(errorMessage);
      if (clean) {
        this.errors.set(key, clean);
      } else {
        this.errors.delete(key);
      }
    } else if (outcome !== "failed") {
      this.errors.delete(key);
    }
  }

  get(key: string): TestOutcome | undefined {
    return this.outcomes.get(key);
  }

  getDuration(key: string): number | undefined {
    return this.durations.get(key);
  }

  getErrorMessage(key: string): string | undefined {
    return this.errors.get(key);
  }

  isEmpty(): boolean {
    return this.outcomes.size === 0;
  }

  clearAll(): void {
    this.outcomes.clear();
    this.durations.clear();
    this.errors.clear();
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
      this.errors.delete(key);
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
