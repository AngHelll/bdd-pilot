import { Diagnostic } from "../diagnostics/analyzer";
import { diagnosticHint } from "../diagnostics/diagnosticCatalog";
import { pickPrimaryDiagnostic } from "../diagnostics/primaryDiagnostic";
import { PilotLocale } from "../i18n";

export interface DashboardDiagnosticLines {
  titleLine: string;
  detailLine?: string;
  hintLine: string;
}

/** Top diagnostic for dashboard — hidden while a run is active (parity with tree summary). */
export function resolveDashboardPrimaryDiagnostic(
  running: boolean,
  diagnostics: Diagnostic[] | undefined,
): Diagnostic | undefined {
  if (running) {
    return undefined;
  }
  return pickPrimaryDiagnostic(diagnostics ?? []);
}

export function formatDashboardDiagnosticLines(
  diagnostic: Diagnostic,
  locale: PilotLocale,
): DashboardDiagnosticLines {
  const hint =
    diagnostic.hint.trim().length > 0
      ? diagnostic.hint
      : diagnosticHint(locale, diagnostic.code);
  return {
    titleLine: `[${diagnostic.code}] ${diagnostic.title}`,
    detailLine: diagnostic.detail,
    hintLine: hint,
  };
}

export function dashboardDiagnosticSeverityClass(
  diagnostic: Diagnostic,
): "diag-error" | "diag-warning" {
  return diagnostic.severity === "warning" ? "diag-warning" : "diag-error";
}
