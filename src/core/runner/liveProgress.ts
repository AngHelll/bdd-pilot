import { PilotLocale, t } from "../i18n";

export type LiveOutcome = "passed" | "failed" | "skipped";

export interface LiveProgressState {
  passed: number;
  failed: number;
  skipped: number;
  /** Tests finished (passed + failed + skipped). */
  completed: number;
  totalExpected?: number;
  /** Most recently finished test (fully qualified or method name). */
  lastTestName?: string;
  lastOutcome?: LiveOutcome;
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
      lastOutcome: this.lastOutcome,
    };
  }

  private record(event: TestCompletionEvent): void {
    if (event.outcome === "passed") {
      this.passed++;
    } else if (event.outcome === "failed") {
      this.failed++;
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
  return parts.join(sep);
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
