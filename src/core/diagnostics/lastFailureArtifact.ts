import * as fs from "fs";
import * as path from "path";
import { LastRunSnapshot } from "./aiFailureContext";
import { sanitize } from "../../security/sanitizer";

export const LAST_FAILURE_ARTIFACT_NAME = "bdd-pilot-last-failure.json";
export const LAST_FAILURE_LOG_NAME = "bdd-pilot-last-run.log";
export const LAST_FAILURE_ARTIFACT_REL = `TestResults/${LAST_FAILURE_ARTIFACT_NAME}`;
export const LAST_FAILURE_LOG_REL = `TestResults/${LAST_FAILURE_LOG_NAME}`;

export const MAX_FAILURE_LOG_BYTES = 512 * 1024;
export const FAILURE_LOG_BYTES_PER_LINE = 200;

export interface LastFailureArtifactV1 {
  version: 1;
  writtenAt: number;
  projectDir: string;
  stage: string;
  mode: string;
  filter?: string;
  trxPath?: string;
  logPath?: string;
  summary: {
    passed: number;
    failed: number;
    skipped: number;
    total: number;
  };
}

export interface BuildLastFailureArtifactInput {
  snapshot: LastRunSnapshot;
  workspaceRoot?: string;
  logPath?: string;
}

export interface WriteLastFailureArtifactInput extends BuildLastFailureArtifactInput {
  maxLogBytes?: number;
}

export interface WriteLastFailureArtifactResult {
  written: boolean;
  artifactPath?: string;
  logPath?: string;
  error?: string;
}

function toPosixRelative(from: string, to: string): string {
  return path.relative(from, to).split(path.sep).join("/");
}

export function toArtifactProjectDir(projectDir: string, workspaceRoot?: string): string {
  const absProject = path.resolve(projectDir);
  if (workspaceRoot) {
    const absRoot = path.resolve(workspaceRoot);
    if (absProject === absRoot || absProject.startsWith(`${absRoot}${path.sep}`)) {
      const rel = toPosixRelative(absRoot, absProject);
      return rel || ".";
    }
  }
  return path.basename(absProject);
}

export function computeMaxFailureLogBytes(contextMaxOutputLines = 80): number {
  return Math.min(MAX_FAILURE_LOG_BYTES, contextMaxOutputLines * FAILURE_LOG_BYTES_PER_LINE);
}

export function buildLastFailureArtifact(input: BuildLastFailureArtifactInput): LastFailureArtifactV1 {
  const { snapshot, workspaceRoot, logPath } = input;
  const artifact: LastFailureArtifactV1 = {
    version: 1,
    writtenAt: snapshot.timestamp,
    projectDir: toArtifactProjectDir(snapshot.projectDir, workspaceRoot),
    stage: sanitize(snapshot.stage),
    mode: sanitize(snapshot.mode),
    summary: {
      passed: snapshot.summary.passed,
      failed: snapshot.summary.failed,
      skipped: snapshot.summary.skipped,
      total: snapshot.summary.total,
    },
  };
  if (snapshot.filter) {
    artifact.filter = sanitize(snapshot.filter);
  }
  if (snapshot.trxPath) {
    artifact.trxPath = snapshot.trxPath.replace(/\\/g, "/");
  }
  if (logPath) {
    artifact.logPath = toPosixRelative(path.resolve(snapshot.projectDir), path.resolve(logPath));
  }
  return artifact;
}

function tailSanitizedLogText(text: string, maxBytes: number): string {
  const sanitized = sanitize(text);
  if (Buffer.byteLength(sanitized, "utf8") <= maxBytes) {
    return sanitized;
  }
  return sanitized.slice(-maxBytes);
}

export function resolveLastFailureArtifactPath(projectDir: string): string {
  return path.join(path.resolve(projectDir), LAST_FAILURE_ARTIFACT_REL);
}

export function resolveLastFailureLogPath(projectDir: string): string {
  return path.join(path.resolve(projectDir), LAST_FAILURE_LOG_REL);
}

export function readLastFailureArtifact(projectDir: string): LastFailureArtifactV1 | undefined {
  const artifactPath = resolveLastFailureArtifactPath(projectDir);
  if (!fs.existsSync(artifactPath)) {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  } catch {
    return undefined;
  }
  if (!parsed || typeof parsed !== "object") {
    return undefined;
  }
  const record = parsed as Partial<LastFailureArtifactV1>;
  if (record.version !== 1) {
    return undefined;
  }
  if (
    typeof record.writtenAt !== "number" ||
    typeof record.projectDir !== "string" ||
    typeof record.stage !== "string" ||
    typeof record.mode !== "string" ||
    !record.summary ||
    typeof record.summary.passed !== "number" ||
    typeof record.summary.failed !== "number" ||
    typeof record.summary.skipped !== "number" ||
    typeof record.summary.total !== "number"
  ) {
    return undefined;
  }
  return record as LastFailureArtifactV1;
}

export function resolveArtifactRelativePath(projectDir: string, relPath: string): string {
  const normalized = relPath.replace(/\\/g, "/");
  if (path.isAbsolute(normalized)) {
    return path.resolve(normalized);
  }
  return path.resolve(projectDir, normalized);
}

export function writeLastFailureArtifact(input: WriteLastFailureArtifactInput): WriteLastFailureArtifactResult {
  const projectDir = path.resolve(input.snapshot.projectDir);
  const testResultsDir = path.join(projectDir, "TestResults");
  const artifactPath = resolveLastFailureArtifactPath(projectDir);

  try {
    fs.mkdirSync(testResultsDir, { recursive: true });

    let logPath: string | undefined;
    const output = input.snapshot.outputForAnalysis?.trim();
    if (output) {
      const maxLogBytes = input.maxLogBytes ?? computeMaxFailureLogBytes();
      logPath = resolveLastFailureLogPath(projectDir);
      fs.writeFileSync(logPath, tailSanitizedLogText(output, maxLogBytes), "utf8");
    }

    const artifact = buildLastFailureArtifact({
      snapshot: input.snapshot,
      workspaceRoot: input.workspaceRoot,
      logPath,
    });
    fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
    return { written: true, artifactPath, logPath };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { written: false, error: message };
  }
}

export function clearLastFailureArtifact(projectDir: string): void {
  const artifactPath = resolveLastFailureArtifactPath(projectDir);
  const logPath = resolveLastFailureLogPath(projectDir);
  if (fs.existsSync(artifactPath)) {
    fs.unlinkSync(artifactPath);
  }
  if (fs.existsSync(logPath)) {
    fs.unlinkSync(logPath);
  }
}
