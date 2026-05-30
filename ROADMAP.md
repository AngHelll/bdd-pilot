# BDD Pilot — Roadmap

> Living document: what shipped, what is in progress, and what comes next.  
> **Current release: v0.3.3** · **115 unit tests**

---

## At a glance

| Status | Item |
|--------|------|
| ✅ Shipped | v0.1.0 → **v0.3.3** (see [CHANGELOG.md](./CHANGELOG.md)) |
| 🎯 Next | **v0.3.4** — Marketplace dogfood gate + checklist closure |
| 🏁 Goal | **v1.0.0** — stable public release |

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

Internal labels **Phase A / B / C** track *scope*, not the published version number.

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
| **0.3.0-6** | `feat(i18n): EN/ES status bar + dashboard` *(optional for 0.3.0)* | Port from Guardian pattern | Core commands readable in ES; can slip to 0.3.1 |

**PR order:** 0.3.0-1 → 0.3.0-2 → 0.3.0-3 + 0.3.0-4 (parallel) → 0.3.0-5 → 0.3.0-6 if time.

---

### Marketplace readiness checklist

Use before clicking **Publish** on Marketplace:

#### Product
- [ ] Install from `.vsix` on clean VS Code (no dev dependencies)
- [ ] Discover features in a repo with `Features/` **and** nested `.csproj`
- [ ] Run scenario, outline row (tree + CodeLens), feature, tag, Run All *(tag grouping: v0.3.2)*
- [ ] Partial run leaves prior pass/fail icons on other scenarios
- [ ] Live progress notification updates during run
- [ ] Dashboard shows history; profiles submenu separate from dashboard
- [ ] `stg`/`prod` shows confirmation modal
- [ ] Output channel has no raw secrets on intentional failure

#### Repo & brand
- [x] `CHANGELOG.md` through current version (v0.3.3)
- [x] GitHub Release for latest tag with `.vsix`
- [x] README links BDD Guardian; Guardian links back *(verify reciprocal link)*
- [x] Issue templates exist (bug, feature, **dogfood checklist**)
- [x] License MIT, publisher `anghelll`, icon + pilot.svg
- [x] No company-specific references in repo

#### Technical
- [x] `npm run compile && npm run lint && npm run test:unit` pass in CI
- [x] Sample BDD project smoke in CI (0.3.0-2)
- [ ] `engines.vscode` matches tested version

#### Post-publish
- [ ] Pin Marketplace version to tagged release
- [ ] Open “good first issue” for tree-by-tag or i18n gaps
- [ ] Watch issues 1–2 weeks; patch **0.3.1** if filter/outline regressions

---

### Post–0.3.0 backlog (prioritized)

| Priority | Item | Rationale |
|----------|------|-----------|
| P1 | Scenarios with `<param>` but **no** Outline table (Theory rows in tree) | ✅ list-tests inference + `Scenarios:` keyword |
| P1 | Test Explorer result parity with BDD tree (accumulated partial runs) | ✅ shared `OutcomeStore` |
| P2 | Tree grouped **by tag** (`@smoke` → scenarios) | ✅ v0.3.2 |
| P2 | More diagnostics (timeout, port in use, test host crash) | ✅ v0.3.3 |
| P3 | Custom stage names | Only if users ask |
| P3 | Runtime toggles in UI (`HEADLESS_MODE`) | `.env` covers most cases |
| P4 | Shared `@anghelll/bdd-gherkin-lite` with Guardian | Wait until parsers stabilize |

---

## Changelog

### Unreleased *(main branch)*

**v0.3.4** — Marketplace dogfood gate completion; publish sync.

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
- [ ] Marketplace listing + GitHub release automation *(publish + tag in progress)*
- [ ] i18n EN/ES *(optional 0.3.0)*
- [ ] Security audit sanitizer / strict prod mode *(post-0.3.0)*

---

## Architecture (reference)

```
src/
├── core/           # Pure logic — unit tested, no VS Code API
│   ├── gherkin/    # parser, grouping, discovery, treeLabels
│   ├── runner/     # filterBuilder, runScope, liveProgress, dotnetTest
│   ├── results/    # TRX, Cucumber, evidence, runHistory
│   ├── diagnostics/
│   └── config/     # stages, modes, profiles, projectLocator, envFile
├── providers/      # Tree, TestController, CodeLens, RunService, dashboard
├── security/       # envGuard, sanitizer
└── extension.ts
```

**Principles:** framework-agnostic · no credentials stored/logged · optional `.env` in memory only · filter mapping configurable for Reqnroll/SpecFlow.

---

*Last updated: v0.3.0 — sample CI, dogfood script, README assets (102 unit tests).*
