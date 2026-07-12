import * as fs from "fs";
import * as path from "path";

export class PathJailError extends Error {
  constructor(message = "path outside workspace root") {
    super(message);
    this.name = "PathJailError";
  }
}

/** True when `candidatePath` resolves to the same path or a descendant of `rootPath`. */
export function isPathUnderRoot(candidatePath: string, rootPath: string): boolean {
  const root = path.resolve(rootPath);
  const candidate = path.resolve(candidatePath);
  const rel = path.relative(root, candidate);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

/**
 * Ensures a path resolves under `rootPath`. Uses realpath when the target exists (symlink-safe).
 */
export function assertPathUnderRoot(candidatePath: string, rootPath: string): void {
  const resolvedRoot = fs.realpathSync(path.resolve(rootPath));
  let resolvedCandidate: string;
  if (fs.existsSync(candidatePath)) {
    resolvedCandidate = fs.realpathSync(path.resolve(candidatePath));
  } else {
    resolvedCandidate = path.resolve(candidatePath);
  }
  if (!isPathUnderRoot(resolvedCandidate, resolvedRoot)) {
    throw new PathJailError("path outside workspace root");
  }
}
