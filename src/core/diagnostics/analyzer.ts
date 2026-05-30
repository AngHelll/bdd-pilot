export type DiagnosticSeverity = "error" | "warning" | "info";

export interface Diagnostic {
  code: string;
  severity: DiagnosticSeverity;
  title: string;
  detail?: string;
  hint: string;
}

type Analyzer = {
  code: string;
  severity: DiagnosticSeverity;
  match: (output: string) => boolean;
  title: (output: string) => string;
  detail?: (output: string) => string | undefined;
  hint: string;
};

const SEVERITY_RANK: Record<DiagnosticSeverity, number> = {
  error: 0,
  warning: 1,
  info: 2,
};

function countMatches(output: string, pattern: RegExp): number {
  return (output.match(pattern) ?? []).length;
}

function parseTestRunSummary(output: string): { failed: number; passed: number; skipped: number; total: number } | undefined {
  const m = /Failed!\s+-\s+Failed:\s+(\d+),\s+Passed:\s+(\d+),\s+Skipped:\s+(\d+),\s+Total:\s+(\d+)/.exec(output);
  if (!m) {
    return undefined;
  }
  return {
    failed: parseInt(m[1], 10),
    passed: parseInt(m[2], 10),
    skipped: parseInt(m[3], 10),
    total: parseInt(m[4], 10),
  };
}

