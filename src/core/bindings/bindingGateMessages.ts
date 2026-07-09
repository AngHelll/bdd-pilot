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

function formatDetailLines(locale: PilotLocale, issues: BindingGateIssue[]): string[] {
  const shown = issues.slice(0, MAX_DETAIL_LINES);
  const lines = shown.map((issue) => formatIssueLine(locale, issue));
  const remaining = issues.length - shown.length;
  if (remaining > 0) {
    lines.push(t(locale, "bindingGate.modalMore", { count: String(remaining) }));
  }
  return lines;
}

/** Ambiguous-only binding issues for the BDD Pilot Output channel (no modal). */
export function formatBindingGateAmbiguousOutput(
  locale: PilotLocale,
  ambiguousIssues: BindingGateIssue[],
): string {
  const summary = t(locale, "bindingGate.outputAmbiguousSummary", {
    count: String(ambiguousIssues.length),
  });
  return `${summary}\n${formatDetailLines(locale, ambiguousIssues).join("\n")}`;
}

export interface BindingGateUnboundPromptOptions {
  preflightTitle?: boolean;
}

/** Unbound issues for pre-run warn notification or block modal. */
export function formatBindingGateUnboundPrompt(
  locale: PilotLocale,
  unboundIssues: BindingGateIssue[],
  options?: BindingGateUnboundPromptOptions,
): string {
  const summary = t(locale, "bindingGate.promptUnboundSummary", {
    count: String(unboundIssues.length),
  });
  const body = `${summary}\n\n${formatDetailLines(locale, unboundIssues).join("\n")}`;
  if (options?.preflightTitle) {
    const title = t(locale, "bindingGate.preflightTitle");
    return `${title}\n\n${body}`;
  }
  return body;
}
