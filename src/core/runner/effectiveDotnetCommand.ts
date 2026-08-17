/**
 * Formats the effective `dotnet test …` argv for clipboard / docs.
 * Bash-oriented quoting for tokens with whitespace or shell-sensitive chars.
 * Not a full Windows cmd.exe escape — documented join is enough for MVP.
 */

export interface EffectiveDotnetCommandParts {
  dotnetPath: string;
  args: string[];
}

export interface EffectiveDotnetCommandSnapshot {
  commandLine: string;
  updatedAt: number;
  /** Last session start that produced this line. */
  runKind: "run" | "debug";
}

/** Quotes an argv token when it needs shell protection. */
export function quoteArgForCommandLine(arg: string): string {
  if (arg.length === 0) {
    return '""';
  }
  if (!/[\s"'\\$`]/.test(arg)) {
    return arg;
  }
  return `"${arg.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** Builds `dotnetPath arg1 arg2…` suitable for paste into a terminal. */
export function formatEffectiveDotnetCommand(parts: EffectiveDotnetCommandParts): string {
  return [parts.dotnetPath, ...parts.args].map(quoteArgForCommandLine).join(" ");
}
