import { analyzeDotnetOutput, Diagnostic } from "../diagnostics/analyzer";
import { classifyRunCompletion } from "../diagnostics/runOutcomeClass";
import { PilotLocale, t } from "../i18n";
import { UnifiedSummary } from "../results/resultLoader";

export type PostRunFeedbackRequest = Omit<
  PostRunFeedbackInput,
  "locale" | "toastMode" | "canRerunFailed" | "canCopyForAi"
>;

export type PostRunToastMode = "off" | "failures" | "always";

export type PostRunFeedbackAction = "showOutput" | "rerunFailed" | "copyForAi";

export interface PostRunFeedbackInput {
  summary?: UnifiedSummary;
  outputBuffer: string;
  locale: PilotLocale;
  toastMode: PostRunToastMode;
  canceled: boolean;
  debug: boolean;
  exitCode: number | null;
  cancelProgress?: { completed: number; expected: number };
  canRerunFailed: boolean;
  canCopyForAi: boolean;
  /** Used when analyzer finds no rules (e.g. unexpected exception text). */
  fallbackMessage?: string;
}

export interface PostRunFeedbackViewModel {
  message: string;
  severity: "info" | "warning" | "error";
  actions: PostRunFeedbackAction[];
}

/** First actionable diagnostic for toast (excludes catch-all TEST_RUN_FAILED). */
export function findToastDiagnostic(outputBuffer: string): Diagnostic | undefined {
  return analyzeDotnetOutput(outputBuffer).find((d) => d.code !== "TEST_RUN_FAILED");
}

function truncateOneLine(text: string, maxLen: number): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= maxLen) {
    return oneLine;
  }
  return `${oneLine.slice(0, maxLen - 1)}…`;
}

export function formatToastDiagnosticLine(diagnostic: Diagnostic, maxLen = 160): string {
  const base = diagnostic.detail ? `${diagnostic.title} — ${diagnostic.detail}` : diagnostic.title;
  return truncateOneLine(base, maxLen);
}

function severityFromDiagnostic(d: Diagnostic): PostRunFeedbackViewModel["severity"] {
  if (d.severity === "error") {
    return "error";
  }
  if (d.severity === "warning") {
    return "warning";
  }
  return "info";
}

function buildCountLine(summary: UnifiedSummary, locale: PilotLocale): string {
  if (summary.failed > 0) {
    return t(locale, "toast.runSummaryFailures", {
      failed: summary.failed,
      passed: summary.passed,
      total: summary.total,
    });
  }
  return t(locale, "toast.runSummary", {
    failed: summary.failed,
    passed: summary.passed,
    skipped: summary.skipped,
    total: summary.total,
  });
}

function shouldShowCompletedToast(
  input: PostRunFeedbackInput,
  completionKind: ReturnType<typeof classifyRunCompletion>,
): boolean {
  if (input.toastMode === "always") {
    return true;
  }
  if (input.toastMode === "off") {
    return false;
  }
  if ((input.summary?.failed ?? 0) > 0) {
    return true;
  }
  if (completionKind === "infra" || completionKind === "no_results") {
    return true;
  }
  return false;
}

function buildActions(
  input: PostRunFeedbackInput,
  hasFailed: boolean,
  infraError: boolean,
): PostRunFeedbackAction[] {
  const actions: PostRunFeedbackAction[] = ["showOutput"];
  if (input.canRerunFailed && hasFailed) {
    actions.push("rerunFailed");
  }
  if (input.canCopyForAi && (hasFailed || infraError)) {
    actions.push("copyForAi");
  }
  return actions;
}

/**
 * Builds a single post-run toast view model, or undefined when no toast should appear.
 */
export function buildPostRunFeedback(input: PostRunFeedbackInput): PostRunFeedbackViewModel | undefined {
  if (input.debug) {
    return undefined;
  }

  if (input.canceled) {
    if (!input.cancelProgress?.expected) {
      return undefined;
    }
    return {
      message: t(input.locale, "toast.runCanceledPartial", {
        completed: input.cancelProgress.completed,
        expected: input.cancelProgress.expected,
      }),
      severity: "info",
      actions: [],
    };
  }

  if (input.toastMode === "off") {
    return undefined;
  }

  const completionKind = classifyRunCompletion({
    exitCode: input.exitCode,
    canceled: false,
    summary: input.summary,
    outputBuffer: input.outputBuffer,
  });

  if (!shouldShowCompletedToast(input, completionKind)) {
    return undefined;
  }

  const toastDiagnostic = findToastDiagnostic(input.outputBuffer);
  const hasFailed = (input.summary?.failed ?? 0) > 0;
  const isInfra = completionKind === "infra" || completionKind === "no_results";
  const infraError = isInfra && toastDiagnostic?.severity === "error";

  if (input.summary && input.summary.total > 0) {
    const countLine = buildCountLine(input.summary, input.locale);
    const diagLine = toastDiagnostic ? formatToastDiagnosticLine(toastDiagnostic) : undefined;
    const message = diagLine ? `${countLine}\n${diagLine}` : countLine;
    return {
      message,
      severity: hasFailed ? "warning" : "info",
      actions: buildActions(input, hasFailed, infraError),
    };
  }

  if (toastDiagnostic) {
    return {
      message: formatToastDiagnosticLine(toastDiagnostic),
      severity: severityFromDiagnostic(toastDiagnostic),
      actions: buildActions(input, false, toastDiagnostic.severity === "error"),
    };
  }

  if (input.fallbackMessage) {
    return {
      message: input.fallbackMessage,
      severity: "error",
      actions: ["showOutput"],
    };
  }

  if (isInfra) {
    return {
      message: t(input.locale, "toast.runInfraFallback"),
      severity: "error",
      actions: buildActions(input, false, true),
    };
  }

  if (input.toastMode === "always" && input.summary) {
    const countLine = buildCountLine(input.summary, input.locale);
    return {
      message: countLine,
      severity: "info",
      actions: ["showOutput"],
    };
  }

  return undefined;
}
