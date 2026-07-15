import { UnmappedLeaf } from "./trxTreeMapping";

/** Max unmapped detail lines written to Output after the summary. */
export const UNMAPPED_OUTPUT_CAP = 25;

export function selectUnmappedForOutput(
  leaves: UnmappedLeaf[],
  cap: number = UNMAPPED_OUTPUT_CAP,
): { shown: UnmappedLeaf[]; remaining: number } {
  if (leaves.length <= cap) {
    return { shown: leaves, remaining: 0 };
  }
  return { shown: leaves.slice(0, cap), remaining: leaves.length - cap };
}
