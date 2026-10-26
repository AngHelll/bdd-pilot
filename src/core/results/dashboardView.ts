import { Diagnostic } from "../diagnostics/analyzer";
import { PilotLocale, t } from "../i18n";
import { canClearDashboardHistory, DashboardActionsViewModel } from "./dashboardActions";
import { buildDashboardHistoryBars, renderDashboardHistoryChart } from "./dashboardChart";
import {
  dashboardDiagnosticSeverityClass,
  formatDashboardDiagnosticLines,
} from "./dashboardDiagnostic";
import { computeDashboardTotals, formatHistoryScopeDisplay } from "./dashboardFormat";
import {
  DashboardHistoryFilter,
  filterRunHistory,
  listHistoryStages,
} from "./dashboardHistoryFilter";
import { formatDashboardScenarioLabel } from "./dashboardExampleLabel";
import {
  presentHistoryTotalsLine,
  presentLatestRun,
} from "./dashboardLatestRun";
import {
  formatTrxDivergenceTooltip,
  isCanceledRun,
  LastKnownSnapshot,
} from "./dashboardLastKnown";
import { formatDuration } from "./durationFormat";
import { buildFlakyDashboardRows, FlakyDashboardRow } from "./flakyDashboard";
import { RehydrateNotice } from "./rehydrateNotice";
import { RunHistoryEntry, runKindBadgeKind } from "./runHistory";
import {
  DashboardTheme,
  dashboardLayoutCss,
  dashboardThemeCss,
  resolveDashboardTheme,
} from "./dashboardTheme";

export { resolveDashboardTheme };
export type { DashboardTheme };

export interface DashboardViewContext {
  lastKnown?: LastKnownSnapshot;
  rehydrateNotice?: RehydrateNotice;
  actions?: DashboardActionsViewModel;
  primaryDiagnostic?: Diagnostic;
  running?: boolean;
}

export interface DashboardViewInput {
  history: RunHistoryEntry[];
  filter: DashboardHistoryFilter;
  locale: PilotLocale;
  context: DashboardViewContext;
}

export interface DashboardRegions {
  header: string;
  main: string;
  rail: string;
}

export type DashboardPaint = "shell" | "patch";

/** False until the webview document exists. Later updates patch that document. */
export function dashboardPaintKind(hasDocument: boolean): DashboardPaint {
  return hasDocument ? "patch" : "shell";
}

export interface DashboardApplyPayload {
  type: "apply";
  theme: DashboardTheme;
  lang: "en" | "es";
  header: string;
  main: string;
  rail: string;
  runsTabLabel: string;
  detailTabLabel: string;
}

export function dashboardTabLabels(locale: PilotLocale): { runs: string; detail: string } {
  return {
    runs: t(locale, "dashboard.tabRuns"),
    detail: t(locale, "dashboard.tabDetail"),
  };
}

export function dashboardApplyPayload(
  theme: DashboardTheme,
  lang: "en" | "es",
  regions: DashboardRegions,
  tabs: { runs: string; detail: string },
): DashboardApplyPayload {
  return {
    type: "apply",
    theme,
    lang,
    header: regions.header,
    main: regions.main,
    rail: regions.rail,
    runsTabLabel: tabs.runs,
    detailTabLabel: tabs.detail,
  };
}

