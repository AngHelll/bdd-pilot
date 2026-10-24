/**
 * Dashboard themes. Editor follows VS Code. Stage is the Forge One dark palette.
 * Outcome ink is pass / fail / warning / muted. Accent is the primary action and links.
 */

export type DashboardTheme = "editor" | "stage";

export const STAGE_BACKGROUNDS = ["#0d1219", "#141d2a", "#1b2636"] as const;

export const STAGE_TOKENS: Record<string, string> = {
  "--pilot-bg": "#0d1219",
  "--pilot-surface": "#141d2a",
  "--pilot-surface-2": "#1b2636",
  "--pilot-surface-3": "#233247",
  "--pilot-border": "#2b3b52",
  "--pilot-border-strong": "#3d5270",
  "--pilot-text": "#e8eef6",
  "--pilot-text-2": "#b8c6d8",
  "--pilot-muted": "#8195ad",
  "--pilot-ok": "#3ddc97",
  "--pilot-danger": "#ff5d73",
  "--pilot-warn": "#f5b83d",
  "--pilot-accent": "#38d6f5",
  "--pilot-accent-ink": "#06202a",
  "--pilot-accent-hover": "#38d6f5",
  "--pilot-button-secondary-bg": "#1b2636",
  "--pilot-button-secondary-fg": "#e8eef6",
  "--pilot-link": "#38d6f5",
  "--pilot-link-hover": "#38d6f5",
  "--pilot-font": '-apple-system, "Segoe UI", system-ui, sans-serif',
  "--pilot-font-size": "13px",
  "--pilot-mono": 'ui-monospace, "SF Mono", Menlo, monospace',
};

export const EDITOR_TOKENS: Record<string, string> = {
  "--pilot-bg": "var(--vscode-editor-background)",
  "--pilot-surface": "var(--vscode-editor-inactiveSelectionBackground, var(--vscode-editor-background))",
  "--pilot-surface-2": "var(--vscode-editorWidget-background, var(--vscode-editor-background))",
  "--pilot-surface-3": "var(--vscode-list-activeSelectionBackground, var(--vscode-editor-inactiveSelectionBackground))",
  "--pilot-border": "var(--vscode-panel-border, var(--vscode-widget-border))",
  "--pilot-border-strong": "var(--vscode-focusBorder)",
  "--pilot-text": "var(--vscode-foreground)",
  "--pilot-text-2": "var(--vscode-descriptionForeground)",
  "--pilot-muted": "var(--vscode-testing-iconSkipped, var(--vscode-descriptionForeground))",
  "--pilot-ok": "var(--vscode-testing-iconPassed)",
  "--pilot-danger": "var(--vscode-testing-iconFailed, var(--vscode-errorForeground))",
  "--pilot-warn": "var(--vscode-editorWarning-foreground)",
  "--pilot-accent": "var(--vscode-button-background)",
  "--pilot-accent-ink": "var(--vscode-button-foreground)",
  "--pilot-accent-hover": "var(--vscode-button-hoverBackground)",
  "--pilot-button-secondary-bg": "var(--vscode-button-secondaryBackground)",
  "--pilot-button-secondary-fg": "var(--vscode-button-secondaryForeground, var(--vscode-foreground))",
  "--pilot-link": "var(--vscode-textLink-foreground)",
  "--pilot-link-hover": "var(--vscode-textLink-activeForeground)",
  "--pilot-font": "var(--vscode-font-family)",
  "--pilot-font-size": "var(--vscode-font-size)",
  "--pilot-mono": 'ui-monospace, "SF Mono", Menlo, monospace',
};

/** Missing or unknown values stay on the editor theme. */
export function resolveDashboardTheme(value: unknown): DashboardTheme {
  return value === "stage" ? "stage" : "editor";
}

export function dashboardStageThemeBlock(): string {
  return themeBlock("stage", STAGE_TOKENS);
}

export function dashboardEditorThemeBlock(): string {
  return themeBlock("editor", EDITOR_TOKENS);
}

export function dashboardThemeCss(): string {
  return `${dashboardStageThemeBlock()}\n${dashboardEditorThemeBlock()}`;
}

