import * as fs from "fs";
import * as path from "path";
import { analyzeDotnetOutput } from "./analyzer";
import {
  FailedScenarioSnapshot,
  LastRunSnapshot,
  RunSummarySnapshot,
} from "./aiFailureContext";
import { discoverDomains } from "../gherkin/discovery";
import { DomainGroup } from "../gherkin/model";
import { findOutlineExampleMatch, matchesScenario } from "../results/scenarioMatch";
import { parseTrx, TrxSummary } from "../results/trxParser";

export interface FailureSnapshotInput {
  projectDir: string;
  trxPath?: string;
  logPath?: string;
  trxText?: string;
  logText?: string;
}

export class NoFailureContextError extends Error {
  constructor(message = "no failure context") {
    super(message);
    this.name = "NoFailureContextError";
  }
}

function readOptionalFile(filePath: string | undefined): string | undefined {
  if (!filePath) {
    return undefined;
  }
  return fs.readFileSync(filePath, "utf8");
}

function parseSummaryFromLog(logText: string): RunSummarySnapshot | undefined {
  const match =
    /Failed:\s+(\d+),\s+Passed:\s+(\d+),\s+Skipped:\s+(\d+),\s+Total:\s+(\d+)/.exec(logText);
  if (!match) {
    return undefined;
  }
  return {
    failed: Number(match[1]),
    passed: Number(match[2]),
    skipped: Number(match[3]),
    total: Number(match[4]),
    source: "log",
  };
}

function summaryFromTrx(trxSummary: TrxSummary): RunSummarySnapshot {
  return {
    passed: trxSummary.passed,
    failed: trxSummary.failed,
    skipped: trxSummary.skipped,
    total: trxSummary.total,
    source: "trx",
  };
}

function buildOutputFromTrx(trxSummary: TrxSummary): string {
  return trxSummary.results
    .filter((result) => result.outcome === "failed")
    .map((result) => {
      const err = result.errorMessage?.trim();
      return err ? `${result.testName}: ${err}` : result.testName;
    })
    .join("\n");
}

function mapFailedScenariosFromTrx(
  trxSummary: TrxSummary,
  domains: DomainGroup[],
  projectDir: string,
): FailedScenarioSnapshot[] {
  const failedResults = trxSummary.results.filter((result) => result.outcome === "failed");
  const mapped: FailedScenarioSnapshot[] = [];
  const seen = new Set<string>();

  for (const result of failedResults) {
    let featurePath = "";
    let scenarioName = result.testName;

    outer: for (const domain of domains) {
      for (const feature of domain.features) {
        for (const scenario of feature.scenarios) {
          if (scenario.examples && scenario.examples.length > 0) {
            const exampleMatch = findOutlineExampleMatch(result.testName, scenario.name, scenario.examples);
            if (exampleMatch) {
              featurePath = feature.filePath;
              scenarioName = scenario.name;
              break outer;
            }
          } else if (matchesScenario(result.testName, scenario.name)) {
            featurePath = feature.filePath;
            scenarioName = scenario.name;
            break outer;
          }
        }
      }
    }

    const key = `${featurePath}|${scenarioName}|${result.testName}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    mapped.push({
      featurePath: featurePath || path.join(projectDir, result.testName),
      scenarioName,
      errorMessage: result.errorMessage,
    });
  }

  return mapped;
}

export function hasFailureContext(trxSummary: TrxSummary | undefined, logText: string): boolean {
  if (trxSummary && trxSummary.failed > 0) {
    return true;
  }
  const trimmed = logText.trim();
  if (!trimmed) {
    return false;
  }
  const diagnostics = analyzeDotnetOutput(trimmed);
  if (diagnostics.some((entry) => entry.severity === "error")) {
    return true;
  }
  const summary = parseSummaryFromLog(trimmed);
  return !!summary && summary.failed > 0;
}

/** Builds a minimal LastRunSnapshot from TRX/log artifacts for headless failure context. */
export function buildFailureSnapshotFromArtifacts(input: FailureSnapshotInput): LastRunSnapshot {
  const projectDir = path.resolve(input.projectDir);
  const trxText = input.trxText ?? readOptionalFile(input.trxPath);
  const logText = input.logText ?? readOptionalFile(input.logPath) ?? "";

  if (!trxText && !logText.trim()) {
    throw new Error("At least one of trx or log is required");
  }

  const trxSummary = trxText ? parseTrx(trxText) : undefined;
  if (!hasFailureContext(trxSummary, logText)) {
    throw new NoFailureContextError();
  }

  const domains = trxSummary ? discoverDomains(projectDir) : [];
  const summary =
    (trxSummary ? summaryFromTrx(trxSummary) : undefined) ??
    parseSummaryFromLog(logText) ?? {
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      source: "cli",
    };

  const outputForAnalysis = logText.trim() || (trxSummary ? buildOutputFromTrx(trxSummary) : "");
  const failedScenarios = trxSummary ? mapFailedScenariosFromTrx(trxSummary, domains, projectDir) : [];

  return {
    timestamp: Date.now(),
    stage: "cli",
    mode: "cli",
    scopeLabels: ["cli (headless)"],
    projectDir,
    exitCode: summary.failed > 0 ? 1 : null,
    summary,
    outputForAnalysis,
    failedScenarios,
    evidence: [],
    trxPath: input.trxPath
      ? path.isAbsolute(input.trxPath)
        ? path.relative(projectDir, input.trxPath).split(path.sep).join("/")
        : input.trxPath.replace(/\\/g, "/")
      : undefined,
  };
}
