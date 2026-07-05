import { Diagnostic, analyzeDotnetOutput } from "../diagnostics/analyzer";
import { sanitize } from "../../security/sanitizer";

export type SessionRunStatus = "completed" | "canceled";

export interface SessionEvidence {
  kind: string;
  path: string;
}

export interface SessionFailedScenario {
  featurePath: string;
  scenarioName: string;
  errorMessage?: string;
}

export interface SessionRunSummary {
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  source?: string;
}

export interface SessionRunSnapshot {
  timestamp: number;
  stage: string;
  mode: string;
  filter?: string;
  scopeLabels: string[];
  projectDir: string;
  testTarget?: string;
  exitCode: number | null;
  status: SessionRunStatus;
  summary: SessionRunSummary;
  failedScenarios: SessionFailedScenario[];
  diagnostics: Diagnostic[];
  evidence: SessionEvidence[];
  trxPath?: string;
}

export function buildSessionRunSnapshot(params: {
  timestamp: number;
  stage: string;
  mode: string;
  filter?: string;
  scopeLabels: string[];
  projectDir: string;
  testTarget?: string;
  exitCode: number | null;
  status: SessionRunStatus;
  summary: SessionRunSummary;
  failedScenarios: SessionFailedScenario[];
  evidence: SessionEvidence[];
  trxPath?: string;
  outputBuffer: string;
}): SessionRunSnapshot {
  const sanitizedOutput = sanitize(params.outputBuffer);
  const diagnostics = analyzeDotnetOutput(sanitizedOutput).map((d) => ({
    ...d,
    detail: d.detail ? sanitize(d.detail) : undefined,
  }));

  return {
    timestamp: params.timestamp,
    stage: params.stage,
    mode: params.mode,
    filter: params.filter,
    scopeLabels: [...params.scopeLabels],
    projectDir: params.projectDir,
    testTarget: params.testTarget,
    exitCode: params.exitCode,
    status: params.status,
    summary: { ...params.summary },
    failedScenarios: params.failedScenarios.map((s) => ({
      featurePath: s.featurePath,
      scenarioName: s.scenarioName,
      errorMessage: s.errorMessage ? sanitize(s.errorMessage) : undefined,
    })),
    diagnostics,
    evidence: params.evidence.map((e) => ({ kind: e.kind, path: e.path })),
    trxPath: params.trxPath,
  };
}

export function cloneSessionRunSnapshot(snapshot: SessionRunSnapshot): SessionRunSnapshot {
  return {
    ...snapshot,
    scopeLabels: [...snapshot.scopeLabels],
    summary: { ...snapshot.summary },
    failedScenarios: snapshot.failedScenarios.map((s) => ({ ...s })),
    diagnostics: snapshot.diagnostics.map((d) => ({ ...d })),
    evidence: snapshot.evidence.map((e) => ({ ...e })),
  };
}
