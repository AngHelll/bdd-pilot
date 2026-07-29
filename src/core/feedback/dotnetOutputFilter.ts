import { PilotLocale, t } from "../i18n";

export type DotnetVerbosity = "filtered" | "raw";

export type FilterDecision = "keep" | "drop";

export interface DotnetOutputFilterState {
  pending: string;
  lastWasEmpty: boolean;
}

/**
 * Noise lines safe to hide in `filtered` mode (case-insensitive).
 * Anchored where possible; keep catalog conservative — fail-open via KEEP_ALWAYS.
 */
const DROP_PATTERNS: RegExp[] = [
  /^starting test execution, please wait\.*/i,
  /^a total of \d+ test files? matched the specified pattern\.?$/i,
  /^building\.\.*/i,
  /^build started\.?$/i,
  /^determining projects to restore\.*/i,
  /^determine projects to restore\.*/i,
  /^restored\b/i,
  /^all projects are up-to-date/i,
  /^building project\b/i,
  /^time elapsed:?\s*$/i,
  // Reqnroll MSBuild item dumps (Feature/Generated file inventories)
  /^processing reqnroll/i,
  /^reqnroll(?:feature|generated)files:/i,
  /^-> using reqnroll\.json/i,
  /^identity=/i,
  // Successful compile redirect: "MinimalBdd -> /path/MinimalBdd.dll"
  /^[\w.+-]+\s+->\s+.+\.dll\s*$/i,
];

/**
 * Never drop when the line looks like a failure, xUnit verdict, or Pilot marker (fail-open).
 * Note: `\bfail` avoids matching unrelated words; `Passed!` / `Failed!` kept explicitly.
 */
const KEEP_ALWAYS =
  /\bfail(?:ed|ure)?\b|\berror\b|\bassert\b|\bexception\b|stack\s*trace|\bpending\b|\[bdd-pilot\]|^passed!\b|^failed!\b/i;

export function isDotnetVerbosity(value: string | undefined): value is DotnetVerbosity {
  return value === "filtered" || value === "raw";
}

export function createDotnetOutputFilterState(): DotnetOutputFilterState {
  return { pending: "", lastWasEmpty: false };
}

/**
 * Classify a single complete line (no trailing newline).
 * Empty-line collapse is handled by {@link processDotnetOutputChunk}.
 */
export function filterDotnetOutputLine(line: string): FilterDecision {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return "keep";
  }
  if (KEEP_ALWAYS.test(line)) {
    return "keep";
  }
  for (const pattern of DROP_PATTERNS) {
    if (pattern.test(trimmed)) {
      return "drop";
    }
  }
  return "keep";
}

/**
 * Filter a streaming chunk for the Output channel.
 * Incomplete trailing lines stay in `state.pending` until a newline arrives.
 * Order of use: sanitize (caller) → this helper → append.
 */
export function processDotnetOutputChunk(
  chunk: string,
  state: DotnetOutputFilterState,
  mode: DotnetVerbosity,
): string {
  if (mode === "raw") {
    return chunk;
  }

  const combined = state.pending + chunk;
  const parts = combined.split(/\r?\n/);
  state.pending = parts.pop() ?? "";

  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const line = parts[i];
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      if (state.lastWasEmpty) {
        continue;
      }
      state.lastWasEmpty = true;
      out.push("");
      continue;
    }
    state.lastWasEmpty = false;
    if (filterDotnetOutputLine(line) === "drop") {
      continue;
    }
    out.push(line);
  }

  if (out.length === 0) {
    return "";
  }
  // Preserve trailing newline when the chunk ended with one (pending empty).
  return out.join("\n") + "\n";
}

/** Flush any incomplete pending line at end of stream (always keep). */
export function flushDotnetOutputFilter(state: DotnetOutputFilterState): string {
  if (state.pending.length === 0) {
    return "";
  }
  const line = state.pending;
  state.pending = "";
  if (line.trim().length === 0) {
    if (state.lastWasEmpty) {
      return "";
    }
    state.lastWasEmpty = true;
    return "\n";
  }
  state.lastWasEmpty = false;
  return filterDotnetOutputLine(line) === "drop" ? "" : `${line}\n`;
}

export type OutputSection = "run" | "results" | "diagnostics";

export function formatOutputSectionHeader(locale: PilotLocale, section: OutputSection): string {
  switch (section) {
    case "run":
      return t(locale, "log.sectionRun");
    case "results":
      return t(locale, "log.sectionResults");
    case "diagnostics":
      return t(locale, "log.sectionDiagnostics");
  }
}

export function formatRunContextLine(
  locale: PilotLocale,
  parts: {
    stage: string;
    mode: string;
    scopeLabel?: string;
    timestampIso?: string;
  },
): string {
  const ts = parts.timestampIso ?? new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const scope = parts.scopeLabel?.trim() || t(locale, "log.runContextAll");
  return t(locale, "log.runContext", {
    stage: parts.stage,
    mode: parts.mode,
    scope,
    time: ts,
  });
}
