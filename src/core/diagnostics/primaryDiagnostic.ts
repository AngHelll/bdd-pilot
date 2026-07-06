import { Diagnostic } from "./analyzer";

/** Top diagnostic for tree summary and toast — prefers actionable rules over catch-all. */
export function pickPrimaryDiagnostic(diagnostics: Diagnostic[]): Diagnostic | undefined {
  if (diagnostics.length === 0) {
    return undefined;
  }
  const actionable = diagnostics.find((d) => d.code !== "TEST_RUN_FAILED");
  return actionable ?? diagnostics[0];
}
