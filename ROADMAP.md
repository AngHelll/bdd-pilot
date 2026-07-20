# BDD Pilot — Roadmap

> Living document: what shipped, what is in progress, and what comes next.  
> **Current release: v1.24.0** · **Marketplace: v1.24.0** · **Next: backlog Tier 2/3** · **486 unit tests**

---

## At a glance

| Status | Item |
|--------|------|
| ✅ Shipped (GitHub + Marketplace) | v0.1.0 → **v1.24.0** |
| 🎯 Next | backlog Tier 2/3 |
| 🎯 Ecosystem | Jarvis cross-ext ✅ |
| 🏁 Goal | **v1.x** — ecosystem APIs (Run ✅ · gate ✅ · Jarvis Capa B ✅) · dotnet flags ✅ · MCP post-v1.0 |

**Companion extension:** [BDD Guardian](https://github.com/AngHelll/bdd-guardian) (navigation & bindings). Pilot = execution.

---

## Versioning (0.x)

Semver stays conservative until Marketplace + stable API:

| Version | Milestone |
|---------|-----------|
| **0.1.0** | First usable beta — tree, run/debug, dashboard, profiles, compact tree labels |
| **0.2.0** | Phase A partial — outline rows in tree, tag inheritance, result roll-up on folders |
| **0.2.1** | Live execution progress during `dotnet test` |
| **0.2.2** | Per-row outline filter, configurable filter mapping, `config/env.example` |
| **0.2.3** | CodeLens **Run row** on Examples table lines |
| **0.2.4** | Partial runs **preserve** prior tree results (scoped clear) |
| **0.2.5** | Project/solution picker, CHANGELOG, issue templates |
| **0.2.6** | Runtime diagnostics (pending steps, API/AWS/users); FEED_AUTH scoped to NuGet restore |
| **0.2.7** | ROADMAP/README sync; Marketplace release packaging |
| **0.3.0** | Phase C — CI sample project, README assets, full Marketplace gate |
| **1.0.0** | Stable public release |
| **1.1.0** | Run lifecycle & VS Code state parity (post-debug TRX, cancel partial, TE errored/skip reasons, status bar running) |
| **1.2.0** | Outcome continuity (TRX rehydrate on activate, tree skip tooltips, rehydrate settings) |
| **1.2.1** | Dashboard continuity (last known snapshot, rehydrate notice, scope column, canceled run history) |
| **1.2.2** | Dashboard actions (Show Output, Re-run Failed, Copy for AI — parity with post-run toast) |
| **1.2.3** | Tree UX — `displayMode`, pilot summary row, dashboard scope labels, toolbar cleanup |
| **1.2.5** | `.slnx` solution support (`slnx-support.md`) |
| **1.2.6** | Test Explorer `displayMode` parity (`test-explorer-display-mode.md`, renum. de 1.2.4) |
| **1.2.7** | Bundle comunicación: post-run unificado + progress i18n + empty-state guide |
| **1.2.8** | Run target performance — prefer BDD csproj over solution + debounce list-tests |
| **1.3.0** | Visual UX v2 — compact status bar hub, hub descriptions, execution feedback (tree icon + activity badge) |
| **1.4.0** | Ecosystem API — `PilotRunApiV1` via `extension.exports`; `docs/EXTENSION_API.md`; Reqnroll hyphen matching |
| **1.5.0** | Pre-run binding gate (P2b) — Guardian `resolveStep`; `bddPilot.preRun.bindingGate` |
| **1.6.0** | Diagnostics hygiene — core/extended rules, Output summary, i18n diagnostics · spec `diagnostics-hygiene-v1.6.md` |
| **1.7.0** | Tree search visibility + run filtered — chip, persist, `@tag` syntax · spec `tree-search-visibility-v1.7.md` |
| **1.7.1** | Controls polish (Slice C) — debug inline, GroupBy icon, toolbar overflow · spec `controls-polish-v1.7.1.md` |
| **1.7.2** | Diagnostics on tree summary row — top-1 from last run snapshot · spec `diagnostics-tree-summary-v1.7.2.md` |
| **1.7.3** | README refresh + dashboard last-run diagnostic (A+B) · spec `readme-dashboard-v1.7.3.md` |
| **1.21.0** | AI snapshot from TRX — opt-in Copy for AI post-reload · spec `ai-snapshot-from-trx-v1.21.0.md` |
| **1.20.0** | Mapping UX — unmapped list + comando + summary chip · spec `mapping-ux-v1.20.0.md` |
| **1.19.0** | Security audit + strict prod — sanitizer patterns + `allowProductionRuns` · spec `security-audit-strict-prod-v1.19.0.md` |
| **1.18.1** | Settings i18n — defaultStage/defaultMode enumDescriptions EN/ES · spec `i18n-default-stage-mode-v1.18.1.md` |
| **1.18.0** | Tree↔TE parity tests + display settings core · spec `tree-te-parity-v1.18.0.md` |
| **1.17.0** | Matching v2 — TRX↔Gherkin FQN / Theory-first · spec `matching-v2-v1.17.0.md` |
| **1.16.0** | Dashboard runKind — distinguish run/debug/profile in history + API · spec `dashboard-run-kind-v1.16.0.md` |
| **1.15.1** | Settings i18n — enumDescriptions ES for 7 tree/feedback/outcomes settings · spec `i18n-settings-enums-v1.15.1.md` |
| **1.15.0** | Env Tier 1 — `.env.<stage>.local` loader, hub env tooltip · spec `env-tier1-v1.15.0.md` |
| **1.14.0** | Agent Surface — discover enrich, rehydrate last-failure artifact, README recipes · spec `mcp-agent-surface-v1.14.md` |
| **1.13.0** | MCP Fase 2 — extension MCP provider, VSIX headless bundle, last-failure artifact · spec `mcp-fase2-v1.13.md` |
| **1.12.0** | MCP Fase 1 — stdio server, 4 read-only tools, path jail + sanitize · spec `mcp-fase1-v1.12.md` |
| **1.11.0** | pilot-cli v2 — `discover`, `build-filter`, `failure-context` (JSON); pre-MCP · spec `pilot-cli-v2-v1.11.md` |
| **1.10.0** | Modularize `extension.ts` — `src/activation/` wiring modules · spec `extension-modularize-v1.10.md` |
| **1.9.5** | Env Tier 0 — env.example load order, generic stg confirm, sample `.env.test` · spec `env-tier0-v1.9.5.md` |
| **1.9.4** | Iconography polish — README assets, palette icons, Iconography docs · spec `iconography-polish-v1.9.4.md` |
| **1.9.3** | Binding gate pre-flight — stage/gate antes de progress; decline ≠ cancel; TE paridad · spec `binding-gate-pre-flight-v1.9.3.md` |
| **1.9.2** | Scoped run progress — summary sin rollup global, 0/N, notif no-cancel, fallos en message, ambiguous continue · spec `scoped-run-progress-v1.9.2.md` |
| **1.9.1** | Cancel polish — pre-run discovery cancel + generic cancel toast · spec `cancel-polish-v1.9.1.md` |
| **1.9.0** | Worktree ecosystem parity — TRX mapping report, tree `not_in_trx`, rehydrate↔history gate, summary chip lite, `matchRunTarget` domain/tag · spec `worktree-ecosystem-parity-v1.9.0.md` |
| **1.8.4** | Binding gate UX — ambiguous → Output; unbound warn non-modal · spec `binding-gate-ux-v1.8.4.md` |
| **1.8.3** | Fix flaky dashboard scenario links (webview script + path resolve) |
| **1.8.2** | Live progress on pilot summary row — `formatProgressMessage` in description during run · spec `live-progress-summary-v1.8.2.md` |
| **1.8.1** | Flaky dashboard enriched — avg duration, last error, open scenario · spec `flaky-enriched-v1.8.1.md` |
| **1.8.0** | dotnet run flags P1 — configuration, no-build, runsettings · spec `dotnet-run-flags-v1.8.md` |

Internal labels **Phase A / B / C** track *scope*, not the published version number.

---

## Ecosystem alignment (ForgeOne)

> Contratos congelados en `bdd-jarvis/docs-internal/specs/CONTRACT-*.md`.  
> **Actualizado:** 2026-07-07 · watch Jarvis Capa B cerrado

| Slice | Repo | Versión local | Marketplace | Capa B | Depende de |
|-------|------|---------------|-------------|--------|------------|
| Index API v1 (+ resolveStep v1.1) | bdd-guardian | 0.8.3 | ✅ | ✅ | — |
| **Run API v1 producer** | **bdd-pilot** | **1.4.0** | **✅ 1.4.0** | **✅** | — |
| Run API v1 consumer | bdd-jarvis | 0.8.0 (en 0.9 tree) | 0.2.0 | ✅ cross-ext | Pilot 1.4+ ✅ |
| **Pre-run binding gate (P2b)** | **bdd-pilot** | **1.5.0** | **✅ 1.5.0** | **✅** | Guardian ✅ |
| **Diagnostics hygiene** | **bdd-pilot** | **1.6.0** | **✅ 1.6.0** | **✅** | — |
| **Tree search + run filtered** | **bdd-pilot** | **1.7.0** | **✅ 1.7.0** | **✅** | — |
| **Controls polish (Slice C)** | **bdd-pilot** | **1.7.1** | **✅ 1.7.1** | **✅** | — |
| **Tree summary diagnostics** | **bdd-pilot** | **1.7.2** | **✅ 1.7.2** | **✅** | — |
| **README + dashboard diagnostic** | **bdd-pilot** | **✅ 1.7.3** | **✅ 1.7.3** | **✅** | — |
| **Worktree ecosystem parity** | **bdd-pilot** | **1.9.0** | **✅ 1.9.0** | **✅** | — |
| Jarvis P2b complement | bdd-jarvis | 📋 v0.9.1 opc. | — | post Pilot gate | Pilot P2b VSIX |
| MCP | bdd-pilot | — | — | 📋 post-v1.0 | scope distinto |

**Orden de validación:** Pilot v1.4 ✅ → Jarvis cross-ext Capa B ✅ → Pilot v1.5 P2b ✅ → Jarvis J-P2b-* opcional.

**Enhanced mode Jarvis:** `isPilotRunApiV1 && isReady && getRunHistory().length > 0` — TRX fallback siempre vigente.

---

## Plan v0.3.0

Concrete path from **v0.2.4** → public Marketplace listing. Work in **small PRs**; dogfood each step on a real Reqnroll repo before merging.

### Milestone 0.2.5 — Stabilization gate *(before Marketplace)* ✅

Must ship before listing. Low risk, high trust.

| # | Issue title | Scope | Status |
|---|-------------|-------|--------|
| **0.2.5-1** | `docs: CHANGELOG + ROADMAP sync for 0.2.x` | `CHANGELOG.md`, this file | ✅ through v0.2.6 |
| **0.2.5-2** | `release: GitHub Release with .vsix` | Manual / workflow | ✅ v0.2.7 |
| **0.2.5-3** | `feat: project and solution selection` | `projectLocator`, settings UI | ✅ shipped v0.2.5 |
| **0.2.5-4** | `dogfood: checklist nested layout + sample layout` | Issue template + `npm run dogfood` | 🎯 manual checklist (automated gate ✅) |

**PR order:** 0.2.5-1 → 0.2.5-3 → 0.2.5-4 (validate) → 0.2.5-2 (tag after merge).

**Exit criteria for 0.2.5:** Two different repo layouts run without editing `bddPilot.projectPath` by hand; GitHub has a release with installable `.vsix`.

---

### Milestone 0.3.0 — Marketplace *(Phase C)*

| # | Issue title | Scope | Done when |
|---|-------------|-------|-----------|
| **0.3.0-1** | `community: issue templates + PR template` | `.github/ISSUE_TEMPLATE/` | ✅ bug + feature + PR template |
| **0.3.0-2** | `ci: sample Reqnroll + xUnit project smoke` | `samples/minimal-bdd/` | ✅ shipped (CI + unit smoke) |
| **0.3.0-3** | `docs: README marketplace assets` | README, `media/` | ✅ Install section + tree preview PNG |
| **0.3.0-4** | `docs: privacy / data handling statement` | README section | ✅ Security section in README |
| **0.3.0-5** | `release: Marketplace publish anghelll.bdd-pilot` | `package.json`, vsce | ✅ v0.2.7 on Marketplace |
| **0.3.0-6** | `feat(i18n): EN/ES status bar + dashboard` *(optional for 0.3.0)* | Port from Guardian pattern | ✅ v0.3.7 (Capa B) |

**PR order:** 0.3.0-1 → 0.3.0-2 → 0.3.0-3 + 0.3.0-4 (parallel) → 0.3.0-5 → 0.3.0-6 if time.

---

### Marketplace readiness checklist

Use before clicking **Publish** on Marketplace:

#### Product
- [x] Install from `.vsix` on clean VS Code (no dev dependencies) *(dogfood v0.3.5)*
- [x] Discover features in a repo with `Features/` **and** nested `.csproj` *(minimal-bdd; nested layout optional)*
- [x] Run scenario, outline row (tree + CodeLens), feature, tag, Run All *(tag grouping: v0.3.2; @smoke verified)*
- [x] Partial run leaves prior pass/fail icons on other scenarios *(dogfood v0.3.5)*
- [x] Live progress notification updates during run *(dogfood v0.3.5)*
- [x] Dashboard shows history; profiles submenu separate from dashboard *(dogfood v0.3.5)*
- [x] `stg`/`prod` shows confirmation modal *(dogfood v0.3.5)*
- [x] Output channel has no raw secrets on intentional failure *(dogfood v0.3.5)*

#### Repo & brand
- [x] `CHANGELOG.md` through current version (v1.4.0)
- [x] GitHub Release for latest tag with `.vsix`
- [x] README links BDD Guardian; Guardian links back *(verify reciprocal link)*
- [x] Issue templates exist (bug, feature, **dogfood checklist**)
- [x] License MIT, publisher `anghelll`, icon + pilot.svg
- [x] No company-specific references in repo

#### Technical
- [x] `npm run compile && npm run lint && npm run test:unit` pass in CI
- [x] Sample BDD project smoke in CI (0.3.0-2)
- [x] `engines.vscode` matches tested version *(dogfood v0.3.5; `^1.90.0` OK on Cursor/VS Code tested)*

#### Post-publish
- [x] Pin Marketplace version to tagged release *(v1.4.0 publish)*
- [ ] Open “good first issue” for Capa C i18n extras *(enumDescriptions ES, roll-ups TE)*
- [ ] Watch issues 1–2 weeks; patch **1.2.x** if filter/outline/displayMode regressions

---

### Post–0.3.0 backlog (prioritized)

| Priority | Item | Rationale |
|----------|------|-----------|
| P1 | Scenarios with `<param>` but **no** Outline table (Theory rows in tree) | ✅ list-tests inference + `Scenarios:` keyword |
| P1 | Test Explorer result parity with BDD tree (accumulated partial runs) | ✅ shared `OutcomeStore` |
| P2 | Tree grouped **by tag** (`@smoke` → scenarios) | ✅ v0.3.2 |
| P2 | Test Explorer grouped **by tag** (parity with tree) | ✅ v0.3.6 |
| P2 | More diagnostics (timeout, port in use, test host crash) | ✅ v0.3.3 |
| P3 | Custom stage names | Only if users ask |
| P3 | Runtime toggles in UI (`HEADLESS_MODE`) | `.env` covers most cases |
| P4 | Shared `@anghelll/bdd-gherkin-lite` with Guardian | Wait until parsers stabilize |

---

## Changelog

### Unreleased *(main branch)*

_Nothing yet._

### v1.24.0 — Per-stage run profile ✅ shipped

| Area | Change |
|------|--------|
| **Settings** | `bddPilot.run.byStage` merge with global configuration / runSettings |
| **UX** | Hub tooltip effective run flags; Output when stage overrides apply |
| **Core** | `stageRunFlags.ts` + unit tests |
| **Marketplace** | Published v1.24.0 |
| **Tests** | 486 unit tests |

### v1.23.0 — Iconography Tier 2 (brand unification) ✅ shipped

| Area | Change |
|------|--------|
| **Assets** | `icon.png` PNG 128×128 from `pilot.svg` silhouette; source `icon-marketplace.svg` |
| **Docs** | README Iconography Opción B + ForgeOne one-liner |
| **Marketplace** | Published v1.23.0 |
| **Tests** | 478 unit (unchanged) |

### v1.22.0 — Post-run narrative (arco) ✅ shipped

| Area | Change |
|------|--------|
| **P1** | Skip reason snapshot + restore on TRX rehydrate; unmapped Mapping UX from snapshot |
| **P2** | Scenario history QuickPick (tree context / palette) |
| **P3** | Dashboard Recent runs filters (stage / outcome / runKind) |
| **Marketplace** | Published v1.22.0 |
| **Tests** | 478 unit tests |

### v1.21.0 — AI snapshot from TRX ✅ shipped

| Area | Change |
|------|--------|
| **Settings** | `bddPilot.ai.rehydrateFromTrx` default **false** |
| **Core** | `buildRehydratedFailureSnapshot` + provenance in Copy for AI markdown |
| **Activation** | Hydrate `lastFailedRunSnapshot` on outcome rehydrate; lazy fallback on Copy for AI |
| **Marketplace** | Published v1.21.0 |

### v1.20.0 — Mapping UX ✅ shipped

| Area | Change |
|------|--------|
| **Core** | `TreeMappingReport` + `listUnmappedScopedLeaves` (labels; session memory) |
| **UX** | Output lista capped · `showUnmappedScenarios` QuickPick · summary chip |
| **Docs** | README tree/results + CHANGELOG |
| **Marketplace** | Published v1.20.0 |

### v1.19.0 — Security audit + strict prod ✅ shipped

| Area | Change |
|------|--------|
| **Security** | Sanitizer: AWS `AKIA…`, PEM private-key blocks, `secret=` (+ existing patterns) |
| **Settings** | `bddPilot.security.allowProductionRuns` default **false** — blocks `prod` until opt-in |
| **envGuard** | Deny vs confirm decisions; stg unchanged (confirm only) |
| **Docs** | README Security + CHANGELOG; Phase C checkbox ✅ |
| **Marketplace** | Published v1.19.0 |

### v1.18.1 — i18n defaultStage / defaultMode ✅ shipped locally

| Area | Change |
|------|--------|
| **Settings** | `defaultStage` / `defaultMode` description + enumDescriptions via nls EN/ES |
| **Copy** | Mode clarifies xUnit parallelism ≠ Debug session / runKind |

### v1.18.0 — Tree ↔ TE parity ✅ shipped

| Area | Change |
|------|--------|
| **Core** | `treeDisplaySettings` parsers + shared domain/tag structural bases |
| **Tests** | `treeTeParity.test.ts` — labels compact/detailed, leaf tags, keys, TRX collision; 448 unit tests |
| **Providers** | `treeSettings.ts` wrappers; TE no longer depends on tree provider settings types |
| **Marketplace** | Published v1.18.0 |

### v1.17.0 — Matching v2 (FQN / Theory-first) ✅ shipped

| Area | Change |
|------|--------|
| **Core** | `matchesScenarioInFeature` / `findOutlineExampleMatchInFeature` — FQN-first + Theory params; legacy `includes` only without feature-class FQN |
| **Apply** | Tree, TE, `trxTreeMapping`, `matchRunTarget`, failure artifacts use shared helpers |
| **Tests** | Collision fixtures (same title / prefix / Theory); 440 unit tests |
| **Marketplace** | Published v1.17.0 |

### v1.16.0 — Dashboard runKind ✅ shipped

| Area | Change |
|------|--------|
| **History** | `runKind?: run \| debug \| profile` — independent of xUnit `mode`; legacy ≡ run |
| **Dashboard** | Debug / Profile badges on Recent runs Env column |
| **API** | Optional additive `runKind` on history DTO (432 unit tests) |
| **Marketplace** | Published v1.16.0 |

### v1.15.1 — Settings i18n (Capa C parcial) ✅ shipped

| Area | Change |
|------|--------|
| **Settings** | 7 properties: tree display/group/tags/duration, outline filter, post-run toast, rehydrate — ES enumDescriptions via nls |
| **Tests** | `packageNls.test.ts` EN/ES key parity (428 unit tests) |
| **Marketplace** | Published v1.15.1 (catch-up from v1.9.5) |

### v1.15.0 — Env Tier 1 ✅ shipped

| Area | Change |
|------|--------|
| **Env loader** | `config/.env.<stage>` → `.env.<stage>.local` → `.env.local`; last file wins on duplicate keys |
| **Hub UX** | Status bar tooltip lists env basenames or optional-missing hint (no secret values) |
| **Docs** | `env.example` + README load order (426 unit tests) |

### v1.14.0 — Agent Surface ✅ shipped

| Area | Change |
|------|--------|
| **MCP / CLI** | Opt-in discover enrich (`--enrich` / `enrich: true`) via `list-tests`; partial warnings on failure |
| **Rehydrate** | Failed TRX rehydrate writes last-failure artifact when not superseded by live run |
| **Docs** | README Agent recipes for Copilot/Cursor (418 unit tests) |

### v1.13.0 — MCP Fase 2 ✅ shipped

| Area | Change |
|------|--------|
| **MCP** | Extension registers **BDD Pilot** MCP server in agent mode (VS Code 1.101+); bundled `dist/pilot-mcp.cjs` + headless core in VSIX |
| **Post-run** | `TestResults/bdd-pilot-last-failure.json` for MCP `pilot_failure_context` without manual TRX/log paths |
| **Security** | Sanitize on artifact write; path jail unchanged from Fase 1 (407 unit tests) |

### v1.12.0 — MCP Fase 1 ✅ shipped

| Area | Change |
|------|--------|
| **MCP** | `npm run pilot:mcp` — 4 read-only tools delegating to pilot-cli; `config/mcp.json.example` |
| **Security** | Path jail, 5 MB cap, sanitize CLI + MCP outputs |
| **UX** | No extension UI change (396 unit tests) |

### v1.11.0 — pilot-cli v2 ✅ shipped

| Area | Change |
|------|--------|
| **CLI** | `discover`, `build-filter`, `failure-context` on `npm run pilot` — JSON stdout for agents/CI |
| **Core** | Filter resolution + failure snapshot from TRX/log artifacts (sanitize parity with Copy for AI) |
| **Tooling** | Auto-compile `out-test/` when headless CLI runs without prior `test:unit` (381 unit tests) |

### v1.10.0 — extension modularization ✅ shipped

| Area | Change |
|------|--------|
| **Architecture** | `extension.ts` ~517 lines; wiring in `src/activation/` (commands, run, post-run, rehydrate, project hub, settings) |
| **UX/API** | No behavior change — refactor only (361 unit tests) |

### v1.9.5 — env Tier 0 ✅ shipped

| Area | Change |
|------|--------|
| **Docs** | `config/env.example` load order honest (`.env.<stage>` → `.env.local`); README mentions sample env |
| **i18n** | Generic `envGuard.stageConfirm` EN/ES — no X-Ray reference |
| **Sample** | `samples/minimal-bdd/config/.env.test` — Capa B exercises `log.envLoaded` (361 unit tests) |

### v1.9.4 — iconography polish ✅ shipped

| Area | Change |
|------|--------|
| **README** | Tree preview asset (`pilot.svg`, summary row, toolbar); **Iconography** section (codicon vocabulary + dual brand) |
| **Palette** | Icons on `selectProject`, `openStatusBarHub`, `selectStage`, `selectMode`, `cycleTreeGroupBy`, `copyFailureContextForAi` |
| **Brand** | Opción A — `icon.png` Marketplace + `pilot.svg` sidebar documented; no asset redesign (360 unit tests) |

### v1.9.3 — binding gate pre-flight ✅ shipped

| Area | Change |
|------|--------|
| **Pipeline** | `runPreflight` (stage + binding gate) before `activeRun`, progress, and scope clear |
| **Decline** | Gate/stage rejection → Output *Run not started*; no cancel toast; tree icons preserved |
| **Copy** | Unbound prompt prefixed *Before running tests* (EN/ES) |
| **TE** | `run.started` + clear only after pre-flight OK (360 unit tests) |

### v1.9.2 — scoped run progress ✅ shipped

| Area | Change |
|------|--------|
| **Summary** | Live progress only while running; no global store rollup mixed with partial runs |
| **Progress** | `0/N` from start; `! N failed —` prefix on failures; notification not dismiss-cancelable |
| **Binding gate** | Ambiguous-only scope logs continue line in Output (353 unit tests) |

### v1.9.1 — cancel polish ✅ shipped

| Area | Change |
|------|--------|
| **Cancel prep** | `activeRun` + `withProgress` before `list-tests` discovery; AbortSignal wired to outline enrichment |
| **Cancel toast** | Generic message when no `totalExpected`; partial `0/M` when run canceled before first test |
| **Core** | `buildPostRunFeedback` cancel branch; `enrichTheoryRows` propagates abort (350 unit tests) |

### v1.8.3 — flaky dashboard link fix ✅ shipped

| Area | Change |
|------|--------|
| **Fix** | Flaky scenario click — unified dashboard webview script (single `acquireVsCodeApi`) |
| **Fix** | `resolveFlakyFeaturePath` for relative paths in run history (334 unit tests) |

### v1.8.2 — live progress on pilot summary row ✅ shipped

| Area | Change |
|------|--------|
| **Tree summary** | Description shows `formatProgressMessage` during run (`7/19 · counts`) when `completed > 0` |
| **Core** | `formatPilotSummaryDescription` in `pilotSummaryViewModel.ts` (333 unit tests) |
| **UX** | Filter chip still wins over live progress; debug unchanged |

### v1.8.1 — flaky dashboard enriched ✅ shipped

| Area | Change |
|------|--------|
| **Dashboard** | Flaky table: avg duration, last error snippet, click → open `.feature` at scenario line |
| **Core** | `flakyDashboard.ts` — row builder, last failure message, webview parse (329 unit tests) |
| **i18n** | Column labels EN/ES |

### v1.8.0 — dotnet run flags (P1) ✅ shipped

| Area | Change |
|------|--------|
| **Settings** | `bddPilot.run.configuration`, `run.noBuild`, `run.runSettings` |
| **Runner** | `buildArgs` order: configuration → no-build → settings → TRX → filter → xUnit |
| **Debug** | Same flags via shared `buildArgs` (no xUnit inline) |
| **Core** | `runSettingsPath.ts` resolver + tests (322 unit tests) |

### v1.7.3 — README refresh + dashboard last-run diagnostic ✅ shipped

| Area | Change |
|------|--------|
| **README** | v1.7.x features, who it's for / not for, config table (`groupBy`, `locale`), diagnostics surfacing |
| **Dashboard** | Top-1 post-run diagnostic card below stats (parity tree v1.7.2) |
| **Core** | `dashboardDiagnostic.ts`, `resolveDashboardPrimaryDiagnostic` (313 unit tests) |

### v1.7.2 — Diagnostics on tree summary row ✅ shipped

| Area | Change |
|------|--------|
| **Summary** | Top-1 post-run diagnostic chip + tooltip from last run snapshot |
| **Icon** | `warning` / `info` by diagnostic severity |
| **Core** | `pickPrimaryDiagnostic` shared with toast (306 unit tests) |

### v1.7.1 — Controls polish (Slice C) ✅ shipped

| Area | Change |
|------|--------|
| **Debug** | `bddPilot.debugNode` inline on tree rows |
| **GroupBy** | Dynamic toolbar icon (`folder` / `tag`) + tooltips EN/ES |
| **Toolbar** | More overflow menu; Cancel only while running (299 unit tests) |

### v1.7.0 — Tree search visibility + run filtered ✅ shipped

| Area | Change |
|------|--------|
| **Search** | Filter chip on summary row; persist per workspace; `@tag` syntax; clear command |
| **Run** | `bddPilot.runFiltered` swaps with Run All when filter active; `searchRunCap` confirm |
| **UX** | Ctrl+Alt+F keybinding; Pilot Search vs Ctrl+F documented (299 unit tests) |

### v1.6.0 — Diagnostics hygiene ✅ shipped

| Area | Change |
|------|--------|
| **Diagnostics** | Core vs extended rules; `TEST_DATA_SETUP`; generic copy (no CSV dogfood) |
| **Settings** | `bddPilot.diagnostics.extendedRules`, `bddPilot.feedback.diagnosticsInOutput` |
| **Output** | Summary line default; env missing once per workspace/stage |
| **i18n** | Diagnostic titles/hints EN/ES (292 unit tests) |

### v1.5.0 — Pre-run binding gate (P2b) ✅ shipped

| Area | Change |
|------|--------|
| **Pre-run gate** | Guardian `resolveStep` before `dotnet test`; `bddPilot.preRun.bindingGate`: `off` \| `warn` \| `block` |
| **Severity** | `block` only for unbound; ambiguous always allows Run anyway |
| **Fail-open** | Skip + Output log when Guardian unavailable |
| **Core** | `src/core/bindings/*`, `stepLocations.ts` (287 unit tests) |

### v1.4.0 — Ecosystem API (Run API v1) ✅ shipped

| Area | Change |
|------|--------|
| **Extension API** | `PilotRunApiV1` via `extension.exports` — history, lastRun, rollup, events |
| **Reqnroll identifiers** | `sanitizeIdentifier` ↔ Reqnroll `ToIdentifierPart` (hyphen → `_` in filters) |
| **Core** | `sessionRunSnapshot`, `pilotRunApiMapper`, `reqnrollIdentifier`, `src/api/` (273 unit tests) |
| **Docs** | `docs/EXTENSION_API.md` |

### v1.3.0 — Visual UX v2 (status bar + execution feedback)

| Area | Change |
|------|--------|
| **Status bar** | Compact branded hub (`compact` default); `detailed` legacy; unified QuickPick; descriptions for STAGE/mode |
| **Execution feedback** | Tree summary dynamic icon; activity bar badge during run/debug; no spinner on compact status bar |
| **Core** | `statusBarViewModel`, `hubPickItems`, `resolvePilotSummaryIcon` (258 unit tests) |

### v1.2.8 — run target performance

| Area | Change |
|------|--------|
| **Execution target** | `resolveExecutionTarget` — solution → single BDD csproj for `dotnet test` / `--list-tests` |
| **Save debounce** | Feature save refreshes tree immediately; `list-tests` coalesced ~2 s |
| **Status bar** | Solution selection shows slower-run hint (EN/ES) |
| **Core** | `projectResolution`, `executionTarget.test.ts` (247 unit tests) |

### v1.2.7 — bundle comunicación (post-run + progress i18n + empty-state)

| Area | Change |
|------|--------|
| **Post-run** | Unified toast from tree + Test Explorer; actionable diagnostics merged; `TEST_RUN_FAILED` toast exclusion; cancel partial from TE |
| **Progress** | Localized live progress notification (EN/ES) |
| **Empty-state** | Contextual summary + guide row for no project / no features / search no match |
| **Core** | `postRunFeedback`, `treeEmptyState`, `formatProgressMessage` i18n (242 unit tests) |

### v1.2.5 — `.slnx` solution support

| Area | Change |
|------|--------|
| **Project resolution** | `.slnx` accepted in `bddPilot.projectPath` (file or directory) and *Select Test Project* picker; passed explicitly to `dotnet test` |
| **Fix** | Directory path with a single solution now resolves to the absolute solution path |
| **Core** | `projectLocator`, `projectResolution`, `dotnetTest` (215 unit tests) |

### v1.2.6 — Test Explorer displayMode parity

| Area | Change |
|------|--------|
| **Test Explorer** | Descriptions follow `bddPilot.tree.displayMode` (`compact` hides all-passed roll-ups, row counts on outlines, leaf tags hidden; failures always visible) |
| **Fix** | BDD tree `detailed` roll-ups localized EN/ES (`buildContainerDescription` → `prependRollupLocalized`) |
| **Core** | `testExplorerLabels` composes `treeContainerLabels` (222 unit tests) |

### v1.2.3 — tree UX & pilot summary

| Area | Change |
|------|--------|
| **Tree** | `bddPilot.tree.displayMode` (`detailed` default \| `compact`); `treeContainerLabels` core |
| **Summary** | Pilot summary row (status + history icon → dashboard); no duplicate `TreeView.message` |
| **Dashboard** | Scope column `scopeLabel` (e.g. **All tests** on Run All); direct graph toolbar button |
| **Core** | `pilotSummaryViewModel`, `formatHistoryScopeDisplay` (209 unit tests) |

### v1.2.2 — dashboard actions

| Area | Change |
|------|--------|
| **Dashboard** | Action bar: Show Output, Re-run Failed, Copy for AI (session + history re-run) |
| **Webview** | Minimal scripts + CSP nonce; core `dashboardActions` (191 unit tests) |

### v1.2.1 — dashboard continuity

| Area | Change |
|------|--------|
| **Dashboard** | Last known results from OutcomeStore; TRX rehydrate session banner |
| **History** | Scope/filter column; canceled runs with partial counts (184 unit tests) |

### v1.2.0 — outcome continuity

| Area | Change |
|------|--------|
| **Rehydrate** | Latest `bdd-pilot-*.trx` / `bdd-pilot-debug-*.trx` on activate + project switch |
| **Settings** | `outcomes.rehydrateOnActivate`, `outcomes.rehydrateMaxAgeHours` |
| **Tree tooltip** | Skip reason for skipped/unknown outcomes (EN/ES) |
| **Core** | `pilotTrxDiscovery` (174 unit tests) |

### v1.1.0 — run lifecycle & VS Code states

| Area | Change |
|------|--------|
| **Post-debug** | TRX on debug launch; apply results to tree + TE on session end |
| **Cancel** | Preserve partial live/TRX outcomes; localized skip reasons |
| **TE infra** | `errored` + diagnostics when no tests executed / no TRX |
| **Status bar** | Running spinner; unified block run↔debug |
| **Core** | `classifyRunCompletion`, skip reasons, shared TRX args (169 unit tests) |

### v1.0.0 — stable public release

| Area | Change |
|------|--------|
| **Stable 1.0** | First stable Marketplace release; README/GTM for Reqnroll/SpecFlow on VS Code & Cursor |
| **Post-run feedback** | Error snippets in tree hover/description; `bddPilot.feedback.postRunToast`; localized outcomes |
| **AI context** | Copy Failure Context for AI (clipboard markdown for Copilot/Cursor) |

### v0.4.0 — AI-ready failure context

| Area | Change |
|------|--------|
| **AI context** | Command **Copy Failure Context for AI** — structured markdown (run metadata, failed scenarios, analyzer diagnostics, sanitized output tail, evidence paths) to clipboard; optional **Copy for AI** on post-failure diagnostic toasts; settings `bddPilot.ai.enabled`, `bddPilot.ai.contextMaxOutputLines` |

### v0.3.9 — Test Explorer visual parity

| Area | Change |
|------|--------|
| **Test Explorer** | Localized outcome/roll-up descriptions; duration in leaf descriptions (`bddPilot.tree.durationDisplay`); domain/feature container roll-ups; rehydrate from `OutcomeStore` on refresh |

### v0.3.8 — UI polish (Execution Profiles icon)

| Area | Change |
|------|--------|
| **UX** | Execution Profiles submenu codicon on toolbar (`$(list-selection)` via `contributes.submenus`) |

### v0.3.7 — i18n EN/ES (Capa B)

| Area | Change |
|------|--------|
| **i18n** | `bddPilot.locale` (`auto` \| `en` \| `es`); status bar, dashboard, CodeLens, palette (nls), dialogs, stg/prod confirmation |
| **Tooling** | Marketplace publish version gate (`marketplace-version.sh`) |

### v0.3.6 — Test Explorer grouped by tag

| Area | Change |
|------|--------|
| **Test Explorer** | Follows `bddPilot.tree.groupBy`; `@tag` → scenarios → outline rows; run from tag node; roll-up on tag folders |

### v0.3.5 — Marketplace publish sync

| Area | Change |
|------|--------|
| **Tooling** | `npm run pilot -- analyze <log-file>` — JSON diagnostics CLI for agents/CI |
| **Process** | Capa B dogfood on VSIX 0.3.5; Marketplace publish sync with GitHub Release |

### v0.3.4 — Marketplace dogfood gate

| Area | Change |
|------|--------|
| **Process** | Capa A `verify:local`; Capa B dogfood on VSIX; release v0.3.4 |
| **Tooling** | `scripts/verify-local.sh`, `npm run verify:local` |

### v0.3.3 — runtime diagnostics (infra)

| Area | Change |
|------|--------|
| **Diagnostics** | Test host crash/abort, port in use, execution timeout |

### v0.3.2 — tree grouped by tag

| Area | Change |
|------|--------|
| **Tree** | `bddPilot.tree.groupBy`: domain (default) or `@tag`; toolbar toggle |
| **Run** | Tag group nodes → `Category=<tag>`; case-insensitive tag matching |
| **Roll-up** | Pass/fail counts on tag folders |

### v0.2.6 — runtime diagnostics

| Area | Change |
|------|--------|
| **Diagnostics** | Post-run hints: pending/ambiguous steps, test users, AWS, X-Ray, API HTTP errors, run summary |
| **FEED_AUTH** | NuGet restore auth hint only on restore failures (not API 401 during tests) |

*See [CHANGELOG.md](./CHANGELOG.md) for full 0.2.5–0.2.6 notes.*

### v0.2.5 — stabilization gate

| Area | Change |
|------|--------|
| **Project picker** | Status bar / command to select `.csproj` or `.sln` |
| **Community** | `CHANGELOG.md`, GitHub issue + PR templates |

### v0.2.4 — partial run result merge

| Area | Change |
|------|--------|
| **Tree persistence** | Prior pass/fail/duration kept when running a different scenario or outline row |
| **Scoped clear** | Only tests in the current run scope reset before execution |
| **Run scope** | Pure `runScope.ts` resolves affected keys (feature, scenario, row, tag, domain) |

### v0.2.3 — CodeLens outline rows

| Area | Change |
|------|--------|
| **CodeLens** | `Run row` / `Debug row` on each Examples table line |
| **Scenario Outline header** | `Run all rows` / `Debug all rows` for whole Theory |
| **Parser** | `OutlineExample.line` for CodeLens placement |

*Includes v0.2.2 (per-row DisplayName filter, filter mapping settings, `config/env.example`) and v0.2.1 (live progress).*

### v0.2.2 — Phase A (remainder)

| Area | Change |
|------|--------|
| **Outline row run** | Single Examples row via VSTest `DisplayName~` (Reqnroll/xUnit Theory) |
| **Filter mapping** | Settings: `filter.featureClassSuffix`, `filter.tagTraitName`, `filter.outlineRowFilter` |
| **Environment docs** | `config/env.example` + README section for optional `config/.env.<stage>` |

### v0.2.1 — live execution progress

| Area | Change |
|------|--------|
| **Progress notification** | `withProgress` shows `7/19 · 5 passed, 2 failed` while tests run |
| **Live tree** | Pass/fail/skip icons update on scenarios as xUnit stdout reports completions |
| **Test Explorer** | Native test items reflect live outcomes during the run |
| **Parser** | `LiveProgressParser` reads xUnit/VSTest `Passed`/`Failed`/`Skipped` lines incrementally |
| **Estimate** | Expected test count from feature files drives progress bar when total is known |

**Known limits:** progress depends on xUnit stdout format; parallel runs update counts but order is non-deterministic.

### v0.2.0 — Phase A (partial)

| Area | Change |
|------|--------|
| **Tree roll-up** | Domain/feature folders tint pass/fail; description shows `2 failed · 17 passed` |
| **Scenario Outline** | Parser reads `Examples` tables; outline rows as child nodes |
| **Results mapping** | TRX/Cucumber matched per outline row via example cell values |
| **Tag inheritance** | Feature tags included in search + effective tag counts |
| **Test Explorer** | Outline rows appear as children in native Testing panel |

### v0.1.0 — first beta

MVP tree, run/debug, dashboard, profiles, diagnostics, Test Explorer, CodeLens, TRX/Cucumber, evidence links, compact tree labels. See git history `76ba0ff` era.

---

## Phases (detail)

### Phase B — UX that delights ✅ *(in v0.1.0)*

Tree, Test Explorer, CodeLens, dashboard, profiles, roll-up, duration format, evidence on failures — **done**.

### Phase A — Multi-framework stability *(mostly done → 0.2.5)*

#### 1. Runner robustness
- [x] Scenario Outline in tree + TRX per row
- [x] Per-row dotnet filter (DisplayName)
- [x] Tag inheritance
- [x] Configurable filter mapping
- [x] **Project/solution selection** ← *shipped 0.2.5*

#### 2. Configuration & environments
- [x] `env.example` + docs
- [ ] Custom stage names
- [ ] Runtime toggles in UI

### Phase C — Product *(→ v0.3.0)*

- [x] Issue templates + CHANGELOG discipline
- [x] CI sample BDD project
- [x] Marketplace listing *(v0.3.5 publish manual; GitHub Release `v0.3.5` + VSIX)*
- [x] i18n EN/ES *(0.3.0-6, Capa B in v0.3.7)*
- [x] Security audit sanitizer / strict prod mode *(v1.19.0)*

---

## Architecture (reference)

```
src/
├── activation/     # Extension wiring — commands, run orchestration (v1.10.0)
├── api/            # PilotRunApiV1 — extension.exports (v1.4.0)
├── core/           # Pure logic — unit tested, no VS Code API
│   ├── gherkin/    # parser, grouping, discovery, treeLabels
│   ├── runner/     # filterBuilder, runScope, liveProgress, dotnetTest
│   ├── results/    # TRX, Cucumber, evidence, runHistory, sessionRunSnapshot
│   ├── diagnostics/
│   └── config/     # stages, modes, profiles, projectLocator, envFile
├── providers/      # Tree, TestController, CodeLens, RunService, dashboard
├── security/       # envGuard, sanitizer
└── extension.ts    # activate/deactivate orchestration
```

**Principles:** framework-agnostic · no credentials stored/logged · optional `.env` in memory only · filter mapping configurable for Reqnroll/SpecFlow.

---

*Last updated: v1.10.0 shipped — extension modularization.*
