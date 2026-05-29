/** How run durations appear in the tree and dashboard. */
export type DurationDisplayMode = "auto" | "ms" | "seconds" | "compact";

export const DEFAULT_DURATION_DISPLAY: DurationDisplayMode = "auto";

/**
 * Formats a duration for tree descriptions and lists.
 *
 * - **auto** — picks a readable unit (ms, s, m, h) by magnitude
 * - **ms** — always milliseconds (benchmarking)
 * - **seconds** — always seconds with up to 2 decimals
 * - **compact** — short GitHub-Actions style (`45s`, `2m 30s`)
 */
export function formatDuration(ms: number, mode: DurationDisplayMode = "auto"): string {
  if (!Number.isFinite(ms) || ms < 0) {
    return "—";
  }

  switch (mode) {
    case "ms":
      return `${Math.round(ms)} ms`;
    case "seconds":
      return formatSeconds(ms, 2);
    case "compact":
      return formatCompact(ms);
    case "auto":
    default:
      return formatAuto(ms);
  }
}

/**
 * Tooltip line with primary human scale plus exact milliseconds in parentheses.
 * Example: `Duration: 2.3 s (2341 ms)`
 */
export function formatDurationTooltip(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) {
    return "Duration: —";
  }
  const human = formatAuto(ms);
  const exact = `${Math.round(ms)} ms`;
  if (human === exact) {
    return `Duration: ${human}`;
  }
  return `Duration: ${human} (${exact})`;
}

function formatAuto(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)} ms`;
  }
  if (ms < 10_000) {
    return formatSeconds(ms, 1);
  }
  if (ms < 60_000) {
    return formatSeconds(ms, ms < 30_000 ? 1 : 0);
  }
  if (ms < 3_600_000) {
    return formatMinutesSeconds(ms);
  }
  return formatHoursMinutes(ms);
}

function formatSeconds(ms: number, maxDecimals: number): string {
  const value = ms / 1000;
  const rounded =
    maxDecimals === 0
      ? Math.round(value)
      : Math.round(value * 10 ** maxDecimals) / 10 ** maxDecimals;
  return `${stripTrailingZeros(rounded)} s`;
}

function formatCompact(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  if (ms < 60_000) {
    const secs = ms < 10_000 ? (ms / 1000).toFixed(1) : String(Math.round(ms / 1000));
    return `${stripTrailingZeros(Number(secs))}s`;
  }
  if (ms < 3_600_000) {
    const totalSec = Math.round(ms / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }
  const totalMin = Math.round(ms / 60_000);
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function formatMinutesSeconds(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  if (secs === 0) {
    return `${mins}m`;
  }
  return `${mins}m ${secs}s`;
}

function formatHoursMinutes(ms: number): string {
  const totalMin = Math.round(ms / 60_000);
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}m`;
}

function stripTrailingZeros(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value).replace(/\.?0+$/, "");
}
