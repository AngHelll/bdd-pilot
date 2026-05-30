import * as assert from "assert";
import { describe, it } from "node:test";
import { resolveLocale, t } from "../core/i18n";

describe("i18n", () => {
  it("resolveLocale honors explicit en and es", () => {
    assert.strictEqual(resolveLocale("en", "es"), "en");
    assert.strictEqual(resolveLocale("es", "en"), "es");
  });

  it("resolveLocale auto maps Spanish VS Code UI", () => {
    assert.strictEqual(resolveLocale("auto", "es"), "es");
    assert.strictEqual(resolveLocale("auto", "es-MX"), "es");
    assert.strictEqual(resolveLocale("auto", "en-US"), "en");
    assert.strictEqual(resolveLocale(undefined, "en"), "en");
  });

  it("t returns Spanish strings", () => {
    assert.strictEqual(t("es", "action.run"), "Ejecutar");
    assert.match(t("es", "envGuard.prodConfirm"), /PRODUCCIÓN/);
  });

  it("t interpolates params", () => {
    assert.strictEqual(
      t("en", "toast.profileSaved", { name: "Smoke" }),
      'Saved profile "Smoke".',
    );
    assert.strictEqual(
      t("es", "prompt.selectStage", { current: "dev" }),
      "Actual: dev. Selecciona entorno (STAGE)",
    );
  });

  it("t falls back to English for unknown locale keys", () => {
    assert.strictEqual(t("en", "action.debug"), "Debug");
  });
});
