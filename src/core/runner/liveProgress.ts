import { PilotLocale, t } from "../i18n";

export type LiveOutcome = "passed" | "failed" | "skipped";

/** Silence after the last result line before the progress message says it is waiting. */
export const PROGRESS_QUIET_AFTER_MS = 20_000;

const SHORT_TEST_NAME_MAX = 48;

export interface LiveProgressState {
  passed: number;
  failed: number;
  skipped: number;
  /** Tests finished (passed + failed + skipped). */
  completed: number;
  totalExpected?: number;
  /** Most recently finished test (fully qualified or method name). */
  lastTestName?: string;
  /** Most recent failure. Later passes do not clear it. Set by the parser, not the clock. */
  lastFailedTestName?: string;
  lastOutcome?: LiveOutcome;
  /**
   * Milliseconds since the last result line. The caller sets this; the parser does not.
   * At or above {@link PROGRESS_QUIET_AFTER_MS} the message can say it is waiting.
   */
  quietMs?: number;
}

export interface TestCompletionEvent {
  testName: string;
  outcome: LiveOutcome;
}

/**
 * Incrementally parses `dotnet test` stdout for xUnit/VSTest result lines.
 * Keeps a small line buffer only — no full output retention.
 */
export class LiveProgressParser {
  private lineBuffer = "";
  private passed = 0;
  private failed = 0;
  private skipped = 0;
  private lastTestName: string | undefined;
  private lastFailedTestName: string | undefined;
  private lastOutcome: LiveOutcome | undefined;

  constructor(private totalExpected?: number) {}

  setTotalExpected(total: number | undefined): void {
    this.totalExpected = total;
  }

  feed(chunk: string): TestCompletionEvent[] {
    this.lineBuffer += chunk;
    const events: TestCompletionEvent[] = [];
    let newlineIndex: number;

    while ((newlineIndex = this.lineBuffer.indexOf("\n")) >= 0) {
      let line = this.lineBuffer.slice(0, newlineIndex);
      this.lineBuffer = this.lineBuffer.slice(newlineIndex + 1);
      if (line.endsWith("\r")) {
        line = line.slice(0, -1);
      }
      const event = parseResultLine(line);
      if (event) {
        this.record(event);
        events.push(event);
      }
    }

    return events;
  }

  getState(): LiveProgressState {
    return {
      passed: this.passed,
      failed: this.failed,
      skipped: this.skipped,
      completed: this.passed + this.failed + this.skipped,
      totalExpected: this.totalExpected,
      lastTestName: this.lastTestName,
      lastFailedTestName: this.lastFailedTestName,
      lastOutcome: this.lastOutcome,
    };
  }

  private record(event: TestCompletionEvent): void {
    if (event.outcome === "passed") {
      this.passed++;
    } else if (event.outcome === "failed") {
      this.failed++;
      this.lastFailedTestName = event.testName;
    } else {
      this.skipped++;
    }
    this.lastTestName = event.testName;
    this.lastOutcome = event.outcome;
  }
}

/** Parses a single stdout line; returns undefined if not a result line. */
export function parseResultLine(line: string): TestCompletionEvent | undefined {
  const trimmed = line.trim();
  if (!trimmed) {
    return undefined;
  }

  // [xUnit.net 00:00:02.50]     Passed LoginFeature.Test [1 s]
  const xunit = /^\[xUnit\.net[^\]]*\]\s+(Passed|Failed|Skipped)\s+(.+?)(?:\s*\[|$)/i.exec(trimmed);
  if (xunit) {
    return { outcome: normalizeOutcome(xunit[1]), testName: xunit[2].trim() };
  }

  // Passed Namespace.Class.Method [42 ms]  or  Failed ... [FAIL]
  const plain = /^(Passed|Failed|Skipped)\s+(.+?)(?:\s*\[|$)/i.exec(trimmed);
  if (plain) {
    return { outcome: normalizeOutcome(plain[1]), testName: plain[2].trim() };
  }

  // Indented VSTest-style: "  Passed TestName"
  const indented = /^\s+(Passed|Failed|Skipped)\s+(.+?)(?:\s*\[|$)/i.exec(line);
  if (indented) {
    return { outcome: normalizeOutcome(indented[1]), testName: indented[2].trim() };
  }

  return undefined;
}

export function formatProgressMessage(state: LiveProgressState, locale: PilotLocale = "en"): string {
  const parts: string[] = [];
  const { completed, totalExpected, passed, failed, skipped } = state;

  if (totalExpected !== undefined && totalExpected > 0) {
    parts.push(`${Math.min(completed, totalExpected)}/${totalExpected}`);
  } else if (completed > 0) {
    parts.push(t(locale, "progress.doneCount", { count: completed }));
  }

  const sep = t(locale, "rollup.separator");
  const outcomes: string[] = [];
  if (passed > 0) {
    outcomes.push(t(locale, "rollup.passed", { count: passed }));
  }
  if (failed > 0) {
    outcomes.push(t(locale, "rollup.failed", { count: failed }));
  }
  if (skipped > 0) {
    outcomes.push(t(locale, "rollup.skipped", { count: skipped }));
  }
  if (outcomes.length > 0) {
    parts.push(outcomes.join(sep));
  }

  if (parts.length === 0) {
    return t(locale, "progress.starting");
  }
  const body = parts.join(sep);
  const quiet = isQuietProgress(state);
  let message =
    failed > 0 ? `${t(locale, "progress.failurePrefix", { count: String(failed) })}${body}` : body;
  let nameSource: string | undefined;
  if (failed > 0) {
    nameSource = state.lastFailedTestName;
  } else if (quiet) {
    nameSource = state.lastTestName;
  }
  const shortName = shortTestLabel(nameSource);
  if (shortName) {
    message = `${message}${sep}${shortName}`;
  }
  if (quiet) {
    return `${t(locale, "progress.quietPrefix")}${message}`;
  }
  return message;
}

function isQuietProgress(state: LiveProgressState): boolean {
  if (state.quietMs === undefined || state.quietMs < PROGRESS_QUIET_AFTER_MS) {
    return false;
  }
  if (state.completed <= 0) {
    return false;
  }
  if (state.totalExpected !== undefined && state.completed >= state.totalExpected) {
    return false;
  }
  return true;
}

/** Last dotted segment, truncated. Empty when there is nothing safe to show. */
function shortTestLabel(name: string | undefined): string {
  if (!name) {
    return "";
  }
  const trimmed = name.trim();
  if (!trimmed) {
    return "";
  }
  const dot = trimmed.lastIndexOf(".");
  const segment = dot >= 0 ? trimmed.slice(dot + 1).trim() : trimmed;
  if (!segment) {
    return "";
  }
  if (segment.length > SHORT_TEST_NAME_MAX) {
    return `${segment.slice(0, SHORT_TEST_NAME_MAX - 1)}…`;
  }
  return segment;
}

export function formatProgressTitle(
  stage: string,
  mode: string,
  state: LiveProgressState,
  locale: PilotLocale = "en",
): string {
  const detail = formatProgressMessage(state, locale);
  const starting = t(locale, "progress.starting");
  return detail === starting
    ? t(locale, "progress.running", { stage, mode })
    : `${t(locale, "progress.running", { stage, mode })} — ${detail}`;
}

function normalizeOutcome(value: string): LiveOutcome {
  const lower = value.toLowerCase();
  if (lower === "failed") {
    return "failed";
  }
  if (lower === "skipped") {
    return "skipped";
  }
  return "passed";
}
