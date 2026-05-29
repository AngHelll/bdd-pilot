import * as fs from "fs";
import * as path from "path";
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
  if (trxPath && fs.existsSync(trxPath)) {
    try {
      trx = parseTrx(fs.readFileSync(trxPath, "utf8"));
    } catch {
      trx = undefined;
    }
  }

  const cucumber = findAndParseCucumber(projectDir);
  if (trx && trx.total > 0) {
    return {
      source: cucumber ? "merged" : "trx",
      total: trx.total,
      passed: trx.passed,
      failed: trx.failed,
      skipped: trx.skipped,
      results: trx.results,
    };
  }
  if (cucumber && cucumber.total > 0) {
    return {
      source: "cucumber",
      total: cucumber.total,
      passed: cucumber.passed,
      failed: cucumber.failed,
      skipped: cucumber.skipped,
      results: cucumber.results,
    };
  }
  return undefined;
}

function findAndParseCucumber(projectDir: string): CucumberSummary | undefined {
  for (const rel of CUCUMBER_CANDIDATES) {
    const p = path.join(projectDir, rel);
    if (fs.existsSync(p)) {
      try {
        return parseCucumberJson(fs.readFileSync(p, "utf8"));
      } catch {
        // try next
      }
    }
  }
  return undefined;
}
