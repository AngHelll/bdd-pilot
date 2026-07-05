import * as path from "path";
import { DomainGroup } from "../core/gherkin/model";
import { OutcomeRollup } from "../core/gherkin/outcomeRollup";
import { collectScenarioOutcomeValues } from "../core/gherkin/testExplorerLabels";
import { RunHistoryEntry } from "../core/results/runHistory";
import { SessionRunSnapshot } from "../core/results/sessionRunSnapshot";
import { sanitize } from "../security/sanitizer";
import { Diagnostic } from "../core/diagnostics/analyzer";
import {
  PilotDiagnosticDto,
  PilotLastRunDto,
  PilotOutcomeRollupDto,
  PilotRunHistoryEntryDto,
} from "./types";

export function countOutcomeStoreLeaves(domains: DomainGroup[]): number {
  let total = 0;
  for (const domain of domains) {
    for (const feature of domain.features) {
      for (const scenario of feature.scenarios) {
        total += collectScenarioOutcomeValues(feature, scenario, {
          get: () => undefined,
          getDuration: () => undefined,
        }).length;
      }
    }
  }
  return total;
}

export function toAbsolutePath(value: string | undefined, projectDir?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  return path.isAbsolute(value) ? value : path.resolve(projectDir ?? process.cwd(), value);
}

export function mapHistoryEntry(entry: RunHistoryEntry): PilotRunHistoryEntryDto {
  return {
    id: entry.id,
    timestamp: entry.timestamp,
    stage: entry.stage,
    mode: entry.mode,
    scopeLabel: entry.scopeLabel,
    filter: entry.filter,
    passed: entry.passed,
    failed: entry.failed,
    skipped: entry.skipped,
    total: entry.total,
    durationMs: entry.durationMs,
    status: entry.status,
    trxPath: entry.trxPath,
    scenarios: entry.scenarios.map((s) => ({
      featurePath: s.featurePath,
      scenarioLine: s.scenarioLine,
      scenarioName: s.scenarioName,
      outcome: s.outcome,
      durationMs: s.durationMs,
      errorMessage: s.errorMessage ? sanitize(s.errorMessage) : undefined,
    })),
  };
}

export function mapRunHistory(entries: RunHistoryEntry[]): PilotRunHistoryEntryDto[] {
  return entries.map(mapHistoryEntry);
}

export function mapLastRun(snapshot: SessionRunSnapshot): PilotLastRunDto {
  return {
    timestamp: snapshot.timestamp,
    stage: snapshot.stage,
    mode: snapshot.mode,
    filter: snapshot.filter,
    scopeLabels: [...snapshot.scopeLabels],
    projectDir: snapshot.projectDir,
    testTarget: snapshot.testTarget,
    exitCode: snapshot.exitCode,
    status: snapshot.status,
    summary: { ...snapshot.summary },
    failedScenarios: snapshot.failedScenarios.map((s) => ({
      featurePath: s.featurePath,
      scenarioName: s.scenarioName,
      errorMessage: s.errorMessage ? sanitize(s.errorMessage) : undefined,
    })),
    diagnostics: snapshot.diagnostics.map(mapDiagnostic),
    evidence: snapshot.evidence.map((e) => ({
      kind: e.kind,
      path: toAbsolutePath(e.path, snapshot.projectDir) ?? e.path,
    })),
    trxPath: toAbsolutePath(snapshot.trxPath, snapshot.projectDir),
  };
}

export function mapRollup(
  rollup: OutcomeRollup,
  totalLeaves: number,
): PilotOutcomeRollupDto {
  return {
    passed: rollup.passed,
    failed: rollup.failed,
    skipped: rollup.skipped,
    withResults: rollup.withResults,
    pending: Math.max(0, totalLeaves - rollup.withResults),
  };
}

function mapDiagnostic(d: Diagnostic): PilotDiagnosticDto {
  return {
    code: d.code,
    severity: d.severity,
    title: d.title,
    detail: d.detail ? sanitize(d.detail) : undefined,
    hint: d.hint,
  };
}
