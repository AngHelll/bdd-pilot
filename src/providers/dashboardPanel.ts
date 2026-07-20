import * as crypto from "crypto";
import * as vscode from "vscode";
import { Diagnostic } from "../core/diagnostics/analyzer";
import { PilotLocale, t } from "../core/i18n";
import { formatRollupDescriptionLocalized } from "../core/gherkin/outcomeRollup";
import {
  DashboardActionsViewModel,
  DashboardWebviewCommand,
  parseDashboardWebviewMessage,
} from "../core/results/dashboardActions";
import {
  buildFlakyDashboardRows,
  FlakyDashboardRow,
  FlakyOpenTarget,
  parseFlakyOpenMessage,
} from "../core/results/flakyDashboard";
import {
  DEFAULT_DASHBOARD_HISTORY_FILTER,
  DashboardHistoryFilter,
  filterRunHistory,
  listHistoryStages,
  parseDashboardHistoryFilterMessage,
} from "../core/results/dashboardHistoryFilter";
import {
  dashboardDiagnosticSeverityClass,
  formatDashboardDiagnosticLines,
} from "../core/results/dashboardDiagnostic";
import { computeDashboardTotals, formatHistoryScopeDisplay } from "../core/results/dashboardFormat";
import { isCanceledRun, LastKnownSnapshot } from "../core/results/dashboardLastKnown";
import { formatDuration } from "../core/results/durationFormat";
import { RehydrateNotice } from "../core/results/rehydrateNotice";
import { RunHistoryEntry, runKindBadgeKind } from "../core/results/runHistory";

export interface DashboardContext {
  lastKnown?: LastKnownSnapshot;
  rehydrateNotice?: RehydrateNotice;
  actions?: DashboardActionsViewModel;
  primaryDiagnostic?: Diagnostic;
}

export class DashboardPanel {
  private panel: vscode.WebviewPanel | undefined;
  private lastHistory: RunHistoryEntry[] = [];
  private lastContext: DashboardContext = {};
  private lastLocale: PilotLocale = "en";
  private historyFilter: DashboardHistoryFilter = { ...DEFAULT_DASHBOARD_HISTORY_FILTER };
  private messageHandler?: (command: DashboardWebviewCommand) => void;
  private flakyOpenHandler?: (target: FlakyOpenTarget) => void;

  setMessageHandler(handler: (command: DashboardWebviewCommand) => void): void {
    this.messageHandler = handler;
  }

  setFlakyOpenHandler(handler: (target: FlakyOpenTarget) => void): void {
    this.flakyOpenHandler = handler;
  }

