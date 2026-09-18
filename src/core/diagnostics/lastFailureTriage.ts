import { FailureTriage } from "./failureTriage";

/** In-memory last failure triage for the session (Jump review-first / filter-by-class). */
let lastTriage: FailureTriage | undefined;

export function setLastFailureTriage(triage: FailureTriage | undefined): void {
  lastTriage = triage;
}

export function getLastFailureTriage(): FailureTriage | undefined {
  return lastTriage;
}

export function clearLastFailureTriage(): void {
  lastTriage = undefined;
}
