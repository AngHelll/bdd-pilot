/** Stacked pass / fail / skip bars for the runs already shown in the dashboard table. */

export interface DashboardRunCounts {
  passed: number;
  failed: number;
  skipped: number;
}

export interface DashboardBarSegment {
  kind: "pass" | "fail" | "skip";
  /** Share of the tallest bar in this window. */
  fraction: number;
}

export interface DashboardHistoryBar {
  passed: number;
  failed: number;
  skipped: number;
  /** 0 when the run recorded no counts. Otherwise sum / max sum in the window. */
  heightFraction: number;
  /** Bottom to top: pass, then fail, then skip. Zero counts are omitted. */
  segments: DashboardBarSegment[];
}

const CHART_HEIGHT = 56;
const LABEL_BAND = 16;
const SLOT = 22;
const BAR_WIDTH = 12;

/**
 * `newestFirst` is the table order. Bars are returned oldest-first so the
 * newest run is the rightmost bar.
 */
export function buildDashboardHistoryBars(newestFirst: DashboardRunCounts[]): DashboardHistoryBar[] {
  const chronological = [...newestFirst].reverse();
  const sums = chronological.map((run) => run.passed + run.failed + run.skipped);
  const max = sums.reduce((peak, sum) => Math.max(peak, sum), 0);

  return chronological.map((run) => {
    const sum = run.passed + run.failed + run.skipped;
    const heightFraction = max === 0 || sum === 0 ? 0 : sum / max;
    const segments: DashboardBarSegment[] = [];
    if (sum > 0 && max > 0) {
      if (run.passed > 0) {
        segments.push({ kind: "pass", fraction: run.passed / max });
      }
      if (run.failed > 0) {
        segments.push({ kind: "fail", fraction: run.failed / max });
      }
      if (run.skipped > 0) {
        segments.push({ kind: "skip", fraction: run.skipped / max });
      }
    }
    return {
      passed: run.passed,
      failed: run.failed,
      skipped: run.skipped,
      heightFraction,
      segments,
    };
  });
}

export function renderDashboardHistoryChart(
  bars: DashboardHistoryBar[],
  label: string,
  barTitle: (bar: DashboardHistoryBar) => string,
): string {
  if (bars.length === 0) {
    return "";
  }

  const plotHeight = CHART_HEIGHT - LABEL_BAND;
  const width = bars.length * SLOT;
  const groups = bars
    .map((bar, index) => {
      const x = index * SLOT + (SLOT - BAR_WIDTH) / 2;
      const count = bar.passed + bar.failed + bar.skipped;
      const title = `<title>${escapeXml(barTitle(bar))}</title>`;
      const countFill = bar.failed > 0 ? "var(--pilot-danger)" : "var(--pilot-muted)";
      const countLabel = `<text data-count="${count}" x="${x + BAR_WIDTH / 2}" y="12" text-anchor="middle" fill="${countFill}" font-size="10">${count}</text>`;
      if (bar.heightFraction === 0) {
        return `<g data-bar="${index}">${title}${countLabel}<rect data-kind="empty" x="${x}" y="${CHART_HEIGHT - 2}" width="${BAR_WIDTH}" height="2" fill="var(--pilot-muted)"></rect></g>`;
      }
      let y = CHART_HEIGHT;
      const rects = bar.segments
        .map((segment) => {
          const room = y - LABEL_BAND;
          const height = Math.min(room, Math.max(2, Math.round(segment.fraction * plotHeight)));
          if (height <= 0) {
            return "";
          }
          y -= height;
          const fill =
            segment.kind === "pass"
              ? "var(--pilot-ok)"
              : segment.kind === "fail"
                ? "var(--pilot-danger)"
                : "var(--pilot-muted)";
          return `<rect data-kind="${segment.kind}" x="${x}" y="${y}" width="${BAR_WIDTH}" height="${height}" fill="${fill}"></rect>`;
        })
        .join("");
      return `<g data-bar="${index}">${title}${countLabel}${rects}</g>`;
    })
    .join("");

  return `<svg class="history-chart" role="img" aria-label="${escapeXml(label)}" viewBox="0 0 ${width} ${CHART_HEIGHT}" width="${width}" height="${CHART_HEIGHT}" preserveAspectRatio="xMinYMid meet">${groups}</svg>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