  show(history: RunHistoryEntry[], locale: PilotLocale, context: DashboardContext = {}): void {
    this.lastHistory = history;
    this.lastContext = context;
    this.lastLocale = locale;
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
      const filter = parseDashboardHistoryFilterMessage(message);
      if (filter) {
        this.historyFilter = filter;
        if (this.panel) {
          this.panel.webview.html = this.render(this.lastHistory, this.lastLocale, this.lastContext);
        }
        return;
      }
      const flakyTarget = parseFlakyOpenMessage(message);
      if (flakyTarget) {
        this.flakyOpenHandler?.(flakyTarget);
        return;
      }
      const command = parseDashboardWebviewMessage(message);
      if (command) {
        this.messageHandler?.(command);
      }
    });
    this.panel.onDidDispose(() => {
      this.panel = undefined;
      this.historyFilter = { ...DEFAULT_DASHBOARD_HISTORY_FILTER };
    });
    this.panel.webview.html = this.render(history, locale, context);
  }

  update(history: RunHistoryEntry[], locale: PilotLocale, context: DashboardContext = {}): void {
    this.lastHistory = history;
    this.lastContext = context;
    this.lastLocale = locale;
    if (this.panel) {
      this.panel.title = t(locale, "dashboard.panelTitle");
      this.panel.webview.html = this.render(history, locale, context);
    }
  }

  refreshLocale(locale: PilotLocale, context?: DashboardContext): void {
    this.lastLocale = locale;
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
    const filtered = filterRunHistory(history, this.historyFilter);
    const recent = [...filtered].reverse().slice(0, 20);
    const totals = computeDashboardTotals(history);
    const flaky = buildFlakyDashboardRows(history);
    const lang = locale === "es" ? "es" : "en";
    const nonce = crypto.randomBytes(16).toString("base64");
    const stages = listHistoryStages(history);

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

    const primaryDiagnosticSection = context.primaryDiagnostic
      ? renderPrimaryDiagnosticSection(context.primaryDiagnostic, locale)
      : "";

    const actionsSection = context.actions
      ? renderActionsSection(context.actions, locale)
      : "";
    const flakySection =
      flaky.length === 0
        ? `<p>${escapeHtml(t(locale, "dashboard.flakyEmpty"))}</p>`
        : flakyTable(flaky, locale);

    const filterBar = renderHistoryFilterBar(stages, this.historyFilter, locale);
    const recentSection =
      history.length === 0
        ? `<p>${escapeHtml(t(locale, "dashboard.noRuns"))}</p><p class="hint">${t(locale, "dashboard.emptyHint")}</p>`
        : recent.length === 0
          ? `<p class="hint">${escapeHtml(t(locale, "dashboard.filterNoMatches"))}</p>`
          : recentRunsTable(recent, locale);

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
    .diagnostic-card { background: var(--vscode-editor-inactiveSelectionBackground); padding: 12px 16px; border-radius: 6px; margin: 12px 0; max-width: 560px; }
    .diagnostic-card .diag-title { font-weight: 600; margin: 0 0 6px 0; }
    .diagnostic-card.diag-error { border-left: 3px solid var(--vscode-errorForeground); }
    .diagnostic-card.diag-warning { border-left: 3px solid var(--vscode-editorWarning-foreground); }
    .diagnostic-card.diag-error .diag-title { color: var(--vscode-errorForeground); }
    .diagnostic-card.diag-warning .diag-title { color: var(--vscode-editorWarning-foreground); }
    .flaky-open-btn {
      font-family: var(--vscode-font-family);
      font-size: inherit;
      color: var(--vscode-textLink-foreground);
      background: none;
      border: none;
      padding: 0;
      cursor: pointer;
      text-align: left;
      text-decoration: underline;
    }
    .flaky-open-btn:hover { color: var(--vscode-textLink-activeForeground); }
    .flaky-error { max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .filters { display: flex; flex-wrap: wrap; gap: 12px; align-items: end; margin: 8px 0 4px; max-width: 720px; }
    .filters label { display: flex; flex-direction: column; gap: 4px; font-size: 0.85em; opacity: 0.9; }
    .filters select, .filters button {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-dropdown-foreground);
      background: var(--vscode-dropdown-background);
      border: 1px solid var(--vscode-dropdown-border);
      padding: 4px 8px;
    }
    .filters button { cursor: pointer; color: var(--vscode-button-foreground); background: var(--vscode-button-secondaryBackground); border: none; }
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
  ${primaryDiagnosticSection}
  ${lastKnownSection}
  ${actionsSection}
  <h2>${escapeHtml(t(locale, "dashboard.recentRuns"))}</h2>
  ${filterBar}
  ${recentSection}
  <h2>${escapeHtml(t(locale, "dashboard.flakyTitle"))}</h2>
  ${flakySection}
  ${renderDashboardScript(nonce)}
</body>
</html>`;
  }
}

function renderHistoryFilterBar(
  stages: string[],
  filter: DashboardHistoryFilter,
  locale: PilotLocale,
): string {
  const stageValue = filter.stage && filter.stage !== "all" ? filter.stage : "all";
  const outcome = filter.outcome ?? "all";
  const runKind = filter.runKind && filter.runKind !== "all" ? filter.runKind : "all";
  const stageOptions = [
    `<option value="all"${stageValue === "all" ? " selected" : ""}>${escapeHtml(t(locale, "dashboard.filterAll"))}</option>`,
    ...stages.map(
      (s) =>
        `<option value="${escapeAttr(s)}"${s === stageValue ? " selected" : ""}>${escapeHtml(s)}</option>`,
    ),
  ].join("");

  return `<div class="filters" id="history-filters">
  <label>${escapeHtml(t(locale, "dashboard.filterStage"))}
    <select data-filter="stage">${stageOptions}</select>
  </label>
  <label>${escapeHtml(t(locale, "dashboard.filterOutcome"))}
    <select data-filter="outcome">
      <option value="all"${outcome === "all" ? " selected" : ""}>${escapeHtml(t(locale, "dashboard.filterAll"))}</option>
      <option value="any_failure"${outcome === "any_failure" ? " selected" : ""}>${escapeHtml(t(locale, "dashboard.filterAnyFailure"))}</option>
      <option value="all_passed"${outcome === "all_passed" ? " selected" : ""}>${escapeHtml(t(locale, "dashboard.filterAllPassed"))}</option>
      <option value="canceled"${outcome === "canceled" ? " selected" : ""}>${escapeHtml(t(locale, "dashboard.filterCanceled"))}</option>
    </select>
  </label>
  <label>${escapeHtml(t(locale, "dashboard.filterRunKind"))}
    <select data-filter="runKind">
      <option value="all"${runKind === "all" ? " selected" : ""}>${escapeHtml(t(locale, "dashboard.filterAll"))}</option>
      <option value="run"${runKind === "run" ? " selected" : ""}>${escapeHtml(t(locale, "dashboard.filterRun"))}</option>
      <option value="debug"${runKind === "debug" ? " selected" : ""}>${escapeHtml(t(locale, "dashboard.runKind.debug"))}</option>
      <option value="profile"${runKind === "profile" ? " selected" : ""}>${escapeHtml(t(locale, "dashboard.runKind.profile"))}</option>
    </select>
  </label>
  <button type="button" id="reset-history-filters">${escapeHtml(t(locale, "dashboard.filterReset"))}</button>
</div>`;
}

function renderPrimaryDiagnosticSection(diagnostic: Diagnostic, locale: PilotLocale): string {
  const lines = formatDashboardDiagnosticLines(diagnostic, locale);
  const severityClass = dashboardDiagnosticSeverityClass(diagnostic);
  const detailLine = lines.detailLine
    ? `<p class="hint">${escapeHtml(lines.detailLine)}</p>`
    : "";

  return `<h2>${escapeHtml(t(locale, "dashboard.primaryDiagnosticTitle"))}</h2>
  <div class="diagnostic-card ${severityClass}">
    <p class="diag-title">${escapeHtml(lines.titleLine)}</p>
    ${detailLine}
    <p class="hint">${escapeHtml(lines.hintLine)}</p>
  </div>`;
}

function renderActionsSection(
  actions: DashboardActionsViewModel,
  locale: PilotLocale,
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
  <p class="hint muted">${targetLine}</p>`;
}

