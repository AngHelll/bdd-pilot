# BDD Pilot — Roadmap

> Living document: what shipped, what is in progress, and what comes next.  
> **Current release: v1.52.0** · **Marketplace: v1.52.0** · **Next: watch** · **659 unit tests**

---

## At a glance

| Status | Item |
|--------|------|
| ✅ Shipped (GitHub + Marketplace) | v0.1.0 → **v1.52.0** |
| 🎯 Next | watch |
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
| **1.50.0** | Hard cancel + abort watchdog — process tree kill, lock always released, debug Cancel · spec `hard-cancel-watchdog-v1.50.md` |
| **1.52.0** | Activation & discovery perf — lazy Theory enrich + domain reuse · spec `activation-discovery-perf-v1.52.md` |
| **1.51.0** | Failure triage — Review first headline, Jump by class, Filter Failures by Class · spec `failure-triage-v1.51.md` |
| **1.49.0** | Discover-time matching — listed vs Gherkin before `dotnet test` · spec `discover-time-matching-v1.49.md` |
| **1.48.0** | CF2 leaf story strip — fail snippet on tree/TE description; compact omits tags · spec `cockpit-fidelity-cf2-v1.48.md` |
| **1.47.0** | Skipped honesty — TRX skipped from `UnitTestResult` when ResultSummary is 0 · spec `skipped-honesty-v1.47.md` |
| **1.46.0** | Residual Outline / Theory keys — runner metadata, unquoted scalars, no first-apply K>1 · spec `residual-outline-theory-keys-v1.46.md` |
| **1.45.0** | Diagnostics by domain — Output roll-up of failure buckets per discovery domain · spec `diagnostics-by-domain-v1.45.md` |
| **1.44.0** | Unused TRX split — gherkin-like vs other in health/Output/Debug Pack · spec `unused-trx-split-v1.44.md` |
| **1.43.0** | Run-domain-first — scoped Run All nudge + fail-concentration tip · spec `run-domain-first-v1.43.md` |
| **1.42.0** | Outline match fidelity — Theory → Examples row 1:1 (no length===1 short-circuit) · spec `outline-match-fidelity-v1.42.md` |
| **1.41.0** | Matching observability D3 — layout/grouping in Debug Pack · spec `matching-observability-v1.40.md` |
| **1.40.0** | Matching observability — Debug Pack + health Output · spec `matching-observability-v1.40.md` |
| **1.39.0** | Tree container health tint — watch band on domain/feature/tag icons · spec `tree-container-health-v1.39.md` |
| **1.38.1** | CF-docs — CI parity recipe (Stage-faithful) · spec `cockpit-fidelity-cf-docs-v1.38.1.md` |
| **1.38.0** | Mapped vs TRX dual counts + Run All unused Output · spec `trx-reporting-honesty-v1.36.md` slice C |
| **1.37.0** | Diagnostics per failed TRX test — exclusive buckets, unique `UnitTestResult` · spec `trx-reporting-honesty-v1.36.md` slice B |
| **1.36.2** | VSIX TRX parser — bundle `fast-xml-parser` into headless `trxParser` · spec `trx-reporting-honesty-v1.36.md` slice A |
| **1.36.1** | Scope target resolution — shared `resolveFeatureInDomains` + `path.normalize` · spec `scope-target-resolution-v1.36.1.md` |
| **1.36.0** | Cockpit fidelity CF3 — pre-run dry filter on stg/prod confirm · spec `cockpit-fidelity-v1.33.md` |
| **1.35.0** | Mapping honesty 2-way — TRX unused + ambiguous in scoped Output · spec `mapping-honesty-2way-v1.35.md` |
| **1.33.0** | Cockpit fidelity CF1 — Copy effective `dotnet` command · spec `cockpit-fidelity-v1.33.md` |
| **1.32.1** | Security deps — fast-xml-parser 5, esbuild 0.25, vsce 3, typescript-eslint 8 |
| **1.32.0** | Marketplace gallery — cockpit screenshots + ForgeOne line · spec `marketplace-gallery-v1.32.md` |
| **1.31.0** | Dotnet flags P2 — cliVerbosity, blame, blameHang · spec `dotnet-flags-p2-v1.31.md` |
| **1.30.0** | Hub Cancel — Cancel first row in status bar hub QuickPick while busy · spec `hub-cancel-v1.30.md` |
| **1.29.0** | Gherkin cockpit visual vs TE — README signals + summary chip priority · spec `gherkin-cockpit-visual-v1.29.md` |
| **1.28.0** | Run control — busy lock UX (disable Run while running, Cancel first, summary cancel) · spec `run-control-v1.28.md` |
| **1.27.0** | Output UX actions — jump-to-failure, collapse-to-failures, autoShowOutput · spec `output-ux-actions-v1.27.md` |
| **1.26.0** | Output clarity + Tree scan — Output sections/verbosity + fail-first/pending · spec `output-tree-ux-v1.26.md` |
| **1.25.0** | Release & dogfood loop — `release:prep` + `docs:sync-check` · spec `release-dogfood-loop-v1.25.md` |
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

