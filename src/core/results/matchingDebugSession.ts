/** Session-only source for Matching Debug Pack candidates (not persisted). */

export interface MatchingDebugCandidateLeaf {
  label: string;
  candidateTestNames: string[];
  /** Present for ambiguous leaves when known. */
  chosenTestName?: string;
}

export interface MatchingDebugSource {
  candidatesByLabel: MatchingDebugCandidateLeaf[];
}

let lastSource: MatchingDebugSource | undefined;

export function setMatchingDebugSource(source: MatchingDebugSource | undefined): void {
  lastSource = source;
}

export function getMatchingDebugSource(): MatchingDebugSource | undefined {
  return lastSource;
}

export function clearMatchingDebugSource(): void {
  lastSource = undefined;
}
