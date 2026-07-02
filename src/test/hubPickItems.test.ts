import * as assert from "node:assert";
import { describe, it } from "node:test";
import { buildModeHubPickItems, buildStageHubPickItems } from "../core/config/hubPickItems";

describe("hubPickItems", () => {
  it("buildStageHubPickItems marks current stage with check", () => {
    const items = buildStageHubPickItems("test", "en");
    const current = items.find((item) => item.value === "test");
    assert.ok(current);
    assert.strictEqual(current.label, "$(check) test");
    assert.strictEqual(current.description, "Integration (default)");
  });

  it("buildStageHubPickItems warns for stg/prod", () => {
    const items = buildStageHubPickItems("dev", "en");
    const stg = items.find((item) => item.value === "stg");
    const prod = items.find((item) => item.value === "prod");
    assert.ok(stg?.description.includes("$(warning)"));
    assert.ok(prod?.description.includes("production"));
  });

  it("buildStageHubPickItems localizes descriptions in Spanish", () => {
    const items = buildStageHubPickItems("dev", "es");
    const test = items.find((item) => item.value === "test");
    assert.strictEqual(test?.description, "Integración (por defecto)");
  });

  it("buildModeHubPickItems marks current mode with check and thread hints", () => {
    const items = buildModeHubPickItems("parallel", "en");
    const current = items.find((item) => item.value === "parallel");
    assert.strictEqual(current?.label, "$(check) parallel");
    assert.strictEqual(current?.description, "4 threads · parallel collections");
    const ci = items.find((item) => item.value === "ci");
    assert.ok(ci?.description.includes("8 threads"));
  });
});
