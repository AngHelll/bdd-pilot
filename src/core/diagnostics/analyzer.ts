export type DiagnosticSeverity = "error" | "warning" | "info";

export interface Diagnostic {
  /** Stable machine code, e.g. "SDK_NOT_FOUND". */
  code: string;
  severity: DiagnosticSeverity;
  /** Short, user-facing headline. */
  title: string;
  /** Optional extra context extracted from the output (no secrets). */
  detail?: string;
  /** Actionable next step. */
  hint: string;
}

/**
 * Translates raw `dotnet test` / `dotnet build` output into actionable
 * diagnostics. Pure and side-effect free so it can be unit tested and reused.
 * Returns diagnostics ordered by importance (most blocking first), de-duplicated
 * by code.
 */
export function analyzeDotnetOutput(output: string): Diagnostic[] {
  const found = new Map<string, Diagnostic>();
  const add = (d: Diagnostic) => {
    if (!found.has(d.code)) {
      found.set(d.code, d);
    }
  };

  if (matchesDotnetMissing(output)) {
    add({
      code: "DOTNET_NOT_FOUND",
      severity: "error",
      title: "The 'dotnet' command was not found.",
      hint: "Install the .NET SDK or set 'bddPilot.dotnetPath' to the dotnet executable.",
    });
  }

  if (matchesSdkNotFound(output)) {
    const requested = extract(output, /Requested SDK version:\s*([\d.]+)/) ?? extract(output, /Install the \[([\d.]+)\]/);
    const installed = extractInstalledSdks(output);
    add({
      code: "SDK_NOT_FOUND",
      severity: "error",
      title: requested
        ? `Required .NET SDK ${requested} is not installed.`
        : "A compatible .NET SDK was not found.",
      detail: installed.length > 0 ? `Installed SDKs: ${installed.join(", ")}.` : undefined,
      hint: requested
        ? `Install SDK ${requested}, or edit the project's global.json (e.g. add "rollForward": "latestFeature" or use an installed version).`
        : "Install the SDK required by global.json or adjust its version/rollForward.",
    });
  }

  const pkgMatch = /Unable to find package (\S+) with version \(([^)]+)\)/.exec(output);
  if (pkgMatch || /\bNU1101\b|\bNU1102\b/.test(output)) {
    const pkg = pkgMatch?.[1];
    const version = pkgMatch?.[2];
    const nearest = extract(output, /Nearest version:\s*([\d.]+)/);
    add({
      code: "PACKAGE_NOT_FOUND",
      severity: "error",
      title: pkg
        ? `Package '${pkg}' ${version ?? ""} could not be restored.`.replace(/\s+/g, " ").trim()
        : "A NuGet package could not be restored.",
      detail: nearest ? `Nearest available version in your feeds: ${nearest}.` : undefined,
      hint: "Likely a private feed/access issue: authenticate to the feed (e.g. set the feed PAT env var or use the Azure Artifacts credential provider), or verify the version exists in a feed you can access.",
    });
  }

  if (matchesFeedAuth(output)) {
    add({
      code: "FEED_AUTH",
      severity: "error",
      title: "A NuGet feed rejected the request (unauthorized).",
      hint: "Provide valid credentials for the private feed (PAT env var or credential provider). Do not commit secrets.",
    });
  }

  const vulnMatch = /Package '([^']+)' [\d.]+ has a known .*?severity vulnerability/.exec(output);
  if (vulnMatch || /\bNU1902\b|\bNU1903\b/.test(output)) {
    add({
      code: "VULNERABILITY_AS_ERROR",
      severity: "warning",
      title: vulnMatch
        ? `Package '${vulnMatch[1]}' has a known vulnerability and the build treats it as an error.`
        : "A NuGet audit warning is being treated as an error.",
      hint: "Update the vulnerable package to a patched version, or relax the audit policy (e.g. <NuGetAudit>false</NuGetAudit> / WarningsNotAsErrors).",
    });
  }

  if (matchesPlaywrightDriverIncomplete(output)) {
    add({
      code: "PLAYWRIGHT_DRIVER_INCOMPLETE",
      severity: "error",
      title: "The bundled Playwright driver in bin looks incomplete (likely a version mismatch).",
      detail: extract(output, /Cannot find module '([^']+)'/) ? `Missing module: ${extract(output, /Cannot find module '([^']+)'/)}.` : undefined,
      hint: "Clean the build output and rebuild so the matching Playwright package is copied: remove bin/ and obj/, then run dotnet build.",
    });
  } else if (matchesPlaywrightRuntime(output)) {
    add({
      code: "PLAYWRIGHT_RUNTIME",
      severity: "error",
      title: "Playwright failed to start (browser/driver runtime error).",
      hint: "Verify Playwright browsers are installed (pwsh bin/.../playwright.ps1 install) and that the installed browser builds match the Microsoft.Playwright package version.",
    });
  }

  if (/No test matches the given testcase filter/.test(output)) {
    add({
      code: "NO_TESTS_MATCHED",
      severity: "info",
      title: "No tests matched the filter.",
      hint: "Check the scenario/feature name or run by tag (Category=...). Generated class names use a 'Feature' suffix.",
    });
  }

  return [...found.values()].sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
}

function matchesDotnetMissing(output: string): boolean {
  return (
    /command not found:\s*dotnet/i.test(output) ||
    /'dotnet' is not recognized/i.test(output) ||
    /\bENOENT\b[^\n]*dotnet/i.test(output) ||
    /spawn dotnet ENOENT/i.test(output)
  );
}

function matchesSdkNotFound(output: string): boolean {
  return (
    /A compatible \.NET SDK was not found/i.test(output) ||
    /Requested SDK version:/i.test(output) ||
    (/could not be loaded/i.test(output) && /application 'test' does not exist/i.test(output))
  );
}

function matchesPlaywrightDriverIncomplete(output: string): boolean {
  return /\.playwright/.test(output) && /Cannot find module|MODULE_NOT_FOUND/.test(output);
}

function matchesPlaywrightRuntime(output: string): boolean {
  return (
    /Microsoft\.Playwright\.\w*Exception/.test(output) ||
    /Playwright\.CreateAsync/.test(output) ||
    /TargetClosedException\s*:\s*Process exited/.test(output) ||
    /Executable doesn't exist/.test(output)
  );
}

function matchesFeedAuth(output: string): boolean {
  return (
    /401 \(Unauthorized\)/i.test(output) ||
    /Response status code does not indicate success:\s*401/i.test(output) ||
    /Unable to load the service index for source/i.test(output) ||
    /\bNU1301\b/.test(output)
  );
}

function extract(output: string, re: RegExp): string | undefined {
  const m = re.exec(output);
  return m?.[1];
}

function extractInstalledSdks(output: string): string[] {
  const matches = output.matchAll(/^(\d+\.\d+\.\d+)\s+\[/gm);
  return [...matches].map((m) => m[1]);
}

function severityRank(s: DiagnosticSeverity): number {
  return s === "error" ? 0 : s === "warning" ? 1 : 2;
}
