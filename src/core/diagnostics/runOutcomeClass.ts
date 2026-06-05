import { UnifiedSummary } from "../results/resultLoader";
import { testsExecutedInOutput } from "./analyzer";

export type RunCompletionKind =
  | "success"
  | "test_failures"
  | "infra"
  | "canceled"
  | "no_results";

export interface RunCompletionInput {
  exitCode: number | null;
  canceled: boolean;
  summary?: UnifiedSummary;
  outputBuffer: string;
}

/** Classifies how a dotnet test run finished for TE/tree feedback. */
export function classifyRunCompletion(input: RunCompletionInput): RunCompletionKind {
  if (input.canceled) {
    return "canceled";
  }

  if (input.summary?.results.some((r) => r.outcome === "failed")) {
    return "test_failures";
  }

  if (input.exitCode === 0 && input.summary && input.summary.total > 0) {
    return "success";
  }

  const executed = testsExecutedInOutput(input.outputBuffer);

  if (!input.summary || input.summary.total === 0) {
    if (!executed && input.exitCode !== 0) {
      return "infra";
    }
    return "no_results";
  }

  if (!executed && input.exitCode !== 0) {
    return "infra";
  }

  if (input.exitCode === 0) {
    return "success";
  }

  return "test_failures";
}