_Nothing queued._

### v1.52.0 — Activation & discovery perf ✅ shipped

| Area | Change |
|------|--------|
| **Activate** | Theory enrich deferred (~1 s idle) when needed; no longer blocks rehydrate |
| **Run** | `estimateTestCount` reuses tree domains (tree + TE hot path) |
| **API** | Sin cambio (`PilotRunApiV1` intacto) |
| **Marketplace** | Published v1.52.0 |
| **Tests** | 659 unit tests |

### v1.51.0 — Failure triage (review-first) ✅ shipped

| Area | Change |
|------|--------|
| **Output / toast** | `Review first:` + optional Hotspot after failed runs; Jump lands on top failure class |
| **Tree** | Command **Filter Failures by Class** (QuickPick → collapse to bucket) |
| **API** | Sin cambio (`PilotRunApiV1` intacto) |
| **Marketplace** | Published v1.51.0 |
| **Tests** | 657 unit tests |

### v1.50.0 — Hard cancel + abort watchdog ✅ shipped

| Area | Change |
|------|--------|
| **Runner** | Cancel kills the `dotnet` process tree (Unix group / Windows `taskkill /T`); abort watchdog SIGKILL + always release lock; debug Cancel stops the Pilot session |
| **API** | Sin cambio (`PilotRunApiV1` intacto) |
| **Marketplace** | Published v1.50.0 |
| **Tests** | 650 unit tests |

### v1.49.0 — Discover-time matching ✅ shipped

| Area | Change |
|------|--------|
| **Runner** | Scoped `list-tests` with the same `--filter`; toast+Output on listed=0; Output only on 1 vs N; empty Gherkin scope does not start `dotnet test` |
| **API** | Sin cambio (`PilotRunApiV1` intacto) |
| **Marketplace** | Published v1.49.0 |
| **Tests** | 635 unit tests |

### v1.48.0 — Cockpit fidelity CF2 (leaf story strip) ✅ shipped

| Area | Change |
|------|--------|
| **Tree / TE** | `formatLeafStoryStrip`: fail snippet + skip narrativo en description; compact omite tags (y duration en fail) |
| **API** | Sin cambio (`PilotRunApiV1` intacto) |
| **Marketplace** | Published v1.48.0 |
| **Tests** | 621 unit tests |

### v1.47.0 — Residual matching (Outline keys + skipped honesty) ✅ shipped

| Area | Change |
|------|--------|
| **Matching** | Theory metadata `__*` / `exampleTags` ignorados; escalares sin comillas; no first-apply si K>1; `__pickleIndex` solo desempate; Debug Pack `theoryKeys=` vs `exampleHeaders=` (1.46) |
| **TRX totals** | `skipped` sube al conteo de filas `NotExecuted`/`Skipped` cuando ResultSummary queda en 0 (1.47) |
| **API** | Sin cambio (`PilotRunApiV1` intacto) |
| **Marketplace** | Published v1.47.0 |
| **Tests** | 615 unit tests |

### v1.45.0 — Diagnostics by domain ✅ shipped

| Area | Change |
|------|--------|
| **Diagnostics** | Output roll-up de fallos TRX por `deriveDomain` + buckets (`pending`, `testData`, `http`, …); silencio si <2 dominios o <3 fails |
| **API** | Sin cambio (`PilotRunApiV1` intacto) |
| **Marketplace** | Published v1.45.0 |
| **Tests** | 603 unit tests |

### v1.44.0 — Unused TRX split ✅ shipped

| Area | Change |
|------|--------|
| **Matching honesty** | Unused TRX → `unused_gherkin` / `unused_other` (heurística estructural de `testName`) en health, Output y Debug Pack |
| **API** | Sin cambio (`PilotRunApiV1` intacto) |
| **Marketplace** | Published v1.44.0 |
| **Tests** | 600 unit tests |

### v1.43.0 — Run-domain-first ✅ shipped

| Area | Change |
|------|--------|
| **Run** | Pre-Run All scoped nudge (umbrales genéricos) + tip Output si fallos concentrados · `bddPilot.run.suggestScopedWhenLarge` |
| **API** | Sin cambio (`PilotRunApiV1` intacto) |
| **Marketplace** | Published v1.43.0 |
| **Tests** | 591 unit tests |

### v1.42.0 — Outline match fidelity ✅ shipped

