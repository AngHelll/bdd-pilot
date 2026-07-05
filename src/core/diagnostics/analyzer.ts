import { PilotLocale, t } from "../i18n";
import { diagnosticHint } from "./diagnosticCatalog";
import { failureBreakdown } from "./failureBreakdown";

export type DiagnosticSeverity = "error" | "warning" | "info";

export interface Diagnostic {
  code: string;
  severity: DiagnosticSeverity;
  title: string;
  detail?: string;
  hint: string;
}

export interface AnalyzeDotnetOutputOptions {
  extendedRules?: boolean;
  locale?: PilotLocale;
}

type Analyzer = {
  code: string;
  severity: DiagnosticSeverity;
  extended?: boolean;
  match: (output: string) => boolean;
  build: (output: string, locale: PilotLocale, extendedRules: boolean) => Omit<Diagnostic, "code" | "severity">;
};

const SEVERITY_RANK: Record<DiagnosticSeverity, number> = {
  error: 0,
  warning: 1,
  info: 2,
};

const DEFAULT_OPTIONS: Required<AnalyzeDotnetOutputOptions> = {
  extendedRules: false,
  locale: "en",
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

export function testsExecutedInOutput(output: string): boolean {
  return (
    /Test run for .+\.dll/.test(output) ||
    /\[xUnit\.net/.test(output) ||
    parseTestRunSummary(output) !== undefined
  );
}

function testsExecuted(output: string): boolean {
  return testsExecutedInOutput(output);
}

function isPlaywrightDriverIncomplete(output: string): boolean {
  return (
    /Cannot find module ['"].*\.playwright/i.test(output) ||
    (/\/\.playwright\/package\//i.test(output) && /Cannot find module/i.test(output))
  );
}

const TEST_DATA_MATCH =
  /No available users|No suitable user|No hay usuarios|test user|test data|fixture|The array cannot be null or empty/i;
const TEST_DATA_COUNT = /No available users|No suitable user|No hay usuarios|test user|test data|fixture|The array cannot be null or empty/gi;

function testDataSetupDetail(output: string): string | undefined {
  const samples = [
    ...new Set(
      [
        ...output.matchAll(
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
}

const ANALYZERS: Analyzer[] = [
  {
    code: "DOTNET_NOT_FOUND",
    severity: "error",
    match: (o) => /command not found: dotnet|spawn dotnet ENOENT|dotnet: not found/i.test(o),
    build: (_o, locale) => ({
      title: t(locale, "diagnostic.DOTNET_NOT_FOUND.title"),
      hint: diagnosticHint(locale, "DOTNET_NOT_FOUND"),
    }),
  },
  {
    code: "SDK_NOT_FOUND",
    severity: "error",
    match: (o) =>
      /Requested SDK version:/i.test(o) &&
      (/does not exist/i.test(o) || /No .NET SDKs were found/i.test(o) || /Installed SDKs:/i.test(o)),
    build: (o, locale) => {
      const req = /Requested SDK version:\s*([^\s]+)/i.exec(o)?.[1];
      const installed = [...o.matchAll(/^\s*([\d.]+)\s*\[/gm)].map((m) => m[1]);
      return {
        title: req
          ? t(locale, "diagnostic.SDK_NOT_FOUND.title", { version: req })
          : t(locale, "diagnostic.SDK_NOT_FOUND.titleFallback"),
        detail: installed.length ? `Installed SDKs: ${installed.join(", ")}` : undefined,
        hint: diagnosticHint(locale, "SDK_NOT_FOUND"),
      };
    },
  },
  {
    code: "FEED_AUTH",
    severity: "error",
    match: (o) =>
      /Unable to load the service index for source/i.test(o) ||
      /\bNU1301\b/.test(o) ||
      (/(?:nuget|feed|restore|service index)/i.test(o) && /401 \(Unauthorized\)/i.test(o) && !testsExecuted(o)),
    build: (_o, locale) => ({
      title: t(locale, "diagnostic.FEED_AUTH.title"),
      hint: diagnosticHint(locale, "FEED_AUTH"),
    }),
  },
  {
    code: "PACKAGE_NOT_FOUND",
    severity: "error",
    match: (o) => /\bNU1102\b/.test(o),
    build: (o, locale) => {
      const pkg = /Unable to find package ([^\s]+)/i.exec(o)?.[1];
      const nearest = /Nearest version:\s*([^\]\s]+)/i.exec(o)?.[1];
      return {
        title: pkg
          ? t(locale, "diagnostic.PACKAGE_NOT_FOUND.title", { pkg })
          : t(locale, "diagnostic.PACKAGE_NOT_FOUND.titleFallback"),
        detail: nearest ? `Nearest available version in feed: ${nearest}` : undefined,
        hint: diagnosticHint(locale, "PACKAGE_NOT_FOUND"),
      };
    },
  },
  {
    code: "VULNERABILITY_AS_ERROR",
    severity: "warning",
    match: (o) => /\bNU190[0-9]\b/.test(o),
    build: (o, locale) => {
      const pkg = /Package '([^']+)'/i.exec(o)?.[1];
      return {
        title: pkg
          ? t(locale, "diagnostic.VULNERABILITY_AS_ERROR.title", { pkg })
          : t(locale, "diagnostic.VULNERABILITY_AS_ERROR.titleFallback"),
        hint: diagnosticHint(locale, "VULNERABILITY_AS_ERROR"),
      };
    },
  },
  {
    code: "NO_TESTS_MATCHED",
    severity: "info",
    match: (o) => /No test matches the given testcase filter/i.test(o),
    build: (_o, locale) => ({
      title: t(locale, "diagnostic.NO_TESTS_MATCHED.title"),
      hint: diagnosticHint(locale, "NO_TESTS_MATCHED"),
    }),
  },
  {
    code: "PENDING_STEPS",
    severity: "error",
    match: (o) => testsExecuted(o) && /XUnitPendingStepException|No matching step definition found/i.test(o),
    build: (o, locale) => {
      const n = countMatches(o, /XUnitPendingStepException|No matching step definition found/gi);
      const features = [...new Set([...o.matchAll(/in ([^\n]+\.feature):line \d+/g)].map((m) => m[1]))];
      let detail: string | undefined;
      if (features.length > 0) {
        const shown = features.slice(0, 5);
        const suffix = features.length > 5 ? ` (+${features.length - 5} more)` : "";
        detail = `Affected features: ${shown.join(", ")}${suffix}`;
      }
      return {
        title:
          n > 1
            ? t(locale, "diagnostic.PENDING_STEPS.titleMany", { n })
            : t(locale, "diagnostic.PENDING_STEPS.title"),
        detail,
        hint: diagnosticHint(locale, "PENDING_STEPS"),
      };
    },
  },
  {
    code: "AMBIGUOUS_STEPS",
    severity: "error",
    match: (o) => testsExecuted(o) && /Ambiguous step definitions found/i.test(o),
    build: (o, locale) => ({
      title: t(locale, "diagnostic.AMBIGUOUS_STEPS.title"),
      detail: /Ambiguous step definitions found for step '([^']+)'/i.exec(o)?.[1],
      hint: diagnosticHint(locale, "AMBIGUOUS_STEPS"),
    }),
  },
  {
    code: "TEST_DATA_SETUP",
    severity: "error",
    match: (o) => testsExecuted(o) && TEST_DATA_MATCH.test(o),
    build: (o, locale) => {
      const n = countMatches(o, TEST_DATA_COUNT);
      return {
        title:
          n > 1
            ? t(locale, "diagnostic.TEST_DATA_SETUP.titleMany", { n })
            : t(locale, "diagnostic.TEST_DATA_SETUP.title"),
        detail: testDataSetupDetail(o),
        hint: diagnosticHint(locale, "TEST_DATA_SETUP"),
      };
    },
  },
  {
    code: "AWS_CREDENTIALS",
    severity: "error",
    extended: true,
    match: (o) => testsExecuted(o) && /The security token included in the request is invalid/i.test(o),
    build: (_o, locale) => ({
      title: t(locale, "diagnostic.AWS_CREDENTIALS.title"),
      hint: diagnosticHint(locale, "AWS_CREDENTIALS"),
    }),
  },
  {
    code: "XRAY_CONFIG",
    severity: "warning",
    extended: true,
    match: (o) => testsExecuted(o) && /X-Ray configuration should be valid/i.test(o),
    build: (_o, locale) => ({
      title: t(locale, "diagnostic.XRAY_CONFIG.title"),
      hint: diagnosticHint(locale, "XRAY_CONFIG"),
    }),
  },
  {
    code: "API_HTTP_ERRORS",
    severity: "warning",
    extended: true,
    match: (o) => testsExecuted(o) && /Refit\.ApiException/i.test(o),
    build: (o, locale) => {
      const n = countMatches(o, /Refit\.ApiException/gi);
      const statuses = [...new Set([...o.matchAll(/Response status code does not indicate success: (\d+)/g)].map((m) => m[1]))];
      const statusPart = statuses.length ? statuses.join(", ") : "";
      const title =
        n > 1
          ? t(locale, "diagnostic.API_HTTP_ERRORS.titleMany", {
              n,
              statuses: statusPart ? ` (HTTP ${statusPart})` : "",
            })
          : t(locale, "diagnostic.API_HTTP_ERRORS.title", {
              statuses: statusPart ? ` (HTTP ${statusPart})` : "",
            });
      const noContracts = /No contracts were returned/i.test(o);
      return {
        title,
        detail: noContracts ? t(locale, "diagnostic.API_HTTP_ERRORS.detailNoContracts") : undefined,
        hint: diagnosticHint(locale, "API_HTTP_ERRORS"),
      };
    },
  },
  {
    code: "PLAYWRIGHT_DRIVER_INCOMPLETE",
    severity: "error",
    match: isPlaywrightDriverIncomplete,
    build: (o, locale) => ({
      title: t(locale, "diagnostic.PLAYWRIGHT_DRIVER_INCOMPLETE.title"),
      detail: /Cannot find module ['"]([^'"]+)['"]/i.exec(o)?.[1],
      hint: diagnosticHint(locale, "PLAYWRIGHT_DRIVER_INCOMPLETE"),
    }),
  },
  {
    code: "PLAYWRIGHT_RUNTIME",
    severity: "error",
    match: (o) =>
      /Microsoft\.Playwright\.(TargetClosedException|PlaywrightException)/i.test(o) &&
      !isPlaywrightDriverIncomplete(o),
    build: (_o, locale) => ({
      title: t(locale, "diagnostic.PLAYWRIGHT_RUNTIME.title"),
      hint: diagnosticHint(locale, "PLAYWRIGHT_RUNTIME"),
    }),
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
    build: (o, locale) => {
      const reason =
        /Reason:\s*([^\n]+)/i.exec(o)?.[1] ??
        /Test host process crashed(?:\s*\(([^)]+)\))?/i.exec(o)?.[1];
      return {
        title: t(locale, "diagnostic.TEST_HOST_CRASH.title"),
        detail: reason?.trim(),
        hint: diagnosticHint(locale, "TEST_HOST_CRASH"),
      };
    },
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
    build: (o, locale) => {
      const bindLine = /Failed to bind to address[^\n]*/i.exec(o)?.[0];
      const bindPorts = bindLine ? [...bindLine.matchAll(/:(\d{2,5})/g)].map((m) => m[1]) : [];
      const port =
        bindPorts.length > 0
          ? bindPorts[bindPorts.length - 1]
          : (/Address already in use/i.test(o)
              ? [...o.matchAll(/:(\d{2,5})/g)].map((m) => m[1]).filter((p) => parseInt(p, 10) >= 1024).pop()
              : undefined);
      return {
        title: port
          ? t(locale, "diagnostic.PORT_IN_USE.title", { port })
          : t(locale, "diagnostic.PORT_IN_USE.titleFallback"),
        detail: /Failed to bind to address ([^\s]+)/i.exec(o)?.[1],
        hint: diagnosticHint(locale, "PORT_IN_USE"),
      };
    },
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
    build: (o, locale) => {
      const duration =
        /timed out after (\d+(?:\.\d+)?\s*(?:ms|s|sec|seconds|minutes|minute|min))/i.exec(o)?.[1] ??
        /exceeded the test run timeout of (\d+(?:\.\d+)?\s*\w+)/i.exec(o)?.[1];
      return {
        title: duration
          ? t(locale, "diagnostic.TEST_TIMEOUT.title", { duration })
          : t(locale, "diagnostic.TEST_TIMEOUT.titleFallback"),
        hint: diagnosticHint(locale, "TEST_TIMEOUT"),
      };
    },
  },
  {
    code: "TEST_RUN_FAILED",
    severity: "error",
    match: (o) => {
      const summary = parseTestRunSummary(o);
      return summary !== undefined && summary.failed > 0;
    },
    build: (o, locale, extendedRules) => {
      const s = parseTestRunSummary(o)!;
      return {
        title: t(locale, "diagnostic.TEST_RUN_FAILED.title", {
          failed: s.failed,
          passed: s.passed,
          skipped: s.skipped,
        }),
        detail: failureBreakdown(o, locale, extendedRules),
        hint: diagnosticHint(locale, "TEST_RUN_FAILED"),
      };
    },
  },
];

export function analyzeDotnetOutput(output: string, options?: AnalyzeDotnetOutputOptions): Diagnostic[] {
  const { extendedRules, locale } = { ...DEFAULT_OPTIONS, ...options };
  const seen = new Set<string>();
  const diagnostics: Array<{ diag: Diagnostic; order: number }> = [];

  ANALYZERS.forEach((a, order) => {
    if (a.extended && !extendedRules) {
      return;
    }
    if (!a.match(output) || seen.has(a.code)) {
      return;
    }
    seen.add(a.code);
    const built = a.build(output, locale, extendedRules);
    diagnostics.push({
      order,
      diag: {
        code: a.code,
        severity: a.severity,
        ...built,
      },
    });
  });

  diagnostics.sort((x, y) => {
    const bySeverity = SEVERITY_RANK[x.diag.severity] - SEVERITY_RANK[y.diag.severity];
    return bySeverity !== 0 ? bySeverity : x.order - y.order;
  });
  return diagnostics.map((d) => d.diag);
}
