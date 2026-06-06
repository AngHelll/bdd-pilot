import * as crypto from "crypto";
import * as vscode from "vscode";
import { PilotLocale, t } from "../core/i18n";
import { formatRollupDescriptionLocalized } from "../core/gherkin/outcomeRollup";
import { DashboardActionsViewModel, DashboardWebviewCommand, parseDashboardWebviewMessage } from "../core/results/dashboardActions";
import { computeDashboardTotals, truncateScopeFilter } from "../core/results/dashboardFormat";
import { isCanceledRun, LastKnownSnapshot, runHistoryStatus } from "../core/results/dashboardLastKnown";
import { formatDuration } from "../core/results/durationFormat";
import { RehydrateNotice } from "../core/results/rehydrateNotice";
import { RunHistoryEntry, flakyRate, scenarioHistoryKey } from "../core/results/runHistory";

export interface DashboardContext {
  lastKnown?: LastKnownSnapshot;
  rehydrateNotice?: RehydrateNotice;
  actions?: DashboardActionsViewModel;
}

export class DashboardPanel {
  private panel: vscode.WebviewPanel | undefined;
  private lastHistory: RunHistoryEntry[] = [];
  private lastContext: DashboardContext = {};
  private messageHandler?: (command: DashboardWebviewCommand) => void;

  setMessageHandler(handler: (command: DashboardWebviewCommand) => void): void {
    this.messageHandler = handler;
  }

  show(history: RunHistoryEntry[], locale: PilotLocale, context: DashboardContext = {}): void {
    this.lastHistory = history;
    this.lastContext = context;
    if (this.panel) {
      this.panel.title = t(locale, "dashboard.panelTitle");
      this.panel.reveal();
      this.panel.webview.html = this.render(history, locale, context);
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      "bddPilot.dashboard",
      t(locale, "dashboard.panelTitle"),
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true },
    );
    this.panel.webview.onDidReceiveMessage((message) => {
      const command = parseDashboardWebviewMessage(message);
      if (command) {
        this.messageHandler?.(command);
      }
    });
    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });
    this.panel.webview.html = this.render(history, locale, context);
  }

  update(history: RunHistoryEntry[], locale: PilotLocale, context: DashboardContext = {}): void {
    this.lastHistory = history;
    this.lastContext = context;
    if (this.panel) {
      this.panel.title = t(locale, "dashboard.panelTitle");
      this.panel.webview.html = this.render(history, locale, context);
    }
  }

  refreshLocale(locale: PilotLocale, context?: DashboardContext): void {
    if (context) {
      this.lastContext = context;
    }
    if (this.panel) {
      this.panel.title = t(locale, "dashboard.panelTitle");
      this.panel.webview.html = this.render(this.lastHistory, locale, this.lastContext);
    }
  }

  private render(
    history: RunHistoryEntry[],
    locale: PilotLocale,
    context: DashboardContext,
  ): string {
    const recent = [...history].reverse().slice(0, 20);
    const totals = computeDashboardTotals(history);
    const flaky = collectFlaky(history);
    const lang = locale === "es" ? "es" : "en";
    const nonce = crypto.randomBytes(16).toString("base64");

    const canceledStat =
      totals.canceled > 0
        ? `<div class="stat"><strong>${totals.canceled}</strong> ${escapeHtml(t(locale, "dashboard.statCanceled"))}</div>`
        : "";

    const rehydrateBanner = context.rehydrateNotice
      ? `<p class="hint">${escapeHtml(
          t(locale, "dashboard.rehydrateNotice", { file: context.rehydrateNotice.trxFileName }),
        )}</p>`
      : "";

    const lastKnownSection = context.lastKnown
      ? renderLastKnownSection(context.lastKnown, locale)
      : "";

    const actionsSection = context.actions
      ? renderActionsSection(context.actions, locale, nonce)
      : "";

    return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <style>
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); padding: 16px; }
    h1 { font-size: 1.4em; margin-bottom: 8px; }
    h2 { font-size: 1.1em; margin-top: 24px; }
    .stats { display: flex; gap: 16px; flex-wrap: wrap; margin: 12px 0; }
    .stat { background: var(--vscode-editor-inactiveSelectionBackground); padding: 12px 16px; border-radius: 6px; min-width: 120px; }
    .stat strong { display: block; font-size: 1.5em; }
    table { border-collapse: collapse; width: 100%; margin-top: 8px; font-size: 0.9em; }
    th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--vscode-panel-border); }
    th { opacity: 0.8; }
    .fail { color: var(--vscode-errorForeground); }
    .pass { color: var(--vscode-testing-iconPassed); }
    .hint { opacity: 0.85; font-size: 0.9em; max-width: 560px; line-height: 1.5; }
    .muted { opacity: 0.75; }
    .canceled-row { opacity: 0.7; }
    .badge { font-size: 0.85em; opacity: 0.9; }
    .last-known { background: var(--vscode-editor-inactiveSelectionBackground); padding: 12px 16px; border-radius: 6px; margin: 12px 0; max-width: 560px; }
    .actions-bar { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0; max-width: 560px; }
    .action-btn {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      border: none;
      padding: 6px 12px;
      border-radius: 2px;
      cursor: pointer;
    }
    .action-btn:hover:not(:disabled) { background: var(--vscode-button-hoverBackground); }
    .action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  </style>