/** Totals use the full history. The table is the filtered history, newest first, capped at 20. */
export function buildDashboardRegions(input: DashboardViewInput): DashboardRegions {
  const { history, filter, locale, context } = input;
  const filtered = filterRunHistory(history, filter);
  const recent = [...filtered].reverse().slice(0, 20);
  const totals = computeDashboardTotals(history);
  const flaky = buildFlakyDashboardRows(history);
  const stages = listHistoryStages(history);

  const rehydrateChip = context.rehydrateNotice
    ? `<p class="rehydrate-chip">${escapeHtml(
        t(locale, "dashboard.rehydrateNotice", { file: context.rehydrateNotice.trxFileName }),
      )}</p>`
    : "";

  const recentSection =
    history.length === 0
      ? `<p>${escapeHtml(t(locale, "dashboard.noRuns"))}</p><p class="hint">${
          // Authored markup (<strong>) in the catalog string. Not user data.
          t(locale, "dashboard.emptyHint")
        }</p>`
      : recent.length === 0
        ? `<p class="hint">${escapeHtml(t(locale, "dashboard.filterNoMatches"))}</p>`
        : recentRunsTable(recent, locale);

  const flakySection =
    flaky.length === 0
      ? `<p>${escapeHtml(t(locale, "dashboard.flakyEmpty"))}</p>`
      : flakyTable(flaky, locale);

  const bars = buildDashboardHistoryBars(recent);
  const chart =
    bars.length === 0
      ? ""
      : renderDashboardHistoryChart(bars, t(locale, "dashboard.chartLabel", { count: bars.length }), (bar) =>
          t(locale, "dashboard.chartBar", {
            passed: bar.passed,
            failed: bar.failed,
            skipped: bar.skipped,
          }),
        );
  const clearDisabled = canClearDashboardHistory(context.running === true) ? "" : " disabled";
  const clearButton =
    history.length === 0
      ? ""
      : `<button type="button" class="action-btn action-btn--aside" data-command="clearHistory"${clearDisabled}>${escapeHtml(t(locale, "dashboard.clearHistory"))}</button>`;
  const latest = presentLatestRun(context.lastKnown);
  const historyLine = presentHistoryTotalsLine(totals, locale);

  return {
    header: `<div class="dash-top">
  <div class="dash-top__copy">
    <h1>${escapeHtml(t(locale, "dashboard.title"))}</h1>
    <p class="subtitle">${escapeHtml(t(locale, "dashboard.subtitle"))}</p>
    ${rehydrateChip}
  </div>
  ${latest ? renderLatestStats(latest, locale) : ""}
  ${clearButton}
</div>
${latest ? renderLatestMeta(latest, locale) : ""}
${historyLine ? `<p class="history-totals">${escapeHtml(historyLine)}</p>` : ""}
${chart}`,
    main: `<h2>${escapeHtml(t(locale, "dashboard.recentRuns"))}</h2>
${renderHistoryFilterBar(stages, filter, locale)}
${recentSection}`,
    rail: `${context.primaryDiagnostic ? renderPrimaryDiagnosticSection(context.primaryDiagnostic, locale) : ""}
${context.actions ? renderActionsSection(context.actions, locale) : ""}
<h2>${escapeHtml(t(locale, "dashboard.flakyTitle"))}</h2>
${flakySection}`,
  };
}

export function renderDashboardShell(input: {
  nonce: string;
  lang: "en" | "es";
  theme: DashboardTheme;
  regions: DashboardRegions;
  runsTabLabel: string;
  detailTabLabel: string;
}): string {
  const { nonce, lang, theme, regions, runsTabLabel, detailTabLabel } = input;
  return `<!DOCTYPE html>
<html lang="${lang}" data-theme="${theme}">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <style>
${dashboardThemeCss()}
${dashboardLayoutCss()}
  </style>
</head>
<body>
  <div id="dash-header">${regions.header}</div>
  <div id="dash-tabs" role="tablist">
    <button type="button" id="dash-tab-runs" role="tab" data-tab="runs" aria-selected="true">${escapeHtml(runsTabLabel)}</button>
    <button type="button" id="dash-tab-detail" role="tab" data-tab="detail" aria-selected="false">${escapeHtml(detailTabLabel)}</button>
  </div>
  <div id="dash-body" data-tab="runs">
    <main id="dash-main">${regions.main}</main>
    <aside id="dash-rail">${regions.rail}</aside>
  </div>
  ${renderDashboardScript(nonce)}
</body>
</html>`;
}

function renderHistoryFilterBar(
  stages: string[],
  filter: DashboardHistoryFilter,
  locale: PilotLocale,
): string {
  const stageValue = filter.stage && filter.stage !== "all" ? filter.stage : "all";
  const outcome = filter.outcome ?? "all";
  const runKind = filter.runKind && filter.runKind !== "all" ? filter.runKind : "all";

  const stageButtons = [
    filterButton("stage", "all", t(locale, "dashboard.filterAll"), stageValue === "all"),
    ...stages.map((stage) => filterButton("stage", stage, stage, stage === stageValue)),
  ].join("");

  const outcomeButtons = [
    filterButton("outcome", "all", t(locale, "dashboard.filterAll"), outcome === "all"),
    filterButton("outcome", "any_failure", t(locale, "dashboard.filterAnyFailure"), outcome === "any_failure"),
    filterButton("outcome", "all_passed", t(locale, "dashboard.filterAllPassed"), outcome === "all_passed"),
    filterButton("outcome", "canceled", t(locale, "dashboard.filterCanceled"), outcome === "canceled"),
  ].join("");

  const runKindButtons = [
    filterButton("runKind", "all", t(locale, "dashboard.filterAll"), runKind === "all"),
    filterButton("runKind", "run", t(locale, "dashboard.filterRun"), runKind === "run"),
    filterButton("runKind", "debug", t(locale, "dashboard.runKind.debug"), runKind === "debug"),
    filterButton("runKind", "profile", t(locale, "dashboard.runKind.profile"), runKind === "profile"),
  ].join("");

  return `<div class="filters" id="history-filters">
  ${filterGroup("stage", t(locale, "dashboard.filterStage"), stageButtons)}
  ${filterGroup("outcome", t(locale, "dashboard.filterOutcome"), outcomeButtons)}
  ${filterGroup("runKind", t(locale, "dashboard.filterRunKind"), runKindButtons)}
  <button type="button" class="filter-reset" id="reset-history-filters">${escapeHtml(t(locale, "dashboard.filterReset"))}</button>
</div>`;
}

