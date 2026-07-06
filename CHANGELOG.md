# Changelog

All notable changes to **BDD Pilot** are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).  
Versioning: [Semver](https://semver.org/).

## [Unreleased]

_Nothing yet._

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
