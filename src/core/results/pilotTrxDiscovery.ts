import * as fs from "fs";
import * as path from "path";

export interface PilotTrxCandidate {
  absolutePath: string;
  fileName: string;
  mtimeMs: number;
}

const PILOT_TRX_PATTERN = /^bdd-pilot(?:-debug)?-\d+\.trx$/i;

/** Matches TRX file names written by BDD Pilot (`trxArgs`). */
export function isPilotTrxFileName(name: string): boolean {
  return PILOT_TRX_PATTERN.test(name);
}

/** Lists Pilot TRX files under `{projectDir}/{resultsDir}`. */
export function findPilotTrxCandidates(
  projectDir: string,
  resultsDir = "TestResults",
): PilotTrxCandidate[] {
  const dir = path.isAbsolute(resultsDir) ? resultsDir : path.join(projectDir, resultsDir);
  if (!fs.existsSync(dir)) {
    return [];
  }

  const candidates: PilotTrxCandidate[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !isPilotTrxFileName(entry.name)) {
      continue;
    }
    const absolutePath = path.join(dir, entry.name);
    try {
      const stat = fs.statSync(absolutePath);
      candidates.push({
        absolutePath,
        fileName: entry.name,
        mtimeMs: stat.mtimeMs,
      });
    } catch {
      // skip unreadable entries
    }
  }
  return candidates;
}

/** Picks the newest candidate; returns undefined if none or all exceed maxAgeMs. */
export function selectLatestPilotTrx(
  candidates: PilotTrxCandidate[],
  options?: { maxAgeMs?: number },
): PilotTrxCandidate | undefined {
  if (candidates.length === 0) {
    return undefined;
  }

  const sorted = [...candidates].sort((a, b) => b.mtimeMs - a.mtimeMs);
  const latest = sorted[0];
  const maxAgeMs = options?.maxAgeMs;
  if (maxAgeMs !== undefined && maxAgeMs > 0) {
    const age = Date.now() - latest.mtimeMs;
    if (age > maxAgeMs) {
      return undefined;
    }
  }
  return latest;
}
