import { TestOutcome } from "./trxParser";

/** Maps TRX/live outcome to TE skip reason when the item ends skipped. */
export function skipReasonForTrxOutcome(
  outcome: TestOutcome,
  canceled: boolean,
  hadTrxMatch: boolean,
): "runner_skipped" | "not_in_trx" | "canceled" | "unknown" | undefined {
  if (outcome === "unknown") {
    return "unknown";
  }
  if (outcome === "skipped") {
    return "runner_skipped";
  }
  if (!hadTrxMatch && canceled) {
    return "canceled";
  }
  if (!hadTrxMatch) {
    return "not_in_trx";
  }
  return undefined;
}

/** Resolves TE run state for a canceled item using OutcomeStore when TRX has no row. */
export function resolveCanceledLeafOutcome(
  storedOutcome: TestOutcome | undefined,
): "passed" | "failed" | "skipped" | "pending" {
  if (!storedOutcome || storedOutcome === "unknown") {
    return "pending";
  }
  if (storedOutcome === "passed" || storedOutcome === "failed" || storedOutcome === "skipped") {
    return storedOutcome;
  }
  return "pending";
}