/** Single webview script — acquireVsCodeApi() may only be called once per page load. */
function renderDashboardScript(nonce: string): string {
  return `<script nonce="${nonce}">
    (function() {
      const vscode = acquireVsCodeApi();
      function postFilters() {
        const root = document.getElementById("history-filters");
        if (!root) return;
        const stage = root.querySelector('[data-filter="stage"]');
        const outcome = root.querySelector('[data-filter="outcome"]');
        const runKind = root.querySelector('[data-filter="runKind"]');
        vscode.postMessage({
          type: "filterHistory",
          stage: stage ? stage.value : "all",
          outcome: outcome ? outcome.value : "all",
          runKind: runKind ? runKind.value : "all",
        });
      }
      document.querySelectorAll("#history-filters select").forEach(function(el) {
        el.addEventListener("change", postFilters);
      });
      var reset = document.getElementById("reset-history-filters");
      if (reset) {
        reset.addEventListener("click", function() {
          vscode.postMessage({ type: "filterHistory", stage: "all", outcome: "all", runKind: "all" });
        });
      }
      document.querySelectorAll("[data-command]").forEach(function(btn) {
        btn.addEventListener("click", function() {
          if (btn.hasAttribute("disabled")) return;
          vscode.postMessage({ command: btn.getAttribute("data-command") });
        });
      });
      document.querySelectorAll(".flaky-open-btn").forEach(function(btn) {
        btn.addEventListener("click", function() {
          vscode.postMessage({
            command: "openFlakyScenario",
            featurePath: btn.getAttribute("data-feature-path"),
            scenarioLine: parseInt(btn.getAttribute("data-scenario-line") || "0", 10),
          });
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
      const badges: string[] = [];
      const kindBadge = runKindBadgeKind(r);
      if (kindBadge === "debug") {
        badges.push(`<span class="badge">${escapeHtml(t(locale, "dashboard.runKind.debug"))}</span>`);
      } else if (kindBadge === "profile") {
        badges.push(`<span class="badge">${escapeHtml(t(locale, "dashboard.runKind.profile"))}</span>`);
      }
      if (canceled) {
        badges.push(`<span class="badge">(${escapeHtml(t(locale, "dashboard.statusCanceled"))})</span>`);
      }
      const badgeHtml = badges.length > 0 ? ` ${badges.join(" ")}` : "";
      const envCell = `${escapeHtml(r.stage)}/${escapeHtml(r.mode)}${badgeHtml}`;
      const scope = scopeCell(r, locale);
      return `<tr${rowClass}><td>${new Date(r.timestamp).toLocaleString()}</td><td>${envCell}</td><td>${scope}</td><td class="pass">${r.passed}</td><td class="fail">${r.failed}</td><td>${r.skipped}</td><td title="${r.durationMs ?? ""} ms">${r.durationMs !== undefined ? formatDuration(r.durationMs, "auto") : "—"}</td></tr>`;
    })
    .join("");
  return `<table><thead><tr><th>${t(locale, "dashboard.colWhen")}</th><th>${t(locale, "dashboard.colEnv")}</th><th>${t(locale, "dashboard.colScope")}</th><th>${t(locale, "dashboard.colPass")}</th><th>${t(locale, "dashboard.colFail")}</th><th>${t(locale, "dashboard.colSkip")}</th><th>${t(locale, "dashboard.colDuration")}</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function scopeCell(entry: RunHistoryEntry, locale: PilotLocale): string {
  const display = formatHistoryScopeDisplay(entry, locale);
  const full = entry.scopeLabel?.trim() || entry.filter?.trim() || "";
  const title = full && full !== display ? ` title="${escapeHtml(full)}"` : "";
  return `<span${title}>${escapeHtml(display)}</span>`;
}

function flakyTable(rows: FlakyDashboardRow[], locale: PilotLocale): string {
  const body = rows
    .map((row) => {
      const scenarioCell = row.canOpen
        ? `<button type="button" class="flaky-open-btn" data-feature-path="${escapeAttr(row.featurePath)}" data-scenario-line="${row.scenarioLine}">${escapeHtml(row.scenarioName)}</button>`
        : escapeHtml(row.scenarioName);
      const avgDuration =
        row.averageDurationMs !== undefined
          ? formatDuration(row.averageDurationMs, "auto")
          : "—";
      const errorCell = row.lastErrorSnippet
        ? `<td class="flaky-error" title="${escapeAttr(row.lastErrorSnippet.slice(0, 500))}">${escapeHtml(row.lastErrorSnippet)}</td>`
        : `<td class="muted">${escapeHtml(t(locale, "dashboard.flakyNoError"))}</td>`;
      return `<tr><td>${scenarioCell}</td><td>${Math.round(row.failureRate * 100)}%</td><td>${escapeHtml(avgDuration)}</td>${errorCell}</tr>`;
    })
    .join("");
  return `<table><thead><tr><th>${t(locale, "dashboard.colScenario")}</th><th>${t(locale, "dashboard.colFailureRate")}</th><th>${t(locale, "dashboard.colAvgDuration")}</th><th>${t(locale, "dashboard.colLastError")}</th></tr></thead><tbody>${body}</tbody></table>`;
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