function filterGroup(name: string, label: string, buttons: string): string {
  return `<div class="filter-group" role="group" aria-label="${escapeAttr(label)}" data-filter-group="${escapeAttr(name)}">
  <span class="filter-label">${escapeHtml(label)}</span>
  <div class="seg">${buttons}</div>
</div>`;
}

function filterButton(name: string, value: string, label: string, pressed: boolean): string {
  return `<button type="button" data-filter="${escapeAttr(name)}" data-value="${escapeAttr(value)}" aria-pressed="${pressed ? "true" : "false"}">${escapeHtml(label)}</button>`;
}

function renderPrimaryDiagnosticSection(diagnostic: Diagnostic, locale: PilotLocale): string {
  const lines = formatDashboardDiagnosticLines(diagnostic, locale);
  const severityClass = dashboardDiagnosticSeverityClass(diagnostic);
  const detailLine = lines.detailLine
    ? `<p class="hint">${escapeHtml(lines.detailLine)}</p>`
    : "";

  return `<h2>${escapeHtml(t(locale, "dashboard.primaryDiagnosticTitle"))}</h2>
  <div class="card diagnostic-card ${severityClass}">
    <p class="diag-title">${escapeHtml(lines.titleLine)}</p>
    ${detailLine}
    <p class="hint">${escapeHtml(lines.hintLine)}</p>
  </div>`;
}

function renderActionsSection(actions: DashboardActionsViewModel, locale: PilotLocale): string {
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
    : ` title="${escapeAttr(t(locale, "dashboard.actionRerunDisabled"))}"`;
  const copyTitle = actions.canCopyForAi
    ? ""
    : ` title="${escapeAttr(t(locale, "dashboard.actionCopyDisabledHistory"))}"`;

  const copyButton = actions.aiEnabled
    ? `<button type="button" class="action-btn" data-command="copyForAi"${copyTitle}${actions.canCopyForAi ? "" : " disabled"}>${escapeHtml(t(locale, "dashboard.actionCopyForAi"))}</button>`
    : "";

  return `<h2>${escapeHtml(t(locale, "dashboard.actionsTitle"))}</h2>
  <div class="actions-bar">
    <button type="button" class="action-btn" data-command="showOutput">${escapeHtml(t(locale, "dashboard.actionShowOutput"))}</button>
    <button type="button" class="action-btn action-btn--primary" data-command="rerunFailed"${rerunTitle}${actions.canRerunFailed ? "" : " disabled"}>${escapeHtml(t(locale, "dashboard.actionRerunFailed"))}</button>
    ${copyButton}
  </div>
  <p class="hint muted">${targetLine}</p>`;
}

function renderLatestStats(
  latest: NonNullable<ReturnType<typeof presentLatestRun>>,
  locale: PilotLocale,
): string {
  const trxTitle = latest.trxDiverges
    ? ` title="${escapeAttr(formatTrxDivergenceTooltip(locale))}"`
    : "";
  return `<div class="stats stats--latest"${trxTitle}>
    <div class="stat"><strong class="pass">${latest.passed}</strong> <span>${escapeHtml(t(locale, "dashboard.latestPassed"))}</span></div>
    <div class="stat"><strong class="fail">${latest.failed}</strong> <span>${escapeHtml(t(locale, "dashboard.latestFailed"))}</span></div>
    <div class="stat"><strong class="skip">${latest.skipped}</strong> <span>${escapeHtml(t(locale, "dashboard.latestSkipped"))}</span></div>
  </div>`;
}