</head>
<body>
  <h1>${escapeHtml(t(locale, "dashboard.title"))}</h1>
  <p>${escapeHtml(t(locale, "dashboard.subtitle"))}</p>
  ${rehydrateBanner}
  <div class="stats">
    <div class="stat"><strong>${totals.runs}</strong> ${escapeHtml(t(locale, "dashboard.statRuns"))}</div>
    <div class="stat"><strong class="pass">${totals.passed}</strong> ${escapeHtml(t(locale, "dashboard.statPassed"))}</div>
    <div class="stat"><strong class="fail">${totals.failed}</strong> ${escapeHtml(t(locale, "dashboard.statFailed"))}</div>
    ${canceledStat}
  </div>
  ${lastKnownSection}
  ${actionsSection}
  <h2>${escapeHtml(t(locale, "dashboard.recentRuns"))}</h2>
  ${recent.length === 0 ? `<p>${escapeHtml(t(locale, "dashboard.noRuns"))}</p><p class="hint">${t(locale, "dashboard.emptyHint")}</p>` : recentRunsTable(recent, locale)}
  <h2>${escapeHtml(t(locale, "dashboard.flakyTitle"))}</h2>
  ${flaky.length === 0 ? `<p>${escapeHtml(t(locale, "dashboard.flakyEmpty"))}</p>` : flakyTable(flaky, locale)}
