export type PilotLocale = "en" | "es";
export type LocaleSetting = "auto" | PilotLocale;

/** Resolves effective UI locale from extension setting and VS Code UI language. */
export function resolveLocale(setting: string | undefined, vscodeLanguage?: string): PilotLocale {
  if (setting === "en" || setting === "es") {
    return setting;
  }
  const lang = (vscodeLanguage ?? "en").toLowerCase();
  return lang.startsWith("es") ? "es" : "en";
}
