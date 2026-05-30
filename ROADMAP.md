# BDD Pilot — Roadmap

> Living document: what shipped, what is in progress, and what comes next.  
> **Current release: v0.2.2** (Phase A partial) · **77+ unit tests**

---

## At a glance

| Status | Item |
|--------|------|
| ✅ Shipped | v0.1.0 beta + **v0.2.x** Phase A partial (see [Changelog](#changelog)) |
| 🎯 Next | Phase C → **v0.3.0** (marketplace, i18n, CI sample project) |
| 🏁 Goal | **v1.0.0** — stable public release |

**Companion extension:** [BDD Guardian](https://github.com/AngHelll/bdd-guardian) (navigation & bindings). Pilot = execution.

---

## Versioning (0.x)

Semver stays conservative until Marketplace + stable API:

| Version | Milestone |
|---------|-----------|
| **0.1.0** | First usable beta — tree, run/debug, dashboard, profiles, compact tree labels |
| **0.2.0** | Phase A partial — outline rows in tree, tag inheritance, result roll-up on folders |
| **0.2.1** | Live execution progress — notification bar + tree/Test Explorer update during `dotnet test` |
| **0.2.2** | Per-row outline run filter, configurable filter mapping, `config/env.example` |
| **0.3.0** | Phase C — marketplace, i18n, CI sample project, polish |
| **1.0.0** | Stable public release |

Internal labels **Phase A / B / C** track *scope*, not the published version number.

---

## Changelog

### Unreleased *(main branch)*

_None — see v0.2.2 below._

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

**Known limits:** progress depends on xUnit stdout format; parallel runs update counts but order is non-deterministic. Single outline-row Run still executes the whole Theory.

### v0.2.0 — Phase A (partial)

| Area | Change |
|------|--------|
| **Tree roll-up** | Domain/feature folders tint pass/fail; description shows `2 failed · 17 passed` |
| **Scenario Outline** | Parser reads `Examples` tables; outline rows as child nodes (`parameter=invalid-guid`) |
| **Results mapping** | TRX/Cucumber matched per outline row via example cell values |
| **Tag inheritance** | Feature tags included in search + effective tag counts (`effectiveScenarioTags`) |
| **Test Explorer** | Outline rows appear as children in native Testing panel |

**Known limit:** clicking Run on a single outline row still filters to the whole Theory method (all example rows). Per-row execution needs xUnit `DisplayName` or similar — backlog.

### v0.1.0 — first beta (post–0.1.0 tag tree UX)

| Commit theme | Delivered |
|--------------|-----------|
| **MVP** | Domain → Feature → Scenario tree from `.feature` files |
| **MVP** | `dotnet test --filter` (feature / scenario / tag / domain) |
| **MVP** | STAGE selector + parallelism modes (`debug` / `parallel` / `ci`) |
| **MVP** | Optional `config/.env.<stage>` load (in memory, never logged) |
| **MVP** | TRX parsing + pass/fail/skip decoration |
| **MVP** | Diagnostics analyzer (SDK, NuGet, Playwright, no-tests-matched, …) |
| **MVP** | Output sanitizer; pure `core/` + 43+ unit tests |
| **Phase B** | Native **Test Explorer** (`TestController`) — Run + Debug |
| **Phase B** | **CodeLens** on Feature/Scenario lines |
| **Phase B** | **RunService** — shared orchestration, history, re-run failed |
| **Phase B** | **Dashboard** webview — run history, flaky table |
| **Phase B** | **Cucumber JSON** + unified result loader (TRX preferred) |
| **Phase B** | **Evidence** links on failures (screenshots/traces/videos) |
| **Phase B** | **Execution profiles** + tree search |
| **Docs** | MIT LICENSE (`AngHelll`), README ecosystem with BDD Guardian |
| **Docs** | ROADMAP versioning table; semver reset to **0.1.0** |

### Ecosystem (cross-repo, no code coupling)

| Repo | Done |
|------|------|
| **bdd-pilot** | README “BDD extension family” section → links Guardian |
| **bdd-guardian** | README “BDD extension family” section → links Pilot |

---

## Recommended next (priority order)

| # | Version | Track | Item | Why |
|---|---------|-------|------|-----|
| **1** | 0.3.0 | Phase C | **Publish to Marketplace** | List 0.2.x+ with GitHub release `.vsix` |
| **2** | 0.3.0 | Phase C | **i18n EN/ES** | Port Guardian i18n for status bar, dashboard, diagnostics |
| **3** | 0.3.0 | Phase C | **CI sample project** | Integration smoke test against minimal Reqnroll + xUnit repo |

### Backlog (nice-to-have, not scheduled)

- Tree view grouped **by tag** (e.g. `@smoke` → scenarios)
- Custom stage names per project
- Runtime toggles in UI (`HEADLESS_MODE`, …)
- Optional shared `@anghelll/bdd-gherkin-lite` if Pilot + Guardian parsers converge

---

## Phases (detail)

### Phase B — UX that delights ✅ *(in v0.1.0)*

#### 3. User experience
- ✅ Native Test Explorer (`TestController`): Run + Debug, TRX/Cucumber → tree
- ✅ CodeLens on Feature/Scenario lines (Run / Debug)
- ✅ Saved execution profiles + tree search
- ✅ Re-run failed from last run filter
- ✅ Debug via `coreclr` + `dotnet test`
- ✅ **Compact tree labels** + tooltips (`tree.tagDisplay` settings)
- ✅ **Result roll-up** on domain/feature folders after a run

#### 4. Results & reporting
- ✅ Webview dashboard (history, totals, flaky table)
- ✅ Cucumber JSON parser + unified loader (TRX preferred)
- ✅ Rich failures: error text + evidence file links

---

### Phase A — Multi-framework stability *(→ v0.2.0)*

#### 1. Runner robustness & multi-framework compatibility
- [x] Scenario Outline: expand Examples rows in **tree**; map TRX results per row.
- [x] Scenario Outline: **per-row** dotnet filter (Theory / DisplayName).
- [x] Tag inheritance from Feature onto search and effective tag display.
- [x] Configurable filter mapping (feature class suffix, tag trait, outline strategy).
- [ ] Project/solution selection for multi-project layouts.

#### 2. Configuration & environments
- [ ] Custom stage names per project
- [x] Documented `.env` convention + `env.example` template
- [ ] Runtime toggles in UI (`HEADLESS_MODE`, etc.)

---

### Phase C — Product *(→ v0.3.0)*

#### 5. Diagnostics & reliability
- [ ] More build/runtime patterns (timeout, port in use, test host crash)
- [ ] Integration smoke tests against minimal sample .NET BDD project in CI

#### 6. Security hardening
- [ ] Audit sanitizer patterns
- [ ] Optional strict mode (block run if env file missing for prod)

#### 7. Distribution
- [ ] VS Marketplace listing + icon/banner
- [ ] GitHub release with `.vsix` artifact
- ✅ Reciprocal README link with [BDD Guardian](https://github.com/AngHelll/bdd-guardian)

#### 8. Community
- [ ] Issue templates
- [ ] `CHANGELOG.md` (extract from this roadmap on each release)
- [ ] Contributing guide refresh after 1.0.0

---

## Architecture (reference)

```
src/
├── core/           # Pure logic — unit tested, no VS Code API
│   ├── gherkin/    # parser, grouping, discovery, treeLabels
│   ├── runner/     # dotnet test args, filterBuilder, spawn
│   ├── results/    # TRX, Cucumber, evidence, runHistory, resultLoader
│   ├── diagnostics/
│   └── config/     # types, profiles, projectLocator, envFile
├── providers/      # Tree, TestController, CodeLens, RunService, dashboard
├── security/       # envGuard, sanitizer
└── extension.ts
```

**Principles:** framework-agnostic · no credentials stored/logged · optional `.env` in memory only · Reqnroll `Feature` suffix in filters (configurable in Phase A).

---

## Shipped checklist (v0.2.0)

- ✅ Everything in v0.1.0 (tree, run, dashboard, profiles, compact labels)
- ✅ Folder/feature **result roll-up** (icon tint + `N failed · M passed`)
- ✅ **Scenario Outline** example rows in tree + Test Explorer
- ✅ **Tag inheritance** in search and tag counts
- ✅ 61 unit tests on `core/`

---

*Last updated: v0.2.2 — per-row outline run, filter mapping, env.example.*
