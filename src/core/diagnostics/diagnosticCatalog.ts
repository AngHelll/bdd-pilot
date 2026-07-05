import { MessageKey, PilotLocale, t } from "../i18n";

export function diagnosticHint(locale: PilotLocale, code: string): string {
  return t(locale, `diagnostic.${code}.hint` as MessageKey);
}

export function formatDiagnosticOutputHeader(locale: PilotLocale): string {
  return t(locale, "diagnostic.output.header");
}

export function formatDiagnosticSummaryLine(
  locale: PilotLocale,
  code: string,
  title: string,
  moreCount: number,
): string {
  if (moreCount > 0) {
    return t(locale, "diagnostic.output.summaryLine", { code, title, more: moreCount });
  }
  return t(locale, "diagnostic.output.summaryLineSingle", { code, title });
}

export function formatDiagnosticFullLine(
  locale: PilotLocale,
  code: string,
  title: string,
  detail: string | undefined,
  hint: string,
): string {
  const detailPart = detail ? `\n    ${detail}` : "";
  const hintPrefix = t(locale, "diagnostic.output.hintPrefix");
  return `  • [${code}] ${title}${detailPart}\n    ${hintPrefix} ${hint}`;
}
