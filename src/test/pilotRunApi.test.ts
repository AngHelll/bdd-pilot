import * as assert from "assert";
import { describe, it } from "node:test";
import {
  assertPilotRunApiExportSurface,
  isPilotRunApiV1,
  PilotRunApiV1,
} from "../api/types";

function mockApi(overrides: Partial<PilotRunApiV1> = {}): PilotRunApiV1 {
  return {
    apiVersion: 1,
    isReady: true,
    isRunInProgress: () => false,
    getRunHistory: () => [],
    getLastRun: () => null,
    getCurrentRollup: () => null,
    onDidCompleteRun: () => ({ dispose: () => undefined }),
    onDidChangeHistory: () => ({ dispose: () => undefined }),
    ...overrides,
  };
}

describe("pilotRunApi types", () => {
  it("isPilotRunApiV1 accepts valid surface", () => {
    assert.strictEqual(isPilotRunApiV1(mockApi()), true);
  });

  it("isPilotRunApiV1 rejects invalid shapes", () => {
    assert.strictEqual(isPilotRunApiV1(undefined), false);
    assert.strictEqual(isPilotRunApiV1(null), false);
    assert.strictEqual(isPilotRunApiV1({ apiVersion: 2 }), false);
    assert.strictEqual(isPilotRunApiV1({ apiVersion: 1, isReady: true }), false);
  });

  it("assertPilotRunApiExportSurface rejects execution methods", () => {
    assert.doesNotThrow(() => assertPilotRunApiExportSurface(mockApi()));
    assert.throws(
      () => assertPilotRunApiExportSurface({ ...mockApi(), run: () => undefined } as never),
      /must not expose run/,
    );
    assert.throws(
      () => assertPilotRunApiExportSurface({ ...mockApi(), cancel: () => undefined } as never),
      /must not expose cancel/,
    );
    assert.throws(
      () => assertPilotRunApiExportSurface({ ...mockApi(), debug: () => undefined } as never),
      /must not expose debug/,
    );
  });
});