| Area | Change |
|------|--------|
| **Core** | `matchesOutlineExampleRow` + apply path: Theory/celda por fila Outline sin short-circuit `length===1` |
| **API** | Sin cambio (`PilotRunApiV1` intacto) |
| **Marketplace** | Published v1.42.0 |
| **Tests** | 584 unit tests |

### v1.41.0 — Matching observability D3 (layout/grouping) ✅ shipped

| Area | Change |
|------|--------|
| **Debug Pack** | `## Layout / grouping` — domain rule, groupBy, path/subpath, gaps-by-domain, layout hints |
| **API** | Sin cambio |
| **Marketplace** | Published v1.41.0 |
| **Tests** | 581 unit tests |

### v1.40.0 — Matching observability ✅ shipped (included in Marketplace via 1.41.0)

| Area | Change |
|------|--------|
| **Debug Pack** | Palette `bddPilot.copyMatchingDebugPack` — sanitized markdown of mapping gaps + TRX candidates |
| **Health** | One Output line `Matching health: …` with local hints when gaps exist |
| **API** | Sin cambio (`PilotRunApiV1` intacto) |
| **Tests** | 578 unit tests |

### v1.39.0 — Tree container health tint ✅ shipped

| Area | Change |
|------|--------|
| **Tree** | Domain / feature / tag icons: watch (warning) when 1–2 failures in a large container (≤10%); leaves stay fail-first |
| **API** | Sin cambio (`rollupSeverity` / `PilotRunApiV1` intactos) |
| **Marketplace** | Published v1.39.0 |
| **Tests** | 571 unit tests |

### v1.38.1 — CF-docs (CI parity) ✅ shipped

| Area | Change |
|------|--------|
| **Docs** | README Stage-faithful CI recipe + Copy Effective Dotnet Command bridge |
| **CI** | `sample-smoke` sets `STAGE=test` |
| **API** | Sin cambio |
| **Marketplace** | Published v1.38.1 |
| **Tests** | 559 unit tests (docs-only ship) |

### v1.38.0 — Mapped vs TRX honesty ✅ shipped

| Area | Change |
|------|--------|
| **Summary / dashboard** | Dual mapped · TRX counts when they diverge; silence when equal |
| **Run All** | Output lists unused TRX rows (cap 25); no mass `not_in_trx` on tree |
| **API** | Sin cambio `PilotRunApiV1` |
| **Marketplace** | Published v1.38.0 |
| **Tests** | 559 unit tests + `test:vsix-trx` smoke |

### v1.37.0 — Diagnostics per failed TRX test ✅ shipped

| Area | Change |
|------|--------|
| **Diagnostics** | One failed `UnitTestResult` → one category; `PENDING_STEPS` / `TEST_DATA_SETUP` n = unique tests; loose `fixture` match removed |
| **API** | Sin cambio `PilotRunApiV1` |
| **Marketplace** | Published v1.37.0 (includes 1.36.2 packaging) |
| **Tests** | 554 unit tests + `test:vsix-trx` smoke |

### v1.36.2 — VSIX TRX parser ✅ shipped

| Area | Change |
|------|--------|
| **Packaging** | Headless `trxParser` esbuild-inlines `fast-xml-parser`; clean VSIX extract parses TRX / Failure Context |
| **API** | Sin cambio `PilotRunApiV1` |
| **Marketplace** | Included in v1.37.0 |
| **Tests** | 544 unit tests + `test:vsix-trx` smoke |

### v1.36.1 — Scope target resolution ✅ shipped

| Area | Change |
|------|--------|
| **Core** | `resolveFeatureInDomains` / `resolveScenarioInDomains` — canonical `path.normalize`; run scope clear + binding gate share resolver |
| **API** | Sin cambio `PilotRunApiV1` |
| **Marketplace** | Published v1.36.1 |
| **Tests** | 541 unit tests |

### v1.36.0 — Cockpit fidelity CF3 (pre-run dry filter) ✅ shipped

| Area | Change |
|------|--------|
| **CF3** | stg/prod confirm `detail`: N estimado + `--filter` truncado; misma línea en Output al arrancar |
| **API** | Sin cambio `PilotRunApiV1` |
| **Marketplace** | Published v1.36.0 |
| **Tests** | 536 unit tests |

### v1.35.0 — Mapping honesty 2-way ✅ shipped

| Area | Change |
|------|--------|
| **H1–H5** | Scoped Output: TRX unused rows + ambiguous leaves (first applied) + shared-row count; match semantics unchanged |
| **API** | Sin cambio `PilotRunApiV1` |
| **Marketplace** | Published v1.35.0 |
| **Tests** | 531 unit tests |

### v1.33.0 — Cockpit fidelity CF1 (Copy effective command) ✅ shipped

