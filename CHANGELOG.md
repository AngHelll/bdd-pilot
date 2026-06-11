# Changelog

All notable changes to **BDD Pilot** are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).  
Versioning: [Semver](https://semver.org/).

## [Unreleased]

_Nothing yet._

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