export function dashboardLayoutCss(): string {
  return `
body {
  margin: 0;
  padding: 16px 18px 28px;
  font-family: var(--pilot-font);
  font-size: var(--pilot-font-size, 13px);
  color: var(--pilot-text);
  background: var(--pilot-bg);
}
h1 { font-size: 1.35em; font-weight: 600; margin: 0 0 4px; }
h2 { font-size: 0.95em; font-weight: 600; margin: 18px 0 8px; }
#dash-rail h2:first-child { margin-top: 0; }
.subtitle { margin: 0 0 10px; color: var(--pilot-text-2); }
.rehydrate-chip {
  display: inline-block;
  margin: 0 0 12px;
  padding: 4px 10px;
  border: 1px solid var(--pilot-border);
  border-radius: 999px;
  color: var(--pilot-text-2);
  font-size: 12px;
}
.stats { display: flex; flex-wrap: wrap; gap: 10px; margin: 0; }
.stat {
  background: var(--pilot-surface);
  border: 1px solid var(--pilot-border);
  border-radius: 8px;
  padding: 10px 14px;
  min-width: 96px;
}
.stat strong {
  display: block;
  font-size: 1.45em;
  font-variant-numeric: tabular-nums;
  margin-bottom: 2px;
}
.stat span { color: var(--pilot-text-2); font-size: 12px; }
#dash-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(240px, 320px);
  gap: 22px;
  align-items: start;
  margin-top: 18px;
}
#dash-main, #dash-rail { min-width: 0; }
@media (max-width: 760px) {
  #dash-body { grid-template-columns: minmax(0, 1fr); }
}
.card {
  background: var(--pilot-surface);
  border: 1px solid var(--pilot-border);
  border-radius: 8px;
  padding: 12px 14px;
  margin: 0 0 12px;
}
.hint { color: var(--pilot-text-2); font-size: 0.92em; line-height: 1.45; margin: 6px 0; }
.muted { color: var(--pilot-muted); }
.pass { color: var(--pilot-ok); }
.fail { color: var(--pilot-danger); }
.skip { color: var(--pilot-muted); }
.mono { font-family: var(--pilot-mono); font-variant-numeric: tabular-nums; }
.canceled-row { color: var(--pilot-muted); }
.canceled-row .pass { color: var(--pilot-ok); }
.canceled-row .fail { color: var(--pilot-danger); }
.badge { font-size: 0.85em; color: var(--pilot-text-2); }
table { border-collapse: collapse; width: 100%; margin-top: 8px; font-size: 0.92em; }
th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--pilot-border); vertical-align: top; }
th { color: var(--pilot-text-2); font-weight: 600; }
.filters { display: flex; flex-wrap: wrap; gap: 12px 16px; align-items: end; margin: 8px 0 4px; }
.filter-group { display: flex; flex-direction: column; gap: 4px; }
.filter-label { color: var(--pilot-text-2); font-size: 12px; }
.seg { display: inline-flex; flex-wrap: wrap; gap: 4px; }
.seg button, .action-btn, .filter-reset, .flaky-open-btn { font: inherit; cursor: pointer; }
.seg button {
  border: 1px solid var(--pilot-border);
  background: var(--pilot-surface-2);
  color: var(--pilot-text-2);
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
}
.seg button[aria-pressed="true"] {
  background: var(--pilot-surface-3);
  color: var(--pilot-text);
  border-color: var(--pilot-border-strong);
}
.actions-bar { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0; }
.action-btn, .filter-reset {
  color: var(--pilot-button-secondary-fg);
  background: var(--pilot-button-secondary-bg);
  border: 1px solid var(--pilot-border);
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}
.action-btn--primary {
  color: var(--pilot-accent-ink);
  background: var(--pilot-accent);
  border-color: transparent;
}
.action-btn--primary:hover:not(:disabled) { background: var(--pilot-accent-hover); }
.action-btn:disabled, .seg button:disabled { opacity: 0.5; cursor: not-allowed; }
.diagnostic-card.diag-error { border-left: 3px solid var(--pilot-danger); }
.diagnostic-card.diag-warning { border-left: 3px solid var(--pilot-warn); }
.diagnostic-card.diag-error .diag-title { color: var(--pilot-danger); }
.diagnostic-card.diag-warning .diag-title { color: var(--pilot-warn); }
.diag-title { font-weight: 600; margin: 0 0 6px; }
.flaky-open-btn {
  color: var(--pilot-link);
  background: none;
  border: none;
  padding: 0;
  text-align: left;
  text-decoration: underline;
}
.flaky-open-btn:hover { color: var(--pilot-link-hover); }
.flaky-error { max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`.trim();
}

function themeBlock(theme: DashboardTheme, tokens: Record<string, string>): string {
  const body = Object.entries(tokens)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join("\n");
  return `html[data-theme="${theme}"] {\n${body}\n}`;
}
