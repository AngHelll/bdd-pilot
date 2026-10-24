import * as assert from "assert";
import { describe, it } from "node:test";
import {
  dashboardEditorThemeBlock,
  dashboardLayoutCss,
  dashboardStageThemeBlock,
  resolveDashboardTheme,
  STAGE_BACKGROUNDS,
  STAGE_TOKENS,
} from "../core/results/dashboardTheme";

function channel(hex: string, index: number): number {
  const value = parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function contrast(ink: string, background: string): number {
  const luminance = (hex: string) =>
    0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2);
  const lighter = Math.max(luminance(ink), luminance(background));
  const darker = Math.min(luminance(ink), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

describe("dashboardTheme", () => {
  it("keeps unknown theme values on editor", () => {
    assert.strictEqual(resolveDashboardTheme(undefined), "editor");
    assert.strictEqual(resolveDashboardTheme("editor"), "editor");
    assert.strictEqual(resolveDashboardTheme("stage"), "stage");
    assert.strictEqual(resolveDashboardTheme("STAGE"), "editor");
  });

  it("does not use VS Code variables in the Stage block", () => {
    const css = dashboardStageThemeBlock();
    assert.doesNotMatch(css, /var\(--vscode-/);
    assert.match(css, /#0d1219/);
    assert.match(css, /#141d2a/);
    assert.match(css, /#1b2636/);
    assert.match(css, /#e8eef6/);
    assert.match(css, /#b8c6d8/);
    assert.match(css, /#8195ad/);
  });

  it("maps the editor chrome to VS Code tokens", () => {
    const css = dashboardEditorThemeBlock();
    assert.match(css, /--vscode-editor-background/);
    assert.match(css, /--vscode-button-background/);
    assert.match(css, /--vscode-button-secondaryBackground/);
    assert.match(css, /--vscode-textLink-foreground/);
    assert.match(css, /--vscode-testing-iconPassed/);
    assert.doesNotMatch(css, /#3ddc97|#ff5d73|#f5b83d|#38d6f5/);
  });

  it("meets AA contrast for Stage text and outcome ink", () => {
    const inks = [
      STAGE_TOKENS["--pilot-text"],
      STAGE_TOKENS["--pilot-text-2"],
      STAGE_TOKENS["--pilot-muted"],
      STAGE_TOKENS["--pilot-ok"],
      STAGE_TOKENS["--pilot-danger"],
      STAGE_TOKENS["--pilot-warn"],
    ];
    for (const background of STAGE_BACKGROUNDS) {
      for (const ink of inks) {
        assert.ok(
          ink && contrast(ink, background) >= 4.5,
          `${ink} on ${background} = ${ink ? contrast(ink, background) : "missing"}`,
        );
      }
    }
    const accent = STAGE_TOKENS["--pilot-accent"];
    const accentInk = STAGE_TOKENS["--pilot-accent-ink"];
    assert.ok(accent && accentInk && contrast(accentInk, accent) >= 4.5);
  });

  it("stacks the rail under the table below 760px and does not cap cards at 560px", () => {
    const css = dashboardLayoutCss();
    assert.match(css, /max-width:\s*760px/);
    assert.doesNotMatch(css, /560px/);
    assert.match(css, /\.stats \{[^}]*align-items:\s*center/);
    assert.match(css, /\.history-chart \{[^}]*width:\s*auto/);
    assert.match(css, /body \{[^}]*overflow:\s*hidden/);
    assert.match(css, /#dash-main, #dash-rail \{[^}]*overflow:\s*auto/);
  });
});
