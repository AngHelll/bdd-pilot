/**
 * Detects MSBuild / file-in-use messages that often appear when Pilot's
 * `dotnet test` overlaps an external `dotnet clean` / `dotnet build`.
 */
export function detectBuildFileLock(chunk: string): boolean {
  return /MSB3021|being used by another process/i.test(chunk);
}

/** Single Output line when a build/file lock is detected mid-run. */
export function formatBuildFileLockHintLine(): string {
  return "[bdd-pilot] Build/file lock detected — Cancel or wait for terminal build.";
}
