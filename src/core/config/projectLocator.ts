import * as fs from "fs";
import * as path from "path";

const IGNORED_DIRS = new Set([
  "node_modules",
  "bin",
  "obj",
  ".git",
  ".vs",
  "dist",
  "out",
]);

/**
 * Finds the directory that contains the .NET test project (the folder holding
 * the .csproj that also owns the .feature files). Resolution order:
 *   1. Explicit configured path (absolute or relative to a workspace root).
 *   2. Auto-detection: the nearest ancestor directory of any .feature file
 *      that also contains a .csproj.
 */
export function resolveProjectDir(
  workspaceRoots: string[],
  configuredPath: string,
): string | undefined {
  if (configuredPath && configuredPath.trim().length > 0) {
    const trimmed = configuredPath.trim();
    if (path.isAbsolute(trimmed) && dirExists(trimmed)) {
      return trimmed;
    }
    for (const root of workspaceRoots) {
      const candidate = path.resolve(root, trimmed);
      if (dirExists(candidate)) {
        return candidate;
      }
    }
  }

  for (const root of workspaceRoots) {
    const found = autoDetect(root);
    if (found) {
      return found;
    }
  }
  return undefined;
}

function autoDetect(root: string): string | undefined {
  const featureFiles = findFiles(root, ".feature", 200);
  for (const featureFile of featureFiles) {
    const projectDir = findCsprojAncestor(path.dirname(featureFile), root);
    if (projectDir) {
      return projectDir;
    }
  }
  return undefined;
}

function findCsprojAncestor(startDir: string, stopRoot: string): string | undefined {
  let current = startDir;
  const stop = path.resolve(stopRoot);
  let reachedTop = false;
  while (!reachedTop) {
    if (hasFileWithExt(current, ".csproj")) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current || current === stop) {
      reachedTop = true;
    } else {
      current = parent;
    }
  }
  return undefined;
}

export function findFiles(root: string, ext: string, limit: number): string[] {
  const results: string[] = [];
  const stack: string[] = [root];
  while (stack.length > 0 && results.length < limit) {
    const dir = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
          stack.push(full);
        }
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(ext)) {
        results.push(full);
      }
    }
  }
  return results;
}

function hasFileWithExt(dir: string, ext: string): boolean {
  try {
    return fs.readdirSync(dir).some((f) => f.toLowerCase().endsWith(ext));
  } catch {
    return false;
  }
}

function dirExists(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}
