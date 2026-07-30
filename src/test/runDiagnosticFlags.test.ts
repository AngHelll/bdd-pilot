import * as assert from "assert";
import { describe, it } from "node:test";
import { normalizeCliVerbosity } from "../core/config/types";
import { formatDiagnosticRunFlagsParts } from "../core/runner/runDiagnosticFlags";

describe("runDiagnosticFlags", () => {
  it("normalizeCliVerbosity maps short forms and rejects unknown", () => {
    assert.strictEqual(normalizeCliVerbosity(""), "");
    assert.strictEqual(normalizeCliVerbosity("detailed"), "detailed");
    assert.strictEqual(normalizeCliVerbosity("d"), "detailed");
    assert.strictEqual(normalizeCliVerbosity("DIAG"), "diagnostic");
    assert.strictEqual(normalizeCliVerbosity("nope"), "");
  });

  it("formatDiagnosticRunFlagsParts omits defaults", () => {
    assert.deepStrictEqual(
      formatDiagnosticRunFlagsParts({
        runCliVerbosity: "",
        runBlame: false,
        runBlameHang: "off",
        runBlameHangTimeout: "10m",
      }),
      [],
    );
  });

  it("formatDiagnosticRunFlagsParts includes non-default diagnostic flags", () => {
    assert.deepStrictEqual(
      formatDiagnosticRunFlagsParts({
        runCliVerbosity: "minimal",
        runBlame: true,
        runBlameHang: "on",
        runBlameHangTimeout: "5m",
      }),
      ["-v minimal", "blame", "blame-hang 5m"],
    );
  });
});
