import { BindingGateIssue } from "./evaluateBindingGate";
import { BindingGateUx } from "./resolveBindingGateUx";

export type BindingGatePromptKind = "warn-non-modal" | "block-modal";

/** True when ambiguous issues should be logged to Output (never blocks via modal). */
export function shouldLogAmbiguousIssues(ambiguousIssues: BindingGateIssue[]): boolean {
  return ambiguousIssues.length > 0;
}

/** True when the user must be prompted about unbound issues before running. */
export function shouldPromptForUnboundIssues(unboundIssues: BindingGateIssue[]): boolean {
  return unboundIssues.length > 0;
}

/** Resolves how unbound issues are presented when a prompt is required. */
export function resolveUnboundPromptKind(ux: BindingGateUx): BindingGatePromptKind | undefined {
  if (ux === "modal-warn") {
    return "warn-non-modal";
  }
  if (ux === "modal-block") {
    return "block-modal";
  }
  return undefined;
}