</body>
</html>`;
  }
}

function renderActionsSection(
  actions: DashboardActionsViewModel,
  locale: PilotLocale,
  nonce: string,
): string {
  if (!actions.target) {
    return "";
  }

  const target = actions.target;
  const when = new Date(target.timestamp).toLocaleString();
  const targetLine = escapeHtml(
    t(locale, "dashboard.actionsTarget", {
      stage: target.stage,
      mode: target.mode,
      failed: target.failed,
      when,
    }),
  );

  const rerunTitle = actions.canRerunFailed
    ? ""
    : ` title="${escapeHtml(t(locale, "dashboard.actionRerunDisabled"))}"`;
  const copyTitle = actions.canCopyForAi
    ? ""
    : ` title="${escapeHtml(t(locale, "dashboard.actionCopyDisabledHistory"))}"`;

  const copyButton = actions.aiEnabled
    ? `<button type="button" class="action-btn" data-command="copyForAi"${copyTitle}${actions.canCopyForAi ? "" : " disabled"}>${escapeHtml(t(locale, "dashboard.actionCopyForAi"))}</button>`
    : "";

  return `<h2>${escapeHtml(t(locale, "dashboard.actionsTitle"))}</h2>
  <div class="actions-bar">
    <button type="button" class="action-btn" data-command="showOutput">${escapeHtml(t(locale, "dashboard.actionShowOutput"))}</button>
    <button type="button" class="action-btn" data-command="rerunFailed"${rerunTitle}${actions.canRerunFailed ? "" : " disabled"}>${escapeHtml(t(locale, "dashboard.actionRerunFailed"))}</button>
    ${copyButton}
  </div>
  <p class="hint muted">${targetLine}</p>
  <script nonce="${nonce}">
    (function() {
      const vscode = acquireVsCodeApi();
      document.querySelectorAll("[data-command]").forEach(function(btn) {
        btn.addEventListener("click", function() {
          if (btn.hasAttribute("disabled")) return;
          vscode.postMessage({ command: btn.getAttribute("data-command") });
        });
      });
    })();
  </script>`;
}

function renderLastKnownSection(snapshot: LastKnownSnapshot, locale: PilotLocale): string {
  const rollup = {
    passed: snapshot.passed,
    failed: snapshot.failed,
    skipped: snapshot.skipped,
    withResults: snapshot.passed + snapshot.failed + snapshot.skipped,
  };
  const body =
    formatRollupDescriptionLocalized(rollup, locale) ??
    t(locale, "dashboard.lastKnownEmpty");

  let provenance: string;
  switch (snapshot.provenance) {
    case "fromRehydrate":
      provenance = t(locale, "dashboard.lastKnownFromRehydrate");
      break;
    case "fromHistory":
      provenance = t(locale, "dashboard.lastKnownFromHistory", {
        when: snapshot.historyTimestamp
          ? new Date(snapshot.historyTimestamp).toLocaleString()
          : "—",
      });
      break;
    default:
      provenance = t(locale, "dashboard.lastKnownFromLiveSession");
  }

  const durationLine =
    snapshot.durationMs !== undefined
      ? `<p class="hint">${escapeHtml(
          t(locale, "dashboard.lastRunDuration", {
            duration: formatDuration(snapshot.durationMs, "auto"),
          }),
        )}</p>`
      : "";

  return `<h2>${escapeHtml(t(locale, "dashboard.lastKnownTitle"))}</h2>
  <div class="last-known">
    <p>${escapeHtml(body)}</p>
    <p class="hint muted">${escapeHtml(provenance)}</p>
    ${durationLine}
  </div>`;
}

function recentRunsTable(runs: RunHistoryEntry[], locale: PilotLocale): string {
  const rows = runs
    .map((r) => {
      const canceled = isCanceledRun(r);
      const rowClass = canceled ? ' class="canceled-row"' : "";
      const envCell = canceled
        ? `${escapeHtml(r.stage)}/${escapeHtml(r.mode)} <span class="badge">(${escapeHtml(t(locale, "dashboard.statusCanceled"))})</span>`
        : `${escapeHtml(r.stage)}/${escapeHtml(r.mode)}`;
      const scope = scopeCell(r, locale);
      return `<tr${rowClass}><td>${new Date(r.timestamp).toLocaleString()}</td><td>${envCell}</td><td>${scope}</td><td class="pass">${r.passed}</td><td class="fail">${r.failed}</td><td>${r.skipped}</td><td title="${r.durationMs ?? ""} ms">${r.durationMs !== undefined ? formatDuration(r.durationMs, "auto") : "—"}</td></tr>`;
    })
    .join("");
  return `<table><thead><tr><th>${t(locale, "dashboard.colWhen")}</th><th>${t(locale, "dashboard.colEnv")}</th><th>${t(locale, "dashboard.colScope")}</th><th>${t(locale, "dashboard.colPass")}</th><th>${t(locale, "dashboard.colFail")}</th><th>${t(locale, "dashboard.colSkip")}</th><th>${t(locale, "dashboard.colDuration")}</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function scopeCell(entry: RunHistoryEntry, locale: PilotLocale): string {
  if (isCanceledRun(entry) && !entry.filter?.trim()) {
    return escapeHtml(t(locale, "dashboard.scopeCanceled"));
  }
  const full = entry.filter?.trim() ?? "";
  const display = truncateScopeFilter(full) || "—";
  const title = full ? ` title="${escapeHtml(full)}"` : "";
  return `<span${title}>${escapeHtml(display)}</span>`;
}

function flakyTable(
  items: { name: string; rate: number; key: string }[],
  locale: PilotLocale,
): string {
  const rows = items
    .map((f) => `<tr><td>${escapeHtml(f.name)}</td><td>${Math.round(f.rate * 100)}%</td></tr>`)
    .join("");
  return `<table><thead><tr><th>${t(locale, "dashboard.colScenario")}</th><th>${t(locale, "dashboard.colFailureRate")}</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function collectFlaky(history: RunHistoryEntry[]): { name: string; rate: number; key: string }[] {
  const keys = new Set<string>();
  for (const entry of history) {
    if (runHistoryStatus(entry) === "canceled") {
      continue;
    }
    for (const s of entry.scenarios) {
      keys.add(scenarioHistoryKey(s.featurePath, s.scenarioLine, s.scenarioName));
    }
  }
  const out: { name: string; rate: number; key: string }[] = [];
  for (const key of keys) {
    const rate = flakyRate(history, key);
    if (rate > 0) {
      const name = key.split("::").pop() ?? key;
      out.push({ name, rate, key });
    }
  }
  return out.sort((a, b) => b.rate - a.rate).slice(0, 10);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
