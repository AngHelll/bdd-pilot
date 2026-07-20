import * as assert from "assert";
import { describe, it } from "node:test";
import {
  formatEffectiveRunFlagsParts,
  formatStageRunFlagsAppliedMessage,
  parseStageRunByStage,
  resolveEffectiveRunFlags,
  stageRunFlagsDifferFromGlobal,
} from "../core/runner/stageRunFlags";

describe("stageRunFlags", () => {
  it("inherits globals when byStage empty or stage missing", () => {
    const effective = resolveEffectiveRunFlags({
      stage: "test",
      runConfiguration: "Debug",
      runSettingsPath: "config/test.runsettings",
      byStage: {},
    });
    assert.deepStrictEqual(effective, {
      runConfiguration: "Debug",
      runSettingsPath: "config/test.runsettings",
    });
  });

  it("overrides configuration and runSettings for stage", () => {
    const effective = resolveEffectiveRunFlags({
      stage: "stg",
      runConfiguration: "Debug",
      runSettingsPath: "config/test.runsettings",
      byStage: {
        stg: { configuration: "Release", runSettings: "config/stg.runsettings" },
      },
    });
    assert.deepStrictEqual(effective, {
      runConfiguration: "Release",
      runSettingsPath: "config/stg.runsettings",
    });
  });

  it("empty string override clears global", () => {
    const effective = resolveEffectiveRunFlags({
      stage: "prod",
      runConfiguration: "Release",
      runSettingsPath: "config/prod.runsettings",
      byStage: {
        prod: { configuration: "", runSettings: "" },
      },
    });
    assert.deepStrictEqual(effective, {
      runConfiguration: "",
      runSettingsPath: "",
    });
  });

  it("partial override only touches present keys", () => {
    const effective = resolveEffectiveRunFlags({
      stage: "stg",
      runConfiguration: "Debug",
      runSettingsPath: "config/test.runsettings",
      byStage: {
        stg: { configuration: "Release" },
      },
    });
    assert.strictEqual(effective.runConfiguration, "Release");
    assert.strictEqual(effective.runSettingsPath, "config/test.runsettings");
  });

  it("parseStageRunByStage ignores unknown stages and invalid shapes", () => {
    const parsed = parseStageRunByStage({
      stg: { configuration: "Release", runSettings: "a.runsettings" },
      qa: { configuration: "Debug" },
      test: "nope",
      prod: { configuration: "Nope" },
    });
    assert.deepStrictEqual(parsed.stg, {
      configuration: "Release",
      runSettings: "a.runsettings",
    });
    assert.strictEqual(parsed.test, undefined);
    assert.deepStrictEqual(parsed.prod, { configuration: "" });
  });

  it("invalid configuration string on override becomes empty", () => {
    const parsed = parseStageRunByStage({
      dev: { configuration: "Invalid" },
    });
    assert.deepStrictEqual(parsed.dev, { configuration: "" });
    const effective = resolveEffectiveRunFlags({
      stage: "dev",
      runConfiguration: "Debug",
      runSettingsPath: "",
      byStage: parsed,
    });
    assert.strictEqual(effective.runConfiguration, "");
  });

  it("stageRunFlagsDifferFromGlobal and format helpers", () => {
    const global = { runConfiguration: "Debug" as const, runSettingsPath: "t.runsettings" };
    const effective = {
      runConfiguration: "Release" as const,
      runSettingsPath: "config/stg.runsettings",
    };
    assert.strictEqual(stageRunFlagsDifferFromGlobal(global, effective), true);
    assert.strictEqual(stageRunFlagsDifferFromGlobal(effective, effective), false);
    assert.strictEqual(
      formatStageRunFlagsAppliedMessage(effective),
      "[bdd-pilot] Stage run flags: configuration=Release, settings=stg.runsettings",
    );
    assert.deepStrictEqual(formatEffectiveRunFlagsParts(effective), [
      "Release",
      "stg.runsettings",
    ]);
    assert.deepStrictEqual(
      formatEffectiveRunFlagsParts({ runConfiguration: "", runSettingsPath: "" }),
      [],
    );
  });
});
