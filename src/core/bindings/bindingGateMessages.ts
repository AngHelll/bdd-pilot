import * as path from "path";
import { PilotLocale, t } from "../i18n";
import { BindingGateIssue } from "./evaluateBindingGate";

const MAX_DETAIL_LINES = 8;

function featureBaseName(featurePath: string): string {
  return path.basename(featurePath).replace(/\.feature$/i, "");
}

function formatIssueLine(locale: PilotLocale, issue: BindingGateIssue): string {
  const prefix =
    issue.status === "unbound"
      ? t(locale, "bindingGate.issueUnbound")
      : t(locale, "bindingGate.issueAmbiguous");
  const line1 = issue.line0 + 1;
  return `${prefix} ${featureBaseName(issue.featurePath)}: line ${line1} — ${issue.stepText}`;
}

export function formatBindingGateModalMessage(
  locale: PilotLocale,
  unboundIssues: BindingGateIssue[],
  ambiguousIssues: BindingGateIssue[],
): string {
  const summary = t(locale, "bindingGate.modalSummary", {
    unbound: String(unboundIssues.length),
    ambiguous: String(ambiguousIssues.length),
    total: String(unboundIssues.length + ambiguousIssues.length),
  });

  const ordered = [...unboundIssues, ...ambiguousIssues];
  const shown = ordered.slice(0, MAX_DETAIL_LINES);
  const lines = shown.map((issue) => formatIssueLine(locale, issue));
  const remaining = ordered.length - shown.length;
  if (remaining > 0) {
    lines.push(t(locale, "bindingGate.modalMore", { count: String(remaining) }));
  }

  return `${summary}\n\n${lines.join("\n")}`;
}
