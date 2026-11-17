import * as fs from "fs";
import * as path from "path";
import { currentResultContext, isTraceEnabled, trace } from "../observability/lifecycleTrace";
import { parseCucumberJson, CucumberSummary } from "./cucumberParser";
import { TrxSummary, parseTrx } from "./trxParser";

export interface UnifiedSummary {
  source: "trx" | "cucumber" | "merged";
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  results: TrxSummary["results"];
}

const CUCUMBER_CANDIDATES = [
  "CucumberResults.json",
  "cucumber.json",
  "TestResults/cucumber.json",
  "TestResults/TestResults/cucumber.json",
  "reports/cucumber/cucumber.json",
];

/**
 * Loads test results from TRX and/or Cucumber JSON. TRX is preferred when both
 * exist; Cucumber fills gaps when TRX is missing.
 */
export function loadRunResults(projectDir: string, trxPath?: string): UnifiedSummary | undefined {
  let trx: TrxSummary | undefined;
  let trxState: "absent" | "missing" | "parse-error" | "empty" | "ok" = trxPath ? "missing" : "absent";
  if (trxPath && fs.existsSync(trxPath)) {
    try {
      trx = parseTrx(fs.readFileSync(trxPath, "utf8"));
      trxState = trx && trx.total > 0 ? "ok" : "empty";
    } catch {
      trx = undefined;
      trxState = "parse-error";
    }
  }

  const cucumber = findAndParseCucumber(projectDir);
  let summary: UnifiedSummary | undefined;
  let selected: "trx" | "cucumber" | "merged" | "none" = "none";
  if (trx && trx.total > 0) {
    selected = cucumber ? "merged" : "trx";
    summary = {
      source: selected,
      total: trx.total,
      passed: trx.passed,
      failed: trx.failed,
      skipped: trx.skipped,
      results: trx.results,
    };
  } else if (cucumber && cucumber.summary.total > 0) {
    selected = "cucumber";
    summary = {
      source: "cucumber",
      total: cucumber.summary.total,
      passed: cucumber.summary.passed,
      failed: cucumber.summary.failed,
      skipped: cucumber.summary.skipped,
      results: cucumber.summary.results,
    };
  }
  if (isTraceEnabled()) {
    traceLoadedResults({
      trxPath,
      trxState,
      selected,
      summary,
      cucumberRel: cucumber?.relativePath,
      cucumberAbsolute: cucumber?.absolutePath,
    });
  }
  return summary;
}

function traceLoadedResults(info: {
  trxPath?: string;
  trxState: string;
  selected: "trx" | "cucumber" | "merged" | "none";
  summary: UnifiedSummary | undefined;
  cucumberRel?: string;
  cucumberAbsolute?: string;
}): void {
  const context = currentResultContext();
  const stampPath =
    info.selected === "cucumber"
      ? info.cucumberAbsolute
      : info.trxState === "ok" || info.trxState === "empty"
        ? info.trxPath
        : undefined;
  const mtimeMs = stampPath ? fileStamp(stampPath) : undefined;
  const priorToRun =
    mtimeMs !== undefined && context?.runStartedAt !== undefined
      ? mtimeMs < context.runStartedAt
      : undefined;
  trace("results.loaded", {
    operationId: context?.operationId,
    artifact:
      info.selected === "cucumber"
        ? info.cucumberRel
        : info.trxPath
          ? path.basename(info.trxPath)
          : undefined,
    cucumber: info.cucumberRel,
    source: info.selected,
    trxState: info.trxState,
    fallback: info.selected === "cucumber" ? info.trxState : undefined,
    total: info.summary?.total ?? 0,
    passed: info.summary?.passed ?? 0,
    failed: info.summary?.failed ?? 0,
    skipped: info.summary?.skipped ?? 0,
    empty: (info.summary?.total ?? 0) === 0,
    mtimeMs,
    runStartedAt: context?.runStartedAt,
    priorToRun,
  });
}

function fileStamp(filePath: string): number | undefined {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return undefined;
  }
}

function findAndParseCucumber(
  projectDir: string,
): { summary: CucumberSummary; relativePath: string; absolutePath: string } | undefined {
  for (const rel of CUCUMBER_CANDIDATES) {
    const absolutePath = path.join(projectDir, rel);
    if (fs.existsSync(absolutePath)) {
      try {
        return {
          summary: parseCucumberJson(fs.readFileSync(absolutePath, "utf8")),
          relativePath: rel,
          absolutePath,
        };
      } catch {
        // try next
      }
    }
  }
  return undefined;
}
