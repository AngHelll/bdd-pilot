# Changelog

All notable changes to **BDD Pilot** are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).  
Versioning: [Semver](https://semver.org/).

## [Unreleased]

_Nothing yet._

## [1.24.0] — 2026-07-20

### Added
- **Per-stage run profile** — `bddPilot.run.byStage` overrides `run.configuration` / `run.runSettings` per STAGE (`dev`/`test`/`stg`/`prod`); run and debug share the merge; Output logs when stage flags differ from globals
- **Hub tooltip** — shows effective run flags (e.g. `Release · stg.runsettings`) when non-empty

## [1.23.0] — 2026-07-20

### Changed
- **Brand unification (Iconography Tier 2)** — Marketplace `media/icon.png` is now a real 128×128 PNG derived from the same silhouette as `media/pilot.svg` (source: `media/icon-marketplace.svg`); README Iconography documents Opción B (shared silhouette; color vs monochrome)

## [1.22.0] — 2026-07-20

### Added
- **Post-run narrative (arco)** — skip-reason continuity after Reload, scenario history QuickPick, dashboard history filters
- **Skip reason snapshot** — scoped `not_in_trx` / `canceled` reasons persist in workspaceState and restore with TRX rehydrate (same path/age gates); Mapping UX unmapped list rehydrates from snapshot
- **Scenario history** — command **Show Scenario History** (tree context / More menu) lists recent runs for a scenario via QuickPick; open feature from the pick
- **Dashboard filters** — filter Recent runs by stage, outcome (any failure / all passed / canceled), and session kind (run / debug / profile); flaky table unchanged

### Changed
- **Test Explorer** — leaf descriptions append stored skip reasons when present (parity with tree tooltips after rehydrate)

## [1.21.0] — 2026-07-15

### Added
- **AI snapshot from TRX** — opt-in `bddPilot.ai.rehydrateFromTrx` (default **false**) rebuilds Copy for AI context after Reload from the latest Pilot TRX (same age/history gates as outcome rehydrate), with a clear provenance note in the markdown

## [1.20.0] — 2026-07-15

### Added
- **Mapping UX** — scoped runs with `unmapped > 0` list labels in Output (capped), command **Show Unmapped Scenarios** (QuickPick → reveal `.feature`), and pilot summary chip `{n} unmapped`
- **Core** — `TreeMappingReport` / `listUnmappedScopedLeaves` with stable labels (session report in memory only)

## [1.19.0] — 2026-07-15

### Added
- **Strict production** — `bddPilot.security.allowProductionRuns` (default **false**) blocks STAGE=`prod` until opt-in; confirmation modal still applies when enabled
- **Sanitizer audit** — redacts AWS Access Key Ids (`AKIA…`), PEM private key blocks, and generic `secret=` assignments (plus existing patterns)

### Changed
- **README Security** — documents production opt-in and expanded sanitizer coverage
- **envGuard** — `evaluateRun` supports deny vs confirm decisions for prod policy

## [1.18.1] — 2026-07-15

### Changed
- **Settings i18n** — `defaultStage` / `defaultMode` descriptions + enumDescriptions via `package.nls` EN/ES (Mode copy clarifies xUnit parallelism ≠ Debug session / runKind)

## [1.18.0] — 2026-07-15

### Added
- **Tree ↔ TE parity tests** — core contract suite for `displayMode` / container labels, leaf tags, outcome keys, and shared TRX mapping
- **`treeDisplaySettings` core** — typed `TreeDisplaySettings` / `TreeGroupBy` + pure parsers shared by tree and Test Explorer

### Changed
- Domain / tag container structural bases unified (`1 feature` singularization matches TE)
- Test Explorer reads display settings via `providers/treeSettings` (no longer coupled to `testTreeProvider` types)

## [1.17.0] — 2026-07-15

### Changed
- **Matching v2** — TRX / live / history → Gherkin leaves prefer Reqnroll `FeatureClass.ScenarioMethod` FQN tokens (and Theory `name: "value"` for Outline rows) over bare name `includes`
- **Call sites** — `trxTreeMapping`, `matchRunTarget`, tree live updates, Test Explorer apply, and failure artifact mapping share the FQN-first helpers

### Fixed
- Same scenario title in different features no longer cross-attributes outcomes when TRX carries a feature-class FQN
- Prefix siblings (e.g. `Place order` vs `Place order batch`) no longer collide under FQN matching

## [1.16.0] — 2026-07-15

### Added
- **Dashboard `runKind`** — history entries record session kind (`run` | `debug` | `profile`), independent of xUnit parallelism `mode`
- **Recent runs badges** — Debug / Profile badges on Env column (normal runs stay quiet)
- **Run API** — optional additive `runKind` on `PilotRunHistoryEntryDto` (no `apiVersion` bump)

### Changed
- **Execution profiles** — `bddPilot.runProfile` sets `runKind: profile` (Re-run Failed stays `run`)

## [1.15.1] — 2026-07-12

### Changed
- **Settings i18n (Capa C parcial)** — Spanish `enumDescriptions` + descriptions for 7 tree/feedback/outcomes settings via `package.nls.es.json`
- **Tests** — `packageNls.test.ts` validates configuration nls key parity EN/ES

## [1.15.0] — 2026-07-12

### Added
- **Env Tier 1 — `.env.<stage>.local`** — loader merges `config/.env.<stage>` → `.env.<stage>.local` → `.env.local` (last wins)
- **Hub env indicator** — execution hub tooltip shows env file basenames (or optional-missing hint) without values

### Changed
- **`resolveStageEnvFileStatus`** — core helper for file existence only (hub + tests)
- **Docs** — `env.example` and README document three-step load order and gitignore hints

## [1.14.0] — 2026-07-12

### Added
- **Discover enrich** — `pilot discover [--enrich]` and MCP `pilot_discover_bdd` param `enrich` (opt-in `dotnet test --list-tests`; outline examples + `executableTestCount`)
- **Rehydrate artifact** — TRX rehydrate with failures writes `bdd-pilot-last-failure.json` when no newer live artifact exists (TRX-only, no log)
- **README Agent recipes** — Copilot/Cursor workflow: map → filter → failure context → reopen workspace

### Changed
- **`buildCliDiscoverReport`** — async with 90s timeout, partial success via `listTestsWarnings`
- **MCP T2** — optional `testTarget` for enrich list-tests scope

## [1.13.0] — 2026-07-12

### Added
- **MCP Fase 2** — `registerMcpServerDefinitionProvider` auto-registers **BDD Pilot** MCP in VS Code 1.101+ / Cursor (no manual `mcp.json` when installed from VSIX)
- **VSIX headless bundle** — `dist/pilot-mcp.cjs` + `dist/headless/` at prepublish; packaged MCP skips runtime `tsc`
- **Last-failure artifact** — `TestResults/bdd-pilot-last-failure.json` (+ optional sanitized log) written after failed runs; cleared on all-pass
- **MCP T4** — `pilot_failure_context` accepts only `projectDir` when artifact exists (implicit `useLastFailure`)

### Changed
- **pilot-cli / pilot-mcp** — shared `pilot-out-test.js` resolves `BDD_PILOT_OUT_TEST` for VSIX vs repo dev
- **README** — Agent/MCP section documents VSIX auto-discovery path

## [1.12.0] — 2026-07-12

### Added
- **MCP Fase 1** — stdio server (`npm run pilot:mcp`) with 4 read-only tools: `pilot_analyze_log`, `pilot_discover_bdd`, `pilot_build_filter`, `pilot_failure_context` (thin wrapper over pilot-cli)
- **Security** — path jail (`BDD_PILOT_WORKSPACE_ROOT`), 5 MB artifact cap, sanitize on CLI diagnostics + failure-context + MCP payloads
- **Docs** — `config/mcp.json.example`, README Agent/CLI/MCP section

### Changed
- **pilot-cli analyze** — sanitizes diagnostic fields in JSON output
- **failure-context** — sanitizes failed-scenario error snippets and diagnostic lines in markdown

## [1.11.0] — 2026-07-10

### Added
- **pilot-cli v2** — headless subcommands on `npm run pilot`: `discover`, `build-filter`, `failure-context` (JSON stdout; stepping stone to MCP Fase 1)
- **Core** — `resolveCliFilterTarget()`, `buildCliDiscoverReport()`, `buildFailureSnapshotFromArtifacts()` with unit tests
- **CLI** — auto-compile `out-test/` when missing (`tsc -p tsconfig.test.json`)

## [1.10.0] — 2026-07-10

### Changed
- **Extension modularization** — extract activation wiring from `extension.ts` into `src/activation/` (commands, run execution, post-run, rehydrate, project hub, settings readers); no UX or API behavior change

## [1.9.5] — 2026-07-10

### Changed
- **Env docs** — `config/env.example` documents real load order (`.env.<stage>` → `.env.local`); removed misleading `.env.test.local` pattern
- **Stage confirmation copy** — generic `stg` prompt EN/ES (no vendor-specific tooling references)
- **Sample env** — `samples/minimal-bdd/config/.env.test` placeholder for dogfood and Capa B env-loaded verification

## [1.9.4] — 2026-07-09

### Changed
- **Iconography polish** — README tree preview asset updated (`pilot.svg`, summary row, toolbar); **Iconography** section documents codicon vocabulary and dual brand (`icon.png` vs `pilot.svg`)
- **Command palette icons** — `selectProject`, `openStatusBarHub`, `selectStage`, `selectMode`, `cycleTreeGroupBy`, `copyFailureContextForAi`

## [1.9.3] — 2026-07-09

### Changed
- **Binding gate pre-flight** — stage confirmation and binding gate run before “Running tests” progress and scope clear
- **Decline ≠ cancel** — rejecting gate or stage logs *Run not started* without cancel toast or clearing tree icons
- **Unbound prompt** — prefixed with *Before running tests* / *Antes de ejecutar tests* (EN/ES)
- **Test Explorer** — `run.started` and scope clear only after pre-flight passes

## [1.9.2] — 2026-07-08

### Changed
- **Scoped run summary** — pilot summary shows only live progress while running (no global rollup from other domains/scopes); `0/N` from run start
- **Progress notification** — no longer cancelable on dismiss; use toolbar Stop instead
- **Failure visibility** — progress message prefixes `! N failed —` when tests fail mid-run
- **Binding gate** — ambiguous-only runs append Output line that execution continues

## [1.9.1] — 2026-07-08

### Changed
- **Cancel during prep** — toolbar Stop and progress notification X work while `list-tests` discovers outline rows (before `dotnet test` starts)
- **Cancel toast** — generic *Run canceled* when no expected count; partial `N/M` preserved (including `0/M` before first test)

## [1.9.0] — 2026-07-08

### Added
- **Tree mapping report** — post-run Output line `{mapped}/{inScope} scenarios matched TRX` for scoped runs (EN/ES)
- **Tree `not_in_trx` parity** — scoped leaves without TRX match show skip icon + tooltip (Test Explorer parity)
- **Summary chip from store** — first failed error snippet on pilot summary row after rehydrate when no session diagnostic
- **`matchRunTarget` domain/tag** — run history attributes `featurePath` / `scenarioLine` for domain and tag runs

### Changed
- **Rehydrate gate** — restore outcomes only when on-disk TRX matches last history `trxPath`
- **Theory enrichment** — await `enrichTheoryRows()` before non-debug runs when outline discovery is pending

## [1.8.4] — 2026-07-08

### Changed
- **Pre-run binding gate UX** — ambiguous bindings log to Output only (no modal); unbound in `warn` mode uses a non-modal notification with Run anyway / Cancel (EN/ES)

## [1.8.3] — 2026-07-07

### Fixed
- **Dashboard flaky scenario links** — single webview script (`acquireVsCodeApi` once); resolve relative feature paths when opening `.feature`

## [1.8.2] — 2026-07-07

### Added
- **Live progress on pilot summary row** — tree summary description shows aggregated progress (`7/19 · 2 failed`) during runs via `formatProgressMessage` (EN/ES)

## [1.8.1] — 2026-07-07

### Added
- **Dashboard flaky table enriched** — average duration, last sanitized error snippet, click scenario to open `.feature` at scenario line (EN/ES)

## [1.8.0] — 2026-07-07

### Added
- **`bddPilot.run.configuration`** — optional `dotnet test --configuration` (`Debug` / `Release`)
- **`bddPilot.run.noBuild`** — pass `--no-build` when enabled
- **`bddPilot.run.runSettings`** — optional `.runsettings` path for `--settings` (run + debug parity)

## [1.7.3] — 2026-07-07

### Added
- **Dashboard last-run diagnostic** — top post-run diagnostic card in the webview dashboard (parity with tree summary v1.7.2)

### Changed
- **README** — v1.7.x features, who it's for / not for, configuration table, diagnostics surfacing

## [1.7.2] — 2026-07-06

### Added
- **Tree summary diagnostic** — top post-run diagnostic on the BDD tree summary row (chip + tooltip with hint)

### Changed
- Summary row icon shows `warning` / `info` when the last run has an error/warning diagnostic
- Shared `pickPrimaryDiagnostic` helper for toast and tree (same selection rules)

## [1.7.1] — 2026-07-06

### Added
- **Debug inline** — `bddPilot.debugNode` on BDD tree rows (parity with CodeLens / Test Explorer)
- **More menu** — toolbar overflow (`…`) for Re-run Failed and Execution Profiles

### Changed
- **GroupBy toolbar** — icon reflects current mode (`$(folder)` domain / `$(tag)` tag) with descriptive tooltips
- **Cancel** — visible in tree toolbar only while a run is active
- **Toolbar order** — Run · Search · Dashboard · Refresh · GroupBy · More

## [1.7.0] — 2026-07-06

### Added
- **Tree search visibility** — filter chip on summary row; persist per workspace; `bddPilot.clearSearch`; active search toolbar state
- **Run filtered** — `bddPilot.runFiltered` runs only visible scenarios when a filter is active (toolbar swaps with Run All)
- **`@tag` syntax** — tag-only matching when query starts with `@`
- **`bddPilot.tree.searchRunCap`** — confirmation before large filtered runs (default 80)
- **Keybinding** — `Ctrl+Alt+F` / `Cmd+Alt+F` to open search when BDD Pilot tree is focused

### Changed
- Summary row click opens search editor when a filter is active (dashboard when no filter)
- Search guide tooltips document Pilot Search vs workbench **Ctrl+F**

## [1.6.0] — 2026-07-05

### Added
- **Diagnostics hygiene** — framework-agnostic post-run copy; no dogfood references (CSV, UserProfileTracking) in default hints
- **`bddPilot.diagnostics.extendedRules`** (default `false`) — opt-in for cloud credentials, X-Ray, and API HTTP diagnostics
- **`bddPilot.feedback.diagnosticsInOutput`** — `summary` (default) | `full` | `off` for Output channel density
- **i18n EN/ES** for diagnostic titles, hints, and Output summary lines
- **Env missing notice** — log once per workspace/stage when `config/.env.{stage}` is absent

### Changed
- **`NO_TEST_USERS` → `TEST_DATA_SETUP`** in analyzer/CLI JSON output (generic test data / fixture messaging)
- **`TEST_RUN_FAILED`** hint and failure breakdown use generic category labels
- **Extended analyzers** (`AWS_CREDENTIALS`, `XRAY_CONFIG`, `API_HTTP_ERRORS`) run only when `extendedRules` is enabled

## [1.5.0] — 2026-07-05

### Added
- **Pre-run binding gate (P2b)** — optional check via BDD Guardian `resolveStep` before `dotnet test`; setting `bddPilot.preRun.bindingGate`: `off` | `warn` (default) | `block`
- **Unbound vs ambiguous** — `block` applies only to missing bindings; ambiguous steps always allow Run anyway
- **Output log** when gate is enabled but Guardian is unavailable (fail-open)

## [1.4.0] — 2026-07-05

### Added
- **Run API v1** — read-only `extension.exports` surface for companion extensions (BDD Jarvis): run history, last run snapshot, outcome rollup, completion events
- **`docs/EXTENSION_API.md`** — public API reference (pattern aligned with BDD Guardian)
- **Session run snapshot** — `getLastRun()` covers all completed/canceled runs including all-green; diagnostics cached at finish without exporting stdout

### Changed
- **`activate()`** returns `PilotRunApiV1` via `extension.exports`
- **Run history** — optional absolute `trxPath` persisted per entry
- **Reqnroll identifier matching** — `sanitizeIdentifier` aligned with Reqnroll `ToIdentifierPart` (hyphens/dots → `_` in generated class names); fixes scoped runs on features like `E-Commerce` / `Pre-order`

## [1.3.0] — 2026-07-02

### Added
- **Compact status bar hub** — single branded item `$(beaker) Pilot` with STAGE, mode, and project; click opens unified execution settings QuickPick (EN/ES)
- **Status bar display mode** — `bddPilot.statusBar.display`: `compact` (default) or `detailed` (legacy four items)
- **Hub descriptions** — STAGE and parallelism pickers show thread hints and stg/prod confirmation warnings; shared by hub and Command Palette
- **Activity bar badge** — numeric badge on the BDD Pilot sidebar icon while a run or debug session is active
- **Execution Settings command** — `BDD Pilot: Execution Settings` (`bddPilot.openStatusBarHub`)

### Changed
- **Execution feedback** — run/debug state in tree summary row (dynamic icon) and activity badge; compact status bar stays static (no spinner)
- **Pilot summary icon** — `loading~spin` during runs, `debug-alt` during debug, `history` when idle

## [1.2.8] — 2026-06-13

### Added
- **Run target performance** — when a solution is selected but exactly one BDD `.csproj` exists, `dotnet test` and `--list-tests` use that project for faster runs; feature discovery and picker label unchanged
- **Status bar solution hint** — tooltip recommends selecting the `.csproj` for faster runs when a solution is the active selection (EN/ES)

### Changed
- **Theory row enrichment debounce** — saving `.feature` files refreshes the tree immediately but coalesces `list-tests` calls (~2 s) to avoid repeated slow dotnet invocations

## [1.2.7] — 2026-06-13

### Added
- **Empty-state guide** — contextual pilot summary text and an informational guide row when no project is selected, no `.feature` files exist, or search filters hide all scenarios; Reqnroll/SpecFlow tooltip with README link; actions for *Select Test Project* and *Search Tests* where applicable (EN/ES)
- **Post-run feedback unified** — single toast after runs from BDD tree and Test Explorer; actionable diagnostics merged into the same message; `TEST_RUN_FAILED` excluded from toast (still in Output); cancel partial toast from Test Explorer; deduped `always` mode
- **Progress notification i18n** — live run progress messages localized (EN/ES via `bddPilot.locale`)

### Changed
- **Post-run toast enumDescriptions** — clarified `bddPilot.feedback.postRunToast` options in settings

## [1.2.6] — 2026-06-11

### Changed
- **Test Explorer `displayMode` parity** — native Test Explorer descriptions now follow `bddPilot.tree.displayMode`: `compact` hides all-passed roll-ups on domain/tag/feature folders, shows row counts on outlines, and hides leaf tags (failures always surface); `detailed` unchanged

### Fixed
- **BDD tree `detailed` roll-ups localized** — folder roll-up descriptions now use EN/ES labels in `detailed` mode (parity with `compact` and Test Explorer)

## [1.2.5] — 2026-06-11

### Added
- **`.slnx` solution support** — modern XML solution files (`dotnet` SDK 9.0.200+) are now accepted everywhere `.sln` was: `bddPilot.projectPath` (file or directory), the *Select Test Project* picker, and as explicit `dotnet test` target

### Fixed
- **Directory project path with a single solution** — resolving `bddPilot.projectPath` pointed at a directory containing one solution now stores the absolute solution path (was a bare file name)

## [1.2.3] — 2026-06-06

### Added
- **Tree display mode** — `bddPilot.tree.displayMode`: `detailed` (default) vs `compact` (less duplicate roll-ups on folders)
- **Pilot summary row** — clickable status line at the top of the BDD tree (`history` icon → dashboard); `buildPilotSummaryViewModel` shared with dashboard *Last known*
- **Dashboard scope labels** — run history stores `scopeLabel`; full-suite runs show **All tests** in the Scope column (localized)

### Changed
- **Compact tree** (opt-in) — global summary row for roll-up; structural folder labels; roll-up on containers only when tests failed; neutral folder icons; leaves show duration/error without tag clutter
- **Dashboard toolbar** — `$(graph)` opens the dashboard directly (no submenu flyout)
- **Summary row UX** — status-only label (`3 passed`, `Running…`); dashboard hint in tooltip only

### Fixed
- **Activation order** — register commands before tree summary / dashboard refresh
- **`copyFailureContextForAi`** — always registered (declared in manifest)

## [1.2.2] — 2026-06-04

### Added
- **Dashboard actions** — Show Output, Re-run Failed, and Copy for AI buttons (parity with post-run toast)
- **History re-run** — Re-run Failed from last history entry with failures when no session snapshot

## [1.2.1] — 2026-06-04

### Added
- **Dashboard — last known results** — snapshot from `OutcomeStore` (or last history entry) aligned with tree/Test Explorer after reload
- **Dashboard — TRX rehydrate notice** — session banner when v1.2 restores outcomes without a new run
- **Dashboard — scope column** — shows the filter used for each recent run
- **Canceled run history** — partial cancel runs recorded with `canceled` status; global KPIs exclude their pass/fail counts

## [1.2.0] — 2026-06-04

### Added
- **Outcome rehydration on activate** — restore pass/fail icons from the latest BDD Pilot TRX in `TestResults/` when opening the workspace (tree + Test Explorer)
- **Settings** — `bddPilot.outcomes.rehydrateOnActivate` (`on` | `off`) and `bddPilot.outcomes.rehydrateMaxAgeHours` (default 7 days)
- **BDD tree skip tooltips** — localized skip reason line on hover for `skipped` / `unknown` outcomes (parity with Test Explorer messaging)

### Changed
- **Project switch** — clears in-memory outcomes and rehydrates from the new project's latest Pilot TRX when eligible

## [1.1.0] — 2026-06-04

### Added
- **Post-debug results** — TRX logger on debug launch; tree and Test Explorer update when the BDD Pilot debug session ends
- **Status bar run indicator** — spinner while a run or debug session is active
- **Cancel partial preservation** — completed tests keep pass/fail; toast with `{completed}/{expected}` when known
- **Test Explorer skip reasons** — localized descriptions (`not in results`, `canceled before completion`, etc.)
- **Infra vs test failures** — SDK/host/no-TRX cases surface as `errored` in Test Explorer with actionable messages

### Changed
- **Unified run/debug policy** — block Debug while a run is active (and vice versa)
- **TRX `unknown` outcomes** — roll-up aware; leaves show skip reason instead of misleading pass/fail

## [1.0.0] — 2026-05-30

**First stable release** on the VS Code Marketplace — Reqnroll/SpecFlow BDD execution for VS Code and Cursor.

### Added
- **Post-run feedback** — sanitized error snippets on failed scenarios (tree description + hover, localized outcomes); domain roll-up tooltips; `bddPilot.feedback.postRunToast` for summary toast with Show Output, Re-run Failed, and Copy for AI
- **AI-ready failure context** (from 0.4.x) — clipboard markdown of the last failed run for Cursor/Copilot (`bddPilot.ai.*`)
- **Test Explorer parity** — localized outcomes, roll-ups, and durations aligned with the BDD tree
- **i18n EN/ES**, execution profiles, outline-row filters, runtime diagnostics, and secure multi-stage runs (`dev`/`test`/`stg`/`prod`)

### Highlights
- Gherkin tree grouped by **domain** or **@tag**; run feature, scenario, tag, or single outline row
- Native **Test Explorer** + CodeLens; TRX/Cucumber results, dashboard, re-run failed
- Works with any .NET BDD stack via `dotnet test` (API, Playwright, etc.)
- Pairs with [**BDD Guardian**](https://github.com/AngHelll/bdd-guardian) for step bindings and navigation

## [0.4.0] — 2026-05-30

### Added
- **AI-ready failure context** — command `BDD Pilot: Copy Failure Context for AI` copies structured markdown (run metadata, failed scenarios, analyzer diagnostics, sanitized output tail, evidence paths) to the clipboard; optional **Copy for AI** action on post-failure diagnostic toasts; settings `bddPilot.ai.enabled` and `bddPilot.ai.contextMaxOutputLines`

## [0.3.9] — 2026-05-30

### Changed
- Test Explorer visual parity with BDD tree — localized outcome and roll-up descriptions, duration in leaf descriptions (`bddPilot.tree.durationDisplay`), domain/feature container roll-ups; state rehydrated from `OutcomeStore` on refresh

## [0.3.8] — 2026-05-30

### Fixed
- Execution Profiles submenu toolbar button — codicon `$(list-selection)` on `contributes.submenus` (was grey placeholder)

## [0.3.7] — 2026-05-30

### Added
- i18n EN/ES — setting `bddPilot.locale` (`auto` | `en` | `es`); status bar, dashboard, CodeLens, command palette (nls), toasts, progress, and stg/prod confirmation dialogs

### Changed
- Marketplace publish scripts compare local version to Marketplace before `vsce publish`

## [0.3.6] — 2026-05-30

### Added
- Test Explorer grouped by `@tag` — follows `bddPilot.tree.groupBy` (`domain` | `tag`); run/debug from tag nodes with `Category=<tag>` filter; roll-up on tag folders

## [0.3.5] — 2026-05-30

### Added
- `npm run pilot -- analyze <log-file>` — headless CLI that returns JSON diagnostics for agents/CI (wraps `analyzer.ts`)

### Changed
- Marketplace dogfood Capa B checklist closed on VSIX 0.3.5; GitHub Release ↔ Marketplace publish sync

## [0.3.4] — 2026-05-30

### Added
- `npm run verify:local` — Capa A gate (compile, lint, unit tests, VSIX package)

### Changed
- Marketplace dogfood gate completed on v0.3.3 codebase; release sync through v0.3.4

## [0.3.3] — 2026-05-30

### Added
- Diagnostics for test host crash/abort, port already in use, and test execution timeout

## [0.3.2] — 2026-05-30

### Added
- Tree grouped by `@tag` — setting `bddPilot.tree.groupBy` (`domain` | `tag`) and toolbar toggle (tag icon)
- Run from tag group nodes maps to `Category=<tag>` filters (case-insensitive tag matching)
- Outcome roll-up on tag group folders

## [0.3.1] — 2026-05-30

### Added
- Theory row discovery from `dotnet test --list-tests` when scenarios have `<params>` but no Examples table in the feature file
- Parser support for `Scenarios` / localized Examples keywords and `stepParams` extraction from steps
- Shared `OutcomeStore` so Test Explorer keeps pass/fail across partial runs (scoped clear, like the BDD tree)
- Sample `Greetings.feature` using the `Scenarios:` keyword (Reqnroll + xUnit theory rows)

### Changed
- Test Explorer rebuilds from enriched domains and shows stored outcome descriptions between runs

## [0.3.0] — 2026-05-30

### Added
- `samples/minimal-bdd/` — minimal Reqnroll + xUnit project for CI smoke and extension discovery tests
- CI job `sample-smoke`: `dotnet test` on sample + tag/feature filter checks
- Unit tests (`sampleSmoke.test.ts`) validating parser, project locator, and filter builder against the sample
- `npm run dogfood` — automated pre-release smoke script (`scripts/dogfood-smoke.sh`)
- GitHub issue template for manual release dogfood checklist
- README Install section and tree preview asset (`media/readme-tree-preview.png`, source SVG in repo)

## [0.2.7] — 2026-05-29

### Changed
- Sync `ROADMAP.md` and `README.md` with v0.2.6 feature set, test count (96), and Marketplace readiness checklist

## [0.2.6] — 2026-05-29

### Fixed
- **FEED_AUTH** only triggers on NuGet restore failures, not API HTTP 401 during test execution

### Added
- Runtime diagnostics after test runs: pending/ambiguous steps, missing test users, AWS credentials, X-Ray config, API HTTP errors, and test-run summary breakdown

## [0.2.5] — 2026-05-29

### Added
- **Select Test Project** command and status bar picker for `.csproj` / `.sln` when auto-detect is ambiguous
- `CHANGELOG.md`, GitHub issue templates, PR template
- `dotnet test` passes explicit `.csproj` or `.sln` target when selected

### Changed
- Feature discovery uses workspace root when a solution is selected

## [0.2.4] — 2026-05-29

### Fixed
- Tree pass/fail decorations persist across partial runs; only in-scope tests reset before execution

### Added
- `runScope.ts` — pure logic for run-scope outcome keys

## [0.2.3] — 2026-05-29

### Added
- CodeLens **Run row** / **Debug row** on Scenario Outline Examples table lines
- CodeLens **Run all rows** on Scenario Outline headers
- `OutlineExample.line` in parser for CodeLens placement

## [0.2.2] — 2026-05-29

### Added
- Per-row Scenario Outline execution via VSTest `DisplayName~` filter
- Settings: `bddPilot.filter.featureClassSuffix`, `tagTraitName`, `outlineRowFilter`
- `config/env.example` and README section for optional `config/.env.<stage>`

## [0.2.1] — 2026-05-29

### Added
- Live execution progress (`7/19 · 5 passed, 2 failed`) during `dotnet test`
- Live tree and Test Explorer updates from xUnit stdout
- `LiveProgressParser` and `estimateTestCount()`

## [0.2.0] — 2026-05-29

### Added
- Scenario Outline example rows in tree and Test Explorer
- TRX mapping per outline row; tag inheritance for search/counts
- Domain/feature folder result roll-up and duration display settings

## [0.1.0] — 2026-05-29

### Added
- BDD tree, `dotnet test --filter`, STAGE/mode selector, TRX/Cucumber results
- Test Explorer, CodeLens, dashboard, execution profiles, diagnostics, output sanitizer
- MIT license; ecosystem link with [BDD Guardian](https://github.com/AngHelll/bdd-guardian)

[Unreleased]: https://github.com/AngHelll/bdd-pilot/compare/v0.3.1...HEAD
[0.3.1]: https://github.com/AngHelll/bdd-pilot/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/AngHelll/bdd-pilot/compare/v0.2.7...v0.3.0
[0.2.7]: https://github.com/AngHelll/bdd-pilot/compare/v0.2.6...v0.2.7
[0.2.6]: https://github.com/AngHelll/bdd-pilot/compare/v0.2.5...v0.2.6
[0.2.5]: https://github.com/AngHelll/bdd-pilot/compare/v0.2.4...v0.2.5
[0.2.4]: https://github.com/AngHelll/bdd-pilot/compare/v0.2.3...v0.2.4
[0.2.3]: https://github.com/AngHelll/bdd-pilot/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/AngHelll/bdd-pilot/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/AngHelll/bdd-pilot/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/AngHelll/bdd-pilot/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/AngHelll/bdd-pilot/releases/tag/v0.1.0
