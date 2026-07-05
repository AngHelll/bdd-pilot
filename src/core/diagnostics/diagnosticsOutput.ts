import { PilotLocale } from "../i18n";
import { Diagnostic } from "./analyzer";
import {
  formatDiagnosticFullLine,
  formatDiagnosticOutputHeader,
  formatDiagnosticSummaryLine,
} from "./diagnosticCatalog";

export type DiagnosticsInOutputMode = "off" | "summary" | "full";

export function formatDiagnosticsOutputLines(
  diagnostics: Diagnostic[],
  mode: DiagnosticsInOutputMode,
  locale: PilotLocale,
): string[] {
  if (mode === "off" || diagnostics.length === 0) {
    return [];
  }

  if (mode === "summary") {
    const top = diagnostics[0];
    const moreCount = diagnostics.length - 1;
    return [
      formatDiagnosticSummaryLine(locale, top.code, top.title, moreCount),
    ];
  }

  const lines = ["", formatDiagnosticOutputHeader(locale)];
  for (const d of diagnostics) {
    lines.push(formatDiagnosticFullLine(locale, d.code, d.title, d.detail, d.hint));
  }
  return lines;
}
