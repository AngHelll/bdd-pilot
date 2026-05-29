import * as fs from "fs";
import * as path from "path";

export interface EvidenceFile {
  kind: "screenshot" | "trace" | "video" | "log" | "other";
  absolutePath: string;
  label: string;
}

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
const TRACE_EXT = new Set([".zip", ".trace"]);
const VIDEO_EXT = new Set([".webm", ".mp4"]);
const LOG_EXT = new Set([".log", ".txt"]);

/** Common output folders produced by BDD/browser test frameworks. */
const SEARCH_DIRS = [
  "test-results",
  "TestResults",
  "screenshots",
  "traces",
  "reports",
  "evidence",
];

const MAX_FILES = 8;
const MAX_AGE_MS = 15 * 60 * 1000;

/**
 * Finds recent evidence files (screenshots, traces, videos) near a test project
 * that likely belong to the latest run. Matching is time-based (mtime) rather
 * than scenario-specific, keeping the logic framework-agnostic.
 */
export function findRecentEvidence(projectDir: string, sinceMs = Date.now() - MAX_AGE_MS): EvidenceFile[] {
  const found: EvidenceFile[] = [];
  const cutoff = sinceMs;

  for (const rel of SEARCH_DIRS) {
    const dir = path.join(projectDir, rel);
    collectFromDir(dir, cutoff, found);
  }

  found.sort((a, b) => {
    try {
      return fs.statSync(b.absolutePath).mtimeMs - fs.statSync(a.absolutePath).mtimeMs;
    } catch {
      return 0;
    }
  });

  return found.slice(0, MAX_FILES);
}

function collectFromDir(dir: string, cutoff: number, out: EvidenceFile[], depth = 0): void {
  if (depth > 4 || out.length >= MAX_FILES) {
    return;
  }
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (out.length >= MAX_FILES) {
      break;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFromDir(full, cutoff, out, depth + 1);
    } else if (entry.isFile()) {
      try {
        const st = fs.statSync(full);
        if (st.mtimeMs < cutoff) {
          continue;
        }
        const kind = classifyFile(entry.name);
        if (kind) {
          out.push({ kind, absolutePath: full, label: path.basename(full) });
        }
      } catch {
        // skip
      }
    }
  }
}

function classifyFile(name: string): EvidenceFile["kind"] | undefined {
  const ext = path.extname(name).toLowerCase();
  if (IMAGE_EXT.has(ext)) {
    return "screenshot";
  }
  if (TRACE_EXT.has(ext) || name.includes("trace")) {
    return "trace";
  }
  if (VIDEO_EXT.has(ext)) {
    return "video";
  }
  if (LOG_EXT.has(ext)) {
    return "log";
  }
  return undefined;
}
