import * as vscode from "vscode";
import { formatDuration } from "../core/results/durationFormat";
import { RunHistoryEntry, flakyRate, scenarioHistoryKey } from "../core/results/runHistory";

export class DashboardPanel {
  private panel: vscode.WebviewPanel | undefined;

  show(history: RunHistoryEntry[]): void {
    if (this.panel) {
      this.panel.reveal();
      this.panel.webview.html = this.render(history);
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      "bddPilot.dashboard",
      "BDD Pilot Dashboard",
      vscode.ViewColumn.One,
      { enableScripts: false, retainContextWhenHidden: true },
    );
    this.panel.onDidDispose(() => {
      this.panel = undefined;
    });
    this.panel.webview.html = this.render(history);
  }

  update(history: RunHistoryEntry[]): void {
    if (this.panel) {
      this.panel.webview.html = this.render(history);
    }
  }

  private render(history: RunHistoryEntry[]): string {
    const recent = [...history].reverse().slice(0, 20);
    const totals = history.reduce(
      (acc, h) => {
        acc.runs++;
        acc.passed += h.passed;
        acc.failed += h.failed;
        return acc;
      },
      { runs: 0, passed: 0, failed: 0 },
    );

    const flaky = collectFlaky(history);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';" />
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
  </style>
</head>
<body>
  <h1>BDD Pilot Dashboard</h1>
  <p>Run history and quality signals for your BDD test suite.</p>
  <div class="stats">
    <div class="stat"><strong>${totals.runs}</strong> runs</div>
    <div class="stat"><strong class="pass">${totals.passed}</strong> passed (all runs)</div>
    <div class="stat"><strong class="fail">${totals.failed}</strong> failed (all runs)</div>
  </div>
  <h2>Recent runs</h2>
  ${recent.length === 0 ? `<p>No runs recorded yet.</p><p class="hint">Run tests from the <strong>BDD Pilot</strong> sidebar (play icon on a feature or scenario). History is stored per workspace — not related to execution profiles.</p>` : recentRunsTable(recent)}
  <h2>Flaky scenarios (recent window)</h2>
  ${flaky.length === 0 ? "<p>Not enough data yet (need 2+ runs per scenario).</p>" : flakyTable(flaky)}
</body>
</html>`;
  }
}

function recentRunsTable(runs: RunHistoryEntry[]): string {
  const rows = runs
    .map(
      (r) =>
        `<tr><td>${new Date(r.timestamp).toLocaleString()}</td><td>${r.stage}/${r.mode}</td><td class="pass">${r.passed}</td><td class="fail">${r.failed}</td><td>${r.skipped}</td><td title="${r.durationMs ?? ""} ms">${r.durationMs !== undefined ? formatDuration(r.durationMs, "auto") : "—"}</td></tr>`,
    )
    .join("");
  return `<table><thead><tr><th>When</th><th>Env</th><th>Pass</th><th>Fail</th><th>Skip</th><th>Duration</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function flakyTable(
  items: { name: string; rate: number; key: string }[],
): string {
  const rows = items
    .map((f) => `<tr><td>${escapeHtml(f.name)}</td><td>${Math.round(f.rate * 100)}%</td></tr>`)
    .join("");
  return `<table><thead><tr><th>Scenario</th><th>Failure rate</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function collectFlaky(history: RunHistoryEntry[]): { name: string; rate: number; key: string }[] {
  const keys = new Set<string>();
  for (const entry of history) {
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
