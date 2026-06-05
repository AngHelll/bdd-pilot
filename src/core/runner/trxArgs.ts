/** Shared TRX logger arguments for `dotnet test` (run and debug). */
export function appendTrxLoggerArgs(
  args: string[],
  trxFileName: string,
  resultsDir = "TestResults",
): void {
  args.push("--nologo", "--logger", `trx;LogFileName=${trxFileName}`, "--results-directory", resultsDir);
}

export function createRunTrxFileName(): string {
  return `bdd-pilot-${Date.now()}.trx`;
}

export function createDebugTrxFileName(): string {
  return `bdd-pilot-debug-${Date.now()}.trx`;
}

export function resolveTrxPath(projectDir: string, resultsDir: string, trxFileName: string): string {
  const dir = resultsDir.startsWith("/") || /^[A-Za-z]:/.test(resultsDir)
    ? resultsDir
    : `${projectDir.replace(/\\/g, "/")}/${resultsDir}`.replace(/\/+/g, "/");
  return `${dir}/${trxFileName}`;
}
