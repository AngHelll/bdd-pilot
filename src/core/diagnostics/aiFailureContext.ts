import * as path from "path";
import { analyzeDotnetOutput } from "./analyzer";
import { RunTarget } from "../runner/filterBuilder";
import { sanitize } from "../../security/sanitizer";

export interface FailedScenarioSnapshot {
  featurePath: string;
  scenarioName: string;
  errorMessage?: string;
}

export interface RunSummarySnapshot {
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  source?: string;
}

export interface EvidenceSnapshot {
  kind: string;
  path: string;
}

export interface LastRunSnapshot {
  timestamp: number;
  stage: string;
  mode: string;
  filter?: string;
  scopeLabels: string[];
  projectDir: string;
  testTarget?: string;
  exitCode: number | null;
  summary: RunSummarySnapshot;
  /** Full sanitized output buffer used for diagnostics and tail extraction. */
  outputForAnalysis: string;
  failedScenarios: FailedScenarioSnapshot[];
  evidence: EvidenceSnapshot[];
  trxPath?: string;
}

export interface BuildAiFailureContextOptions {
  maxOutputLines?: number;
  extensionVersion?: string;
  workspaceRoot?: string;
}

/** Canonical scope label stored on run history for full-suite runs. */
export const RUN_SCOPE_ALL_TESTS_LABEL = "all tests";

export function formatRunTargetScopeLabels(targets: RunTarget[]): string[] {
  if (targets.length === 0 || targets.some((t) => t.kind === "all")) {
    return [RUN_SCOPE_ALL_TESTS_LABEL];
  }
  const labels: string[] = [];
  for (const t of targets) {
    switch (t.kind) {
      case "tag":
        labels.push(`@${t.tag} (tag)`);
        break;
      case "domain":
        labels.push(`${t.group.name} (domain)`);
        break;
      case "feature":
        labels.push(`${path.basename(t.feature.filePath)} (feature)`);
        break;
      case "scenario":
        labels.push(`${path.basename(t.feature.filePath)} · ${t.scenario.name} (scenario)`);
        break;
      case "outlineRow":
        labels.push(
          `${path.basename(t.feature.filePath)} · ${t.scenario.name} — ${t.example.label} (outline row)`,
        );
        break;
    }
  }
  return labels;
}

export function tailOutputLines(text: string, maxLines: number): string {
  if (maxLines <= 0) {
    return "";
  }
  const lines = text.split(/\r?\n/);
  if (lines.length <= maxLines) {
    return text;
  }
  return lines.slice(-maxLines).join("\n");
}

function truncateSingleLine(text: string, maxLen: number): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= maxLen) {
    return oneLine;
  }
  return `${oneLine.slice(0, maxLen - 1)}…`;
}

function relativizePath(
  absolutePath: string,
  workspaceRoot: string | undefined,
  projectDir: string,
): string {
  for (const base of [workspaceRoot, projectDir]) {
    if (!base) {
      continue;
    }
    const rel = path.relative(base, absolutePath);
    if (rel && !rel.startsWith("..") && !path.isAbsolute(rel)) {
      return rel.split(path.sep).join("/");
    }
  }
  return absolutePath.split(path.sep).join("/");
}

export function buildAiFailureContext(
  snapshot: LastRunSnapshot,
  options?: BuildAiFailureContextOptions,
): string {
  const maxLines = options?.maxOutputLines ?? 80;
  const version = options?.extensionVersion ?? "unknown";
  const when = new Date(snapshot.timestamp).toISOString();
  const scope = snapshot.scopeLabels.join(" | ");
  const filterLine = snapshot.filter
    ? `- **Filter:** \`${snapshot.filter}\``
    : "- **Filter:** _(none — all tests)_";
  const resultLine = `- **Result:** ${snapshot.summary.failed} failed, ${snapshot.summary.passed} passed (${snapshot.summary.total} total)`;

  let failedSection = "";
  if (snapshot.failedScenarios.length > 0) {
    const items = snapshot.failedScenarios.map((s) => {
      const feature = path.basename(s.featurePath) || s.featurePath;
      const err = s.errorMessage?.trim();
      const errPart = err ? ` — _${truncateSingleLine(err, 120)}_` : "";
      return `- \`${feature}\` · ${s.scenarioName}${errPart}`;
    });
    failedSection = `\n## Failed scenarios\n${items.join("\n")}\n`;
  }

  const diagnostics = analyzeDotnetOutput(snapshot.outputForAnalysis);
  let diagSection = "";
  if (diagnostics.length > 0) {
    const items = diagnostics.map((d, i) => {
      const detail = d.detail ? `\n   - ${d.detail}` : "";
      return `${i + 1}. **[${d.code}]** ${d.title}${detail}\n   - Hint: ${d.hint}`;
    });
    diagSection = `\n## Diagnostics (BDD Pilot analyzer)\n${items.join("\n\n")}\n`;
  } else if (snapshot.outputForAnalysis.trim()) {
    diagSection = "\n## Diagnostics (BDD Pilot analyzer)\nNo rule matched — see output below.\n";
  }

  const tail = sanitize(tailOutputLines(snapshot.outputForAnalysis, maxLines));
  const outputSection = `\n## Recent output (sanitized, last ${maxLines} lines)\n\`\`\`text\n${tail}\n\`\`\`\n`;

  let evidenceSection = "";
  if (snapshot.evidence.length > 0) {
    const items = snapshot.evidence.map((e) => {
      const rel = relativizePath(e.path, options?.workspaceRoot, snapshot.projectDir);
      return `- ${e.kind}: \`${rel}\``;
    });
    evidenceSection = `\n## Evidence (paths only)\n${items.join("\n")}\n`;
  }

  return `# BDD Pilot — failure context

## Run
- **When:** ${when}
- **Stage:** ${snapshot.stage} · **Mode:** ${snapshot.mode}
${filterLine}
- **Scope:** ${scope}
${resultLine}
${failedSection}${diagSection}${outputSection}${evidenceSection}
---
Generated by BDD Pilot v${version} — review before sharing with external AI.
`.trim();
}
