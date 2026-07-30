import {
  BlameHangMode,
  CliVerbosity,
  DEFAULT_BLAME_HANG_TIMEOUT,
} from "../config/types";

export interface DiagnosticRunFlagsInput {
  runCliVerbosity: CliVerbosity;
  runBlame: boolean;
  runBlameHang: BlameHangMode;
  runBlameHangTimeout: string;
}

/** Hub tooltip parts for P2 diagnostic flags (non-default only). */
export function formatDiagnosticRunFlagsParts(input: DiagnosticRunFlagsInput): string[] {
  const parts: string[] = [];
  const verbosity = input.runCliVerbosity.trim();
  if (verbosity) {
    parts.push(`-v ${verbosity}`);
  }
  if (input.runBlame) {
    parts.push("blame");
  }
  if (input.runBlameHang === "on") {
    const timeout = input.runBlameHangTimeout.trim() || DEFAULT_BLAME_HANG_TIMEOUT;
    parts.push(`blame-hang ${timeout}`);
  }
  return parts;
}
