import { BindingGateIssue } from "./evaluateBindingGate";

export type BindingGateMode = "off" | "warn" | "block";
export type BindingGateUx = "proceed" | "modal-warn" | "modal-block";

export function isBindingGateMode(value: string): value is BindingGateMode {
  return value === "off" || value === "warn" || value === "block";
}

export function resolveBindingGateUx(
  setting: BindingGateMode,
  unboundIssues: BindingGateIssue[],
  ambiguousIssues: BindingGateIssue[],
): BindingGateUx {
  if (setting === "off") {
    return "proceed";
  }

  const issueCount = unboundIssues.length + ambiguousIssues.length;
  if (issueCount === 0) {
    return "proceed";
  }

  if (setting === "warn") {
    return "modal-warn";
  }

  if (unboundIssues.length > 0) {
    return "modal-block";
  }

  return "modal-warn";
}
