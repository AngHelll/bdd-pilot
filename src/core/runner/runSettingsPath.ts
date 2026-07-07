import * as fs from "fs";
import * as path from "path";

export interface RunSettingsResolution {
  /** Absolute path passed to `dotnet test --settings` when the file exists. */
  settingsPath?: string;
  /** Absolute path that was configured but missing on disk. */
  missingPath?: string;
}

/**
 * Resolves `bddPilot.run.runSettings` to an absolute path and checks existence.
 * Relative paths use the first workspace folder root.
 */
export function resolveRunSettingsPath(
  workspaceRoot: string | undefined,
  configuredPath: string,
  exists: (filePath: string) => boolean = fs.existsSync,
): RunSettingsResolution {
  const trimmed = configuredPath.trim();
  if (!trimmed) {
    return {};
  }

  const candidate = path.isAbsolute(trimmed)
    ? trimmed
    : workspaceRoot
      ? path.join(workspaceRoot, trimmed)
      : trimmed;

  if (exists(candidate)) {
    return { settingsPath: candidate };
  }

  return { missingPath: candidate };
}

export function formatRunSettingsMissingMessage(missingPath: string): string {
  return `[bdd-pilot] Run settings file not found: ${missingPath}`;
}