function renderLatestMeta(
  latest: NonNullable<ReturnType<typeof presentLatestRun>>,
  locale: PilotLocale,
): string {
  let provenance: string;
  switch (latest.provenance) {
    case "fromRehydrate":
      provenance = t(locale, "dashboard.lastKnownFromRehydrate");
      break;
    case "fromHistory":
      provenance = t(locale, "dashboard.lastKnownFromHistory", {
        when: latest.historyTimestamp
          ? new Date(latest.historyTimestamp).toLocaleString()
          : "—",
      });
      break;
    default:
      provenance = t(locale, "dashboard.lastKnownFromLiveSession");
  }

  const durationLine = latest.durationLabel
    ? `<p class="hint mono">${escapeHtml(
        t(locale, "dashboard.lastRunDuration", { duration: latest.durationLabel }),
      )}</p>`
    : "";

  return `<p class="hint latest-provenance">${escapeHtml(provenance)}</p>
${durationLine}`;
}

function recentRunsTable(runs: RunHistoryEntry[], locale: PilotLocale): string {
  const rows = runs
    .map((entry) => {
      const canceled = isCanceledRun(entry);
      const rowClass = canceled ? ' class="canceled-row"' : "";
      const badges: string[] = [];
      const kindBadge = runKindBadgeKind(entry);
      if (kindBadge === "debug") {
        badges.push(`<span class="badge">${escapeHtml(t(locale, "dashboard.runKind.debug"))}</span>`);
      } else if (kindBadge === "profile") {
        badges.push(`<span class="badge">${escapeHtml(t(locale, "dashboard.runKind.profile"))}</span>`);
      }
      if (canceled) {
        badges.push(`<span class="badge">(${escapeHtml(t(locale, "dashboard.statusCanceled"))})</span>`);
      }
      const badgeHtml = badges.length > 0 ? ` ${badges.join(" ")}` : "";
      const envCell = `${escapeHtml(entry.stage)}/${escapeHtml(entry.mode)}${badgeHtml}`;
      const scope = scopeCell(entry, locale);
      const duration =
        entry.durationMs !== undefined ? formatDuration(entry.durationMs, "auto") : "—";
      return `<tr${rowClass}><td>${new Date(entry.timestamp).toLocaleString()}</td><td class="mono">${envCell}</td><td>${scope}</td><td class="pass">${entry.passed}</td><td class="fail">${entry.failed}</td><td class="skip">${entry.skipped}</td><td class="mono" title="${entry.durationMs ?? ""} ms">${escapeHtml(duration)}</td></tr>`;
    })
    .join("");
  return `<table><thead><tr><th>${escapeHtml(t(locale, "dashboard.colWhen"))}</th><th>${escapeHtml(t(locale, "dashboard.colEnv"))}</th><th>${escapeHtml(t(locale, "dashboard.colScope"))}</th><th>${escapeHtml(t(locale, "dashboard.colPass"))}</th><th>${escapeHtml(t(locale, "dashboard.colFail"))}</th><th>${escapeHtml(t(locale, "dashboard.colSkip"))}</th><th>${escapeHtml(t(locale, "dashboard.colDuration"))}</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function scopeCell(entry: RunHistoryEntry, locale: PilotLocale): string {
  const display = formatHistoryScopeDisplay(entry, locale);
  const full = entry.scopeLabel?.trim() || entry.filter?.trim() || "";
  const title = full && full !== display ? ` title="${escapeAttr(full)}"` : "";
  return `<span${title}>${escapeHtml(display)}</span>`;
}

function flakyTable(rows: FlakyDashboardRow[], locale: PilotLocale): string {
  const body = rows
    .map((row) => {
      const visible = formatDashboardScenarioLabel(row.scenarioName);
      const scenarioCell = row.canOpen
        ? `<button type="button" class="case-open" data-feature-path="${escapeAttr(row.featurePath)}" data-scenario-line="${row.scenarioLine}" title="${escapeAttr(visible.title)}" aria-label="${escapeAttr(t(locale, "dashboard.flakyOpenLabel", { name: visible.title }))}">${escapeHtml(visible.label)}</button>`
        : `<span class="example-label" title="${escapeAttr(visible.title)}">${escapeHtml(visible.label)}</span>`;
      const avgDuration =
        row.averageDurationMs !== undefined ? formatDuration(row.averageDurationMs, "auto") : "—";
      const errorCell = row.lastErrorSnippet
        ? `<td class="flaky-error" title="${escapeAttr(row.lastErrorSnippet.slice(0, 500))}">${escapeHtml(row.lastErrorSnippet)}</td>`
        : `<td class="muted">${escapeHtml(t(locale, "dashboard.flakyNoError"))}</td>`;
      return `<tr><td>${scenarioCell}</td><td>${Math.round(row.failureRate * 100)}%</td><td class="mono">${escapeHtml(avgDuration)}</td>${errorCell}</tr>`;
    })
    .join("");
  return `<table><thead><tr><th>${escapeHtml(t(locale, "dashboard.colScenario"))}</th><th>${escapeHtml(t(locale, "dashboard.colFailureRate"))}</th><th>${escapeHtml(t(locale, "dashboard.colAvgDuration"))}</th><th>${escapeHtml(t(locale, "dashboard.colLastError"))}</th></tr></thead><tbody>${body}</tbody></table>`;
}

/** acquireVsCodeApi() once. Clicks are delegated so a patch can replace the regions. */
function renderDashboardScript(nonce: string): string {
  return `<script nonce="${nonce}">
    (function() {
      const vscode = acquireVsCodeApi();
      function readFilters(overrideName, overrideValue) {
        var picked = { stage: "all", outcome: "all", runKind: "all" };
        document.querySelectorAll("#history-filters button[data-filter][aria-pressed='true']").forEach(function(node) {
          picked[node.getAttribute("data-filter")] = node.getAttribute("data-value");
        });
        if (overrideName) picked[overrideName] = overrideValue;
        return {
          type: "filterHistory",
          stage: picked.stage || "all",
          outcome: picked.outcome || "all",
          runKind: picked.runKind || "all"
        };
      }
      var activeTab = "runs";
      function applyTab(runsLabel, detailLabel) {
        var body = document.getElementById("dash-body");
        if (body) body.setAttribute("data-tab", activeTab);
        var runs = document.getElementById("dash-tab-runs");
        var detail = document.getElementById("dash-tab-detail");
        if (runs) {
          runs.setAttribute("aria-selected", activeTab === "runs" ? "true" : "false");
          if (runsLabel) runs.textContent = runsLabel;
        }
        if (detail) {
          detail.setAttribute("aria-selected", activeTab === "detail" ? "true" : "false");
          if (detailLabel) detail.textContent = detailLabel;
        }
      }
      document.addEventListener("click", function(event) {
        var target = event.target;
        if (!target || !target.closest) return;
        var btn = target.closest("button");
        if (!btn) return;
        var tab = btn.getAttribute("data-tab");
        if (tab === "runs" || tab === "detail") {
          activeTab = tab;
          applyTab();
          return;
        }
        if (btn.id === "reset-history-filters") {
          vscode.postMessage({ type: "filterHistory", stage: "all", outcome: "all", runKind: "all" });
          return;
        }
        var filterName = btn.getAttribute("data-filter");
        if (filterName) {
          vscode.postMessage(readFilters(filterName, btn.getAttribute("data-value")));
          return;
        }
        if (btn.hasAttribute("data-command")) {
          if (btn.hasAttribute("disabled")) return;
          vscode.postMessage({ command: btn.getAttribute("data-command") });
          return;
        }
        if (btn.hasAttribute("data-feature-path")) {
          vscode.postMessage({
            command: "openFlakyScenario",
            featurePath: btn.getAttribute("data-feature-path"),
            scenarioLine: parseInt(btn.getAttribute("data-scenario-line") || "0", 10)
          });
        }
      });
      window.addEventListener("message", function(event) {
        var msg = event.data;
        if (!msg || msg.type !== "apply") return;
        if (msg.theme === "stage" || msg.theme === "editor") {
          document.documentElement.setAttribute("data-theme", msg.theme);
        }
        if (msg.lang === "es" || msg.lang === "en") {
          document.documentElement.lang = msg.lang;
        }
        var header = document.getElementById("dash-header");
        var main = document.getElementById("dash-main");
        var rail = document.getElementById("dash-rail");
        if (header) header.innerHTML = msg.header || "";
        if (main) main.innerHTML = msg.main || "";
        if (rail) rail.innerHTML = msg.rail || "";
        applyTab(msg.runsTabLabel, msg.detailTabLabel);
      });
      vscode.postMessage({ type: "ready" });
    })();
  </script>`;
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