function testsExecuted(output: string): boolean {
  return (
    /Test run for .+\.dll/.test(output) ||
    /\[xUnit\.net/.test(output) ||
    parseTestRunSummary(output) !== undefined
  );
}

function failureBreakdown(output: string): string | undefined {
  const pending = countMatches(output, /XUnitPendingStepException|No matching step definition found/gi);
  const noUsers = countMatches(
    output,
    /No available users found in UserProfileTracking|No suitable user found|No hay usuarios disponibles/gi,
  );
  const nullRef = countMatches(output, /NullReferenceException/gi);
  const refit = countMatches(output, /Refit\.ApiException/gi);
  const aws = countMatches(output, /The security token included in the request is invalid/gi);
  const ambiguous = countMatches(output, /Ambiguous step definitions found/gi);

  const parts: string[] = [];
  if (pending > 0) {
    parts.push(`${pending} pending/missing step definition(s)`);
  }
  if (noUsers > 0) {
    parts.push(`${noUsers} missing UserProfileTracking test user(s)`);
  }
  if (nullRef > 0) {
    parts.push(`${nullRef} NullReferenceException (often failed setup/Given steps)`);
  }
  if (refit > 0) {
    parts.push(`${refit} API HTTP error(s) (Refit.ApiException)`);
  }
  if (aws > 0) {
    parts.push(`${aws} AWS credential failure(s)`);
  }
  if (ambiguous > 0) {
    parts.push(`${ambiguous} ambiguous step definition(s)`);
  }

  return parts.length > 0 ? parts.join("; ") : undefined;
}

function isPlaywrightDriverIncomplete(output: string): boolean {
  return (
    /Cannot find module ['"].*\.playwright/i.test(output) ||
    (/\/\.playwright\/package\//i.test(output) && /Cannot find module/i.test(output))
  );
}

const ANALYZERS: Analyzer[] = [
  {
    code: "DOTNET_NOT_FOUND",
    severity: "error",
    match: (o) => /command not found: dotnet|spawn dotnet ENOENT|dotnet: not found/i.test(o),
    title: () => ".NET SDK is not installed or not on PATH.",
    hint: "Install the .NET SDK and ensure `dotnet` is available in your shell PATH.",
  },
  {
    code: "SDK_NOT_FOUND",
    severity: "error",
    match: (o) =>
      /Requested SDK version:/i.test(o) &&
      (/does not exist/i.test(o) || /No .NET SDKs were found/i.test(o) || /Installed SDKs:/i.test(o)),
    title: (o) => {
      const req = /Requested SDK version:\s*([^\s]+)/i.exec(o)?.[1];
      return req ? `Required .NET SDK ${req} is not installed.` : "Required .NET SDK version is not installed.";
    },
    detail: (o) => {
      const installed = [...o.matchAll(/^\s*([\d.]+)\s*\[/gm)].map((m) => m[1]);
      return installed.length ? `Installed SDKs: ${installed.join(", ")}` : undefined;
    },
    hint: "Install the SDK version from global.json, or update global.json to match an installed SDK.",
  },
  {
    code: "FEED_AUTH",
    severity: "error",
    match: (o) =>
      /Unable to load the service index for source/i.test(o) ||
      /\bNU1301\b/.test(o) ||
      (/(?:nuget|feed|restore|service index)/i.test(o) && /401 \(Unauthorized\)/i.test(o) && !testsExecuted(o)),
    title: () => "A NuGet feed rejected the request (unauthorized).",
    hint: "Provide valid credentials for the private feed (PAT env var or credential provider). Do not commit secrets.",
  },
  {
    code: "PACKAGE_NOT_FOUND",
    severity: "error",
    match: (o) => /\bNU1102\b/.test(o),
    title: (o) => {
      const pkg = /Unable to find package ([^\s]+)/i.exec(o)?.[1];
      return pkg ? `Package not found: ${pkg}` : "A required NuGet package was not found.";
    },
    detail: (o) => {
      const nearest = /Nearest version:\s*([^\]\s]+)/i.exec(o)?.[1];
      return nearest ? `Nearest available version in feed: ${nearest}` : undefined;
    },
    hint: "Check package version in the .csproj and that your feed credentials can access the private feed.",
  },
  {
    code: "VULNERABILITY_AS_ERROR",
    severity: "warning",
    match: (o) => /\bNU190[0-9]\b/.test(o),
    title: (o) => {
      const pkg = /Package '([^']+)'/i.exec(o)?.[1];
      return pkg ? `Vulnerability policy blocked package: ${pkg}` : "A package vulnerability is treated as an error.";
    },
    hint: "Upgrade the affected package or adjust NuGet audit settings for local development.",
  },
  {
    code: "NO_TESTS_MATCHED",
    severity: "info",
    match: (o) => /No test matches the given testcase filter/i.test(o),
    title: () => "No tests matched the current filter.",
    hint: "Clear filters or pick a scenario/feature that exists in the test assembly.",
  },
  {
    code: "PENDING_STEPS",
    severity: "error",
    match: (o) => testsExecuted(o) && /XUnitPendingStepException|No matching step definition found/i.test(o),
    title: (o) => {
      const n = countMatches(o, /XUnitPendingStepException|No matching step definition found/gi);
      return n > 1 ? `${n} tests have pending or missing step definitions.` : "Tests have pending or missing step definitions.";
    },
    detail: (o) => {
      const features = [...new Set([...o.matchAll(/in ([^\n]+\.feature):line \d+/g)].map((m) => m[1]))];
      if (features.length === 0) {
        return undefined;
      }
      const shown = features.slice(0, 5);
      const suffix = features.length > 5 ? ` (+${features.length - 5} more)` : "";
      return `Affected features: ${shown.join(", ")}${suffix}`;
    },
    hint: "Implement the missing step bindings in Steps/ or mark scenarios @ignore until steps exist.",
  },
  {
    code: "AMBIGUOUS_STEPS",
    severity: "error",
    match: (o) => testsExecuted(o) && /Ambiguous step definitions found/i.test(o),
    title: () => "Reqnroll found duplicate step definitions for the same step text.",
    detail: (o) => /Ambiguous step definitions found for step '([^']+)'/i.exec(o)?.[1],
    hint: "Remove or rename duplicate [Given]/[When]/[Then] bindings so each step text maps to one method.",
  },
  {
    code: "NO_TEST_USERS",
    severity: "error",
    match: (o) =>
      testsExecuted(o) &&
      /No available users found in UserProfileTracking|No suitable user found|No hay usuarios disponibles|The array cannot be null or empty/i.test(
        o,
      ),
    title: (o) => {
      const n = countMatches(
        o,
        /No available users found in UserProfileTracking|No suitable user found|No hay usuarios disponibles|The array cannot be null or empty/gi,
      );
      return n > 1
        ? `${n} failures due to missing or locked test users in UserProfileTracking.csv.`
        : "No available test users in UserProfileTracking.csv.";
    },
    detail: (o) => {
      const samples = [
        ...new Set(
          [
            ...o.matchAll(
              /(?:InvalidOperationException|ArgumentException)\s*:\s*(No available users[^\n]+|No suitable user[^\n]+|No hay usuarios[^\n]+|The array cannot be null or empty)/gi,
            ),
          ].map((m) => m[1].trim()),
        ),
      ];
      if (samples.length === 0) {
        return undefined;
      }
      const shown = samples.slice(0, 3);
      const suffix = samples.length > 3 ? ` (+${samples.length - 3} more)` : "";
      return shown.join("; ") + suffix;
    },
    hint: "Reset user locks in Data/UserProfileTracking.csv, add users with required flags, or run prerequisite flows that create PPR/WM accounts.",
  },
  {
    code: "AWS_CREDENTIALS",
    severity: "error",
    match: (o) => testsExecuted(o) && /The security token included in the request is invalid/i.test(o),
    title: () => "AWS credentials are invalid or expired (DynamoDB).",
    hint: "Refresh AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY (or SSO session) in .env.test and verify the target account/region.",
  },
  {
    code: "XRAY_CONFIG",
    severity: "warning",
    match: (o) => testsExecuted(o) && /X-Ray configuration should be valid/i.test(o),
    title: () => "X-Ray integration is not configured.",
    hint: "Set XRAY_CLIENT_ID, XRAY_CLIENT_SECRET, and related vars in .env.test, or skip @XRay scenarios locally.",
  },
  {
    code: "API_HTTP_ERRORS",
    severity: "warning",
    match: (o) => testsExecuted(o) && /Refit\.ApiException/i.test(o),
    title: (o) => {
      const n = countMatches(o, /Refit\.ApiException/gi);
      const statuses = [...new Set([...o.matchAll(/Response status code does not indicate success: (\d+)/g)].map((m) => m[1]))];
      const statusPart = statuses.length ? ` (HTTP ${statuses.join(", ")})` : "";
      return n > 1 ? `${n} API calls failed during tests${statusPart}.` : `An API call failed during tests${statusPart}.`;
    },
    detail: (o) => {
      const noContracts = /No contracts were returned/i.test(o);
      return noContracts ? "Some failures: authenticated user has no contracts in test environment." : undefined;
    },
    hint: "Verify test users, endpoints in .env.test, and that the target environment has the expected data (accounts, tickers, etc.).",
  },
  {
    code: "PLAYWRIGHT_DRIVER_INCOMPLETE",
    severity: "error",
    match: isPlaywrightDriverIncomplete,
    title: () => "Playwright driver bundle is incomplete in the test output folder.",
    detail: (o) => /Cannot find module ['"]([^'"]+)['"]/i.exec(o)?.[1],
    hint: "Run `dotnet build` then `pwsh bin/Debug/net8.0/playwright.ps1 install` (or rebuild so Playwright copies driver assets).",
  },
  {
    code: "PLAYWRIGHT_RUNTIME",
    severity: "error",
    match: (o) =>
      /Microsoft\.Playwright\.(TargetClosedException|PlaywrightException)/i.test(o) &&
      !isPlaywrightDriverIncomplete(o),
    title: () => "Playwright failed to launch or connect to the browser.",
    hint: "Run `playwright install` for the browsers you need, then retry. Check for sandbox/CI restrictions.",
  },
  {
    code: "TEST_HOST_CRASH",
    severity: "error",
    match: (o) =>
      /Test host process crashed/i.test(o) ||
      /The active test run was aborted/i.test(o) ||
      /Test Run Aborted\.?/i.test(o) ||
      /The test host process is not responding/i.test(o) ||
      /test host process for the source\(s\).* crashed/i.test(o) ||
      /Process is terminated due to/i.test(o),
    title: () => "The .NET test host process crashed or aborted.",
    detail: (o) => {
      const reason =
        /Reason:\s*([^\n]+)/i.exec(o)?.[1] ??
        /Test host process crashed(?:\s*\(([^)]+)\))?/i.exec(o)?.[1];
      return reason?.trim();
    },
    hint: "Inspect the stack trace above for OOM, native crashes, or unhandled exceptions. Try `dotnet test --blame-crash` or run one scenario to isolate.",
  },
  {
    code: "PORT_IN_USE",
    severity: "error",
    match: (o) =>
      /Address already in use/i.test(o) ||
      /\bEADDRINUSE\b/.test(o) ||
      /Only one usage of each socket address/i.test(o) ||
      /Failed to bind to address/i.test(o) ||
      (/Unable to start Kestrel/i.test(o) && /address already in use/i.test(o)),
    title: (o) => {
      const bindLine = /Failed to bind to address[^\n]*/i.exec(o)?.[0];
      const bindPorts = bindLine ? [...bindLine.matchAll(/:(\d{2,5})/g)].map((m) => m[1]) : [];
      const port =
        bindPorts.length > 0
          ? bindPorts[bindPorts.length - 1]
          : (/Address already in use/i.test(o)
              ? [...o.matchAll(/:(\d{2,5})/g)].map((m) => m[1]).filter((p) => parseInt(p, 10) >= 1024).pop()
              : undefined);
      return port ? `Port ${port} is already in use.` : "A required network port is already in use.";
    },
    detail: (o) => /Failed to bind to address ([^\s]+)/i.exec(o)?.[1],
    hint: "Stop the process holding the port (`lsof -i :PORT` on macOS) or change the test app's URL in .env / launchSettings.",
  },
  {
    code: "TEST_TIMEOUT",
    severity: "error",
    match: (o) =>
      /Test run timed out/i.test(o) ||
      /test run exceeded.*timeout/i.test(o) ||
      /Test execution timed out/i.test(o) ||
      /The test execution timed out after/i.test(o) ||
      (testsExecuted(o) && /System\.TimeoutException/i.test(o)),
    title: (o) => {
      const duration =
        /timed out after (\d+(?:\.\d+)?\s*(?:ms|s|sec|seconds|minutes|minute|min))/i.exec(o)?.[1] ??
        /exceeded the test run timeout of (\d+(?:\.\d+)?\s*\w+)/i.exec(o)?.[1];
      return duration ? `Test execution timed out after ${duration}.` : "Test execution timed out.";
    },
    hint: "Increase xUnit/Reqnroll timeout settings, or debug the hanging step (API wait, browser, deadlock). Run a single scenario to find the blocker.",
  },
  {
    code: "TEST_RUN_FAILED",
    severity: "error",
    match: (o) => {
      const summary = parseTestRunSummary(o);
      return summary !== undefined && summary.failed > 0;
    },
    title: (o) => {
      const s = parseTestRunSummary(o)!;
      return `Test run finished with ${s.failed} failure(s) (${s.passed} passed, ${s.skipped} skipped).`;
    },
    detail: (o) => failureBreakdown(o),
    hint: "Review failure categories above; fix step definitions, test data (CSV), env vars, or API/environment issues first.",
  },
];

export function analyzeDotnetOutput(output: string): Diagnostic[] {
  const seen = new Set<string>();
  const diagnostics: Array<{ diag: Diagnostic; order: number }> = [];

  ANALYZERS.forEach((a, order) => {
    if (!a.match(output) || seen.has(a.code)) {
      return;
    }
    seen.add(a.code);
    diagnostics.push({
      order,
      diag: {
        code: a.code,
        severity: a.severity,
        title: a.title(output),
        detail: a.detail?.(output),
        hint: a.hint,
      },
    });
  });

  diagnostics.sort((x, y) => {
    const bySeverity = SEVERITY_RANK[x.diag.severity] - SEVERITY_RANK[y.diag.severity];
    return bySeverity !== 0 ? bySeverity : x.order - y.order;
  });
  return diagnostics.map((d) => d.diag);
}
