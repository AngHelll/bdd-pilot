import * as fs from "fs";
import * as path from "path";

export interface LoadedEnv {
  /** Parsed key/value pairs (values are NOT logged anywhere). */
  vars: Record<string, string>;
  /** Files that were actually found and loaded, for non-sensitive reporting. */
  loadedFiles: string[];
}

/**
 * Parses a .env file body into key/value pairs. Supports `export KEY=value`,
 * `KEY=value`, comments (#), blank lines, and surrounding single/double quotes.
 * Intentionally minimal and side-effect free.
 */
export function parseEnvFile(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }
    const withoutExport = line.startsWith("export ") ? line.slice("export ".length) : line;
    const eq = withoutExport.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = withoutExport.slice(0, eq).trim();
    let value = withoutExport.slice(eq + 1).trim();
    value = stripInlineComment(value);
    value = unquote(value);
    if (key.length > 0) {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Locates the repo-level `config` directory by walking up from the project dir,
 * then loads `config/.env.<stage>` followed by `config/.env.local` overrides.
 * Mirrors what `scripts/switch-test-env.sh` does, so tests authenticate the same
 * way they do from the terminal. Missing files are simply skipped.
 */
export function loadStageEnv(projectDir: string, stage: string): LoadedEnv {
  const result: LoadedEnv = { vars: {}, loadedFiles: [] };
  const configDir = findConfigDir(projectDir);
  if (!configDir) {
    return result;
  }

  const candidates = [path.join(configDir, `.env.${stage}`), path.join(configDir, ".env.local")];
  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        const parsed = parseEnvFile(fs.readFileSync(file, "utf8"));
        Object.assign(result.vars, parsed);
        result.loadedFiles.push(file);
      }
    } catch {
      // Ignore unreadable env files.
    }
  }
  return result;
}

function findConfigDir(startDir: string): string | undefined {
  let current = path.resolve(startDir);
  let reachedTop = false;
  while (!reachedTop) {
    const candidate = path.join(current, "config");
    try {
      if (fs.statSync(candidate).isDirectory()) {
        return candidate;
      }
    } catch {
      // not here
    }
    const parent = path.dirname(current);
    if (parent === current) {
      reachedTop = true;
    } else {
      current = parent;
    }
  }
  return undefined;
}

function stripInlineComment(value: string): string {
  if (value.startsWith("'") || value.startsWith('"')) {
    return value;
  }
  const hash = value.indexOf(" #");
  return hash >= 0 ? value.slice(0, hash).trim() : value;
}

function unquote(value: string): string {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
  }
  return value;
}