| Area | Change |
|------|--------|
| **CF1** | Palette `bddPilot.copyEffectiveDotnetCommand` — last session `dotnet test …` (run/debug) to clipboard |
| **Core** | `formatEffectiveDotnetCommand` + RunService snapshot |
| **API** | Sin cambio `PilotRunApiV1` |
| **Marketplace** | Published v1.33.0 |
| **Tests** | 524 unit tests |

### v1.32.1 — Security dependency bumps ✅ shipped

| Area | Change |
|------|--------|
| **Deps** | `fast-xml-parser` 5 · `esbuild` 0.25 · `@vscode/vsce` 3 · `@typescript-eslint/*` 8 |
| **API** | Sin cambio `PilotRunApiV1` / `src/` behavior |
| **Marketplace** | Published v1.32.1 |
| **Tests** | 519 unit tests |

### v1.32.0 — Marketplace gallery ✅ shipped

| Area | Change |
|------|--------|
| **G1–G3** | `media/gallery/` frames + README captions + ForgeOne Pilot·Guardian·Jarvis |
| **G4** | v1.32.0 docs/media; no `src/` behavior |
| **API** | Sin cambio `PilotRunApiV1` |
| **Marketplace** | Published v1.32.0 |
| **Tests** | 519 unit tests |

### v1.31.0 — Dotnet flags P2 ✅ shipped

| Area | Change |
|------|--------|
| **F1–F3** | `run.cliVerbosity` / `run.blame` / `run.blameHang` + timeout → `dotnet test` args |
| **F4** | Run/debug parity; hub diagnostic flag parts; Output shows flags on existing `dotnet …` line |
| **F5** | README CLI ≠ Output filter; byStage remains P1-only |
| **API** | Sin cambio `PilotRunApiV1` |
| **Marketplace** | Published v1.31.0 |
| **Tests** | 519 unit tests |

### v1.30.0 — Hub Cancel ✅ shipped

| Area | Change |
|------|--------|
| **H1–H4** | Hub QuickPick Cancel first when busy; `bddPilot.cancel`; i18n; pure prepend helper |
| **API** | Sin cambio `PilotRunApiV1` |
| **Marketplace** | Published v1.30.0 |
| **Tests** | 514 unit tests |

### v1.29.0 — Gherkin cockpit visual ✅ shipped

| Area | Change |
|------|--------|
| **P1-A** | README Pilot vs TE + Iconography cockpit signals table |
| **P1-B** | Summary chip priority + STAGE chip; hub scannable STAGE·mode line |
| **P1-C** | Gherkin/STAGE vocabulary (tree, dashboard, hub tooltips) EN/ES |
| **API** | Sin cambio `PilotRunApiV1` |
| **Marketplace** | Published v1.29.0 |
| **Tests** | 512 unit tests |

### v1.28.0 — Run control (busy lock UX) ✅ shipped

| Area | Change |
|------|--------|
| **P1-A** | `when: !bddPilot.running` for Run/Debug inline + Run All/Filtered; CodeLens omit; enablement on launch commands; lock claimed before preflight |
| **P1-B** | Cancel at `navigation@0`; summary row → `bddPilot.cancel` while running |
| **P1-C** | Toasts with cancel hint (toolbar / summary) |
| **API** | Sin cambio `PilotRunApiV1` |
| **Marketplace** | Published v1.28.0 |
| **Tests** | 509 unit tests |

### v1.27.0 — Output UX actions ✅ shipped

| Area | Change |
|------|--------|
| **C1** | Jump to first failure (comando + toast) |
| **C2** | Collapse to failures (toolbar + overflow) |
| **C3** | `feedback.autoShowOutput` off / onFailure / always |
| **API** | Sin cambio `PilotRunApiV1` |
| **Marketplace** | Published v1.27.0 |
| **Tests** | 506 unit tests |

### v1.26.0 — Output clarity + Tree scan ✅ shipped

| Area | Change |
|------|--------|
| **Output** | Section headers Run/Results/Diagnostics; run context line; `feedback.dotnetVerbosity` filtered/raw |
| **Tree** | Compact outline fail-first; pending `not run` + distinct `not_in_trx` icon |
| **API** | Sin cambio `PilotRunApiV1` |
| **Marketplace** | Published v1.26.0 |
| **Tests** | 498 unit tests |

### v1.25.0 — Release & dogfood loop ✅ shipped

| Area | Change |
|------|--------|
| **P1** | `scripts/release-prep.sh` + `npm run release:prep` |
| **P3** | `scripts/docs-sync-check.sh` + `npm run docs:sync-check` |
| **P2** | Cursor Automation — **descartado** (script local basta) |
| **Docs** | README Development scripts; CHANGELOG |
| **Marketplace** | Published v1.25.0 |
| **Tests** | 486 unit (unchanged) |

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

*Last updated: v1.50.0 hard cancel shipped Marketplace.*
