import * as assert from "assert";
import { describe, it } from "node:test";
import { computeDashboardTotals } from "../core/results/dashboardFormat";
import {
  buildDashboardRegions,
  dashboardPaintKind,
  DashboardViewInput,
  renderDashboardShell,
} from "../core/results/dashboardView";
import { RunHistoryEntry } from "../core/results/runHistory";

function entry(partial: Partial<RunHistoryEntry> & Pick<RunHistoryEntry, "id" | "stage">): RunHistoryEntry {
  return {
    timestamp: 1,
    mode: "parallel",
    passed: 1,
    failed: 0,
    skipped: 0,
    total: 1,
    scenarios: [],
    ...partial,
  };
}

function regions(partial: Partial<DashboardViewInput> & Pick<DashboardViewInput, "history">) {
  return buildDashboardRegions({
    filter: { outcome: "all", runKind: "all" },
    locale: "en",
    context: {},
    ...partial,
  });
}

function tbodyRows(main: string): number {
  const body = main.split("<tbody>")[1]?.split("</tbody>")[0] ?? "";
  return body.match(/<tr/g)?.length ?? 0;
}

describe("dashboardView", () => {
  it("paints a shell until the document exists", () => {
    assert.strictEqual(dashboardPaintKind(false), "shell");
    assert.strictEqual(dashboardPaintKind(true), "patch");
  });

  it("shows the rehydrate chip only when a notice is present", () => {
    const hidden = regions({ history: [] }).header;
    assert.doesNotMatch(hidden, /rehydrate-chip/);

    const shown = regions({
      history: [],
      context: {
        rehydrateNotice: {
          trxFileName: "pilot-run.trx",
          mtimeMs: 1,
          passed: 1,
          failed: 0,
          skipped: 0,
          total: 1,
        },
      },
    }).header;
    assert.match(shown, /class="rehydrate-chip"/);
    assert.match(shown, /pilot-run\.trx/);
  });

  it("shows the canceled stat only when a run was canceled", () => {
    const open = regions({ history: [entry({ id: "1", stage: "test" })] }).header;
    assert.doesNotMatch(open, /canceled/);

    const canceled = regions({
      history: [entry({ id: "1", stage: "test", status: "canceled", passed: 0, total: 0 })],
    }).header;
    assert.match(canceled, /<strong>1<\/strong> <span>canceled<\/span>/);
  });

  it("marks only Re-run Failed as the primary action, including when disabled", () => {
    const idle = regions({ history: [] }).rail;
    assert.doesNotMatch(idle, /action-btn/);

    const rail = regions({
      history: [],
      context: {
        actions: {
          target: { kind: "session", failed: 2, stage: "test", mode: "debug", timestamp: 1 },
          canRerunFailed: false,
          canCopyForAi: false,
          aiEnabled: true,
        },
      },
    }).rail;
    assert.strictEqual(rail.match(/action-btn--primary/g)?.length, 1);
    assert.match(rail, /class="action-btn action-btn--primary" data-command="rerunFailed"[^>]*disabled/);
    assert.match(rail, /class="action-btn" data-command="showOutput"/);
    assert.match(rail, /class="action-btn" data-command="copyForAi"/);
  });

  it("presses the active history filter", () => {
    const main = regions({
      history: [entry({ id: "1", stage: "dev" }), entry({ id: "2", stage: "stg" })],
      filter: { stage: "stg", outcome: "canceled", runKind: "profile" },
    }).main;
    assert.doesNotMatch(main, /<select/);
    assert.match(main, /data-filter="stage" data-value="stg" aria-pressed="true"/);
    assert.match(main, /data-filter="outcome" data-value="canceled" aria-pressed="true"/);
    assert.match(main, /data-filter="runKind" data-value="profile" aria-pressed="true"/);
    assert.match(main, /data-filter="stage" data-value="all" aria-pressed="false"/);
  });

  it("keeps full-history totals and caps the table at 20", () => {
    const history = Array.from({ length: 25 }, (_, index) =>
      entry({
        id: String(index),
        stage: index === 0 ? "stg" : "test",
        timestamp: index,
        passed: index === 0 ? 0 : 1,
        failed: index === 0 ? 1 : 0,
        total: index === 0 ? 1 : 1,
      }),
    );
    const filtered = regions({
      history,
      filter: { stage: "stg", outcome: "all", runKind: "all" },
    });
    assert.strictEqual(computeDashboardTotals(history).runs, 25);
    assert.match(filtered.header, /<strong>25<\/strong>/);
    assert.strictEqual(tbodyRows(filtered.main), 1);

    const all = regions({ history });
    assert.strictEqual(tbodyRows(all.main), 20);
  });

  it("builds one shell with both themes and the current regions", () => {
    const built = regions({ history: [] });
    const html = renderDashboardShell({
      nonce: "abc+/=",
      lang: "en",
      theme: "editor",
      regions: built,
    });
    assert.match(html, /script-src 'nonce-abc\+\/=';/);
    assert.match(html, /nonce="abc\+\/=/);
    assert.match(html, /data-theme="editor"/);
    assert.match(html, /id="dash-header"/);
    assert.match(html, /id="dash-main"/);
    assert.match(html, /id="dash-rail"/);
    assert.match(html, /html\[data-theme="stage"\]/);
    assert.match(html, /html\[data-theme="editor"\]/);
    assert.match(html, /type: "ready"/);
    assert.doesNotMatch(html, /font-src/);
    assert.match(html, /No Gherkin runs recorded yet/);
  });
});
