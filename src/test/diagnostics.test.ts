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

  it("detects feed authorization failures during restore", () => {
    assert.ok(codes("Unable to load the service index for source https://feed").includes("FEED_AUTH"));
    assert.ok(codes("error NU1301: Unable to load the service index for source https://feed").includes("FEED_AUTH"));
  });

  it("does not treat API 401 as NuGet feed auth when tests ran", () => {
    const out = [
      "Test run for /repo/bin/Debug/net8.0/App.dll",
      "Failed Successfully authenticate [FAIL]",
      "Refit.ApiException : Response status code does not indicate success: 401 (Unauthorized).",
      "Failed!  - Failed:   1, Passed:     0, Skipped:     0, Total:     1",
    ].join("\n");
    const found = codes(out);
    assert.ok(!found.includes("FEED_AUTH"), "API 401 should not trigger FEED_AUTH");
    assert.ok(found.includes("API_HTTP_ERRORS"));
  });

  it("detects pending step definitions after test run", () => {
    const out = [
      "Test run for /repo/bin/Debug/net8.0/App.dll",
      "Reqnroll.xUnit.ReqnrollPlugin.XUnitPendingStepException : Test pending: No matching step definition",
      "Failed!  - Failed:   6, Passed:     0, Skipped:     0, Total:     6",
    ].join("\n");
    const found = codes(out);
    assert.ok(found.includes("PENDING_STEPS"));
    assert.ok(found.includes("TEST_RUN_FAILED"));
  });

  it("detects missing UserProfileTracking users", () => {
    const out = [
      "Test run for /repo/bin/Debug/net8.0/App.dll",
      "System.InvalidOperationException : No available users found in UserProfileTracking CSV for BDD tests",
      "Failed!  - Failed:   2, Passed:     0, Skipped:     0, Total:     2",
    ].join("\n");
    assert.ok(codes(out).includes("NO_TEST_USERS"));
  });

  it("detects invalid AWS credentials for DynamoDB", () => {
    const out = [
      "Test run for /repo/bin/Debug/net8.0/App.dll",
      "Amazon.DynamoDBv2.AmazonDynamoDBException : The security token included in the request is invalid.",
      "Failed!  - Failed:   1, Passed:     0, Skipped:     0, Total:     1",
    ].join("\n");
    assert.ok(codes(out).includes("AWS_CREDENTIALS"));
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

  it("detects test host crash", () => {
    const out = [
      "Test run for /repo/bin/Debug/net8.0/App.dll",
      "The active test run was aborted. Reason: Test host process crashed",
      "Test host process for the source(s) /repo/bin/Debug/net8.0/App.dll crashed.",
    ].join("\n");
    const found = codes(out);
    assert.ok(found.includes("TEST_HOST_CRASH"));
    const d = analyzeDotnetOutput(out).find((x) => x.code === "TEST_HOST_CRASH");
    assert.match(d!.detail ?? "", /Test host process crashed/i);
  });

  it("detects port already in use", () => {
    const out = [
      "System.Net.Sockets.SocketException (98): Address already in use",
      "Failed to bind to address http://127.0.0.1:5050: address already in use.",
    ].join("\n");
    const d = analyzeDotnetOutput(out).find((x) => x.code === "PORT_IN_USE");
    assert.ok(d);
    assert.match(d!.title, /5050/);
    assert.match(d!.detail ?? "", /127\.0\.0\.1:5050/);
  });

  it("detects test execution timeout", () => {
    const out = [
      "Test run for /repo/bin/Debug/net8.0/App.dll",
      "System.TimeoutException : Test execution timed out after 60000 ms",
      "Failed!  - Failed:   1, Passed:     0, Skipped:     0, Total:     1",
    ].join("\n");
    const found = codes(out);
    assert.ok(found.includes("TEST_TIMEOUT"));
    const d = analyzeDotnetOutput(out).find((x) => x.code === "TEST_TIMEOUT");
    assert.match(d!.title, /60000 ms/);
  });

  it("returns nothing for clean output", () => {
    assert.deepStrictEqual(analyzeDotnetOutput("Passed!  - Failed: 0, Passed: 10"), []);
  });
});
