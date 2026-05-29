import * as assert from "assert";
import { describe, it } from "node:test";
import { analyzeDotnetOutput } from "../core/diagnostics/analyzer";

function codes(output: string): string[] {
  return analyzeDotnetOutput(output).map((d) => d.code);
}

describe("diagnostics analyzer", () => {
  it("detects SDK not found (the real exit 145 output)", () => {
    const out = [
      "The command could not be loaded, possibly because:",
      "  * You intended to execute a .NET application:",
      "      The application 'test' does not exist.",
      "Requested SDK version: 8.0.418",
      "global.json file: /repo/global.json",
      "Installed SDKs:",
      "8.0.101 [/usr/local/share/dotnet/sdk]",
      "9.0.301 [/usr/local/share/dotnet/sdk]",
    ].join("\n");
    const diags = analyzeDotnetOutput(out);
    const sdk = diags.find((d) => d.code === "SDK_NOT_FOUND");
    assert.ok(sdk, "expected SDK_NOT_FOUND");
    assert.match(sdk!.title, /8\.0\.418/);
    assert.match(sdk!.detail ?? "", /8\.0\.101/);
    assert.match(sdk!.detail ?? "", /9\.0\.301/);
  });

  it("detects private package not found (NU1102) with nearest version", () => {
    const out = [
      "error NU1102: Unable to find package Acme.Automation.Core with version (>= 1.7.8)",
      "  - Found 5 version(s) in private-feed [ Nearest version: 1.4.0 ]",
      "  - Found 0 version(s) in nuget.org",
    ].join("\n");
    const diags = analyzeDotnetOutput(out);
    const pkg = diags.find((d) => d.code === "PACKAGE_NOT_FOUND");
    assert.ok(pkg, "expected PACKAGE_NOT_FOUND");
    assert.match(pkg!.title, /Acme\.Automation\.Core/);
    assert.match(pkg!.detail ?? "", /1\.4\.0/);
  });

  it("detects vulnerability treated as error (NU1902)", () => {
    const out =
      "error NU1902: Warning As Error: Package 'MailKit' 4.14.1 has a known moderate severity vulnerability";
    const pkg = analyzeDotnetOutput(out).find((d) => d.code === "VULNERABILITY_AS_ERROR");
    assert.ok(pkg);
    assert.match(pkg!.title, /MailKit/);
    assert.strictEqual(pkg!.severity, "warning");
  });

  it("detects no tests matched", () => {
    const out = "No test matches the given testcase filter `FullyQualifiedName~Nope` in X.dll";
    assert.deepStrictEqual(codes(out), ["NO_TESTS_MATCHED"]);
  });

  it("detects dotnet missing", () => {
    assert.ok(codes("zsh: command not found: dotnet").includes("DOTNET_NOT_FOUND"));
    assert.ok(codes("Error: spawn dotnet ENOENT").includes("DOTNET_NOT_FOUND"));
  });

  it("detects feed authorization failures", () => {
    assert.ok(codes("Unable to load the service index for source https://feed").includes("FEED_AUTH"));
    assert.ok(codes("Response status code does not indicate success: 401 (Unauthorized).").includes("FEED_AUTH"));
  });

  it("detects an incomplete Playwright driver (Cannot find module in .playwright)", () => {
    const out = [
      "Error: Cannot find module './utils/isomorphic/yaml'",
      "Require stack:",
      "- /repo/bin/Debug/net8.0/.playwright/package/lib/utils.js",
    ].join("\n");
    const d = analyzeDotnetOutput(out).find((x) => x.code === "PLAYWRIGHT_DRIVER_INCOMPLETE");
    assert.ok(d, "expected PLAYWRIGHT_DRIVER_INCOMPLETE");
    assert.match(d!.detail ?? "", /yaml/);
    assert.match(d!.hint, /rebuild/i);
  });

  it("detects a Playwright runtime failure (TargetClosedException: Process exited)", () => {
    const out = [
      "Microsoft.Playwright.TargetClosedException : Process exited",
      "   at Microsoft.Playwright.Playwright.CreateAsync()",
    ].join("\n");
    const codesFound = codes(out);
    assert.ok(codesFound.includes("PLAYWRIGHT_RUNTIME"));
    // Driver-incomplete is more specific and should not fire here.
    assert.ok(!codesFound.includes("PLAYWRIGHT_DRIVER_INCOMPLETE"));
  });

  it("prefers driver-incomplete over generic runtime when both signals present", () => {
    const out = [
      "Microsoft.Playwright.TargetClosedException : Process exited",
      "Error: Cannot find module './utils/isomorphic/yaml'",
      "- /repo/bin/Debug/net8.0/.playwright/package/lib/utils.js",
    ].join("\n");
    const codesFound = codes(out);
    assert.ok(codesFound.includes("PLAYWRIGHT_DRIVER_INCOMPLETE"));
    assert.ok(!codesFound.includes("PLAYWRIGHT_RUNTIME"));
  });

  it("returns errors before warnings before info", () => {
    const out = [
      "No test matches the given testcase filter `X`",
      "error NU1902: Warning As Error: Package 'MailKit' 4.14.1 has a known moderate severity vulnerability",
      "error NU1102: Unable to find package Foo with version (>= 1.0.0)",
    ].join("\n");
    const severities = analyzeDotnetOutput(out).map((d) => d.severity);
    assert.deepStrictEqual(severities, ["error", "warning", "info"]);
  });

  it("returns nothing for clean output", () => {
    assert.deepStrictEqual(analyzeDotnetOutput("Passed!  - Failed: 0, Passed: 10"), []);
  });
});
