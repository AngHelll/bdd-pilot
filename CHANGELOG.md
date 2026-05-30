# Changelog

All notable changes to **BDD Pilot** are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).  
Versioning: [Semver](https://semver.org/) (conservative `0.x` until Marketplace stable).

## [Unreleased]

_Nothing yet._

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

[Unreleased]: https://github.com/AngHelll/bdd-pilot/compare/v0.3.0...HEAD
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
