# BDD Pilot — Roadmap

> **Phase B (UX) — complete.** Current release: **v0.1.0** (pre-marketplace beta).

## Versioning (0.x)

We keep semver conservative until the extension is on the Marketplace and stable:

| Version | Milestone |
|---------|-----------|
| **0.1.0** | First usable beta — tree, run/debug, dashboard, profiles (MVP + Phase B) |
| **0.2.0** | Phase A — outline filters, tag inheritance, runner robustness |
| **0.3.0** | Phase C — marketplace, i18n, CI sample project, polish |
| **1.0.0** | Stable public release; breaking changes follow semver strictly |

Internal phase labels (A/B/C) track *scope*, not the published version number.

## Recommended next (priority order)

Work that delivers the most value before marketplace polish:

| Priority | Track | Item | Why |
|----------|-------|------|-----|
| **1** | Phase A | **Scenario Outline row filters** | Outlines appear as one node today; xUnit runs each example as a separate test — filters often miss or over-run. Adapt outline expansion logic (similar to [BDD Guardian](https://github.com/AngHelll/bdd-guardian)) for filter building. |
| **2** | Phase A | **Tag inheritance** (feature → scenario) | Tag-based runs and search should include scenarios that inherit `@Smoke` from the Feature line. |
| **3** | Phase A | **`env.example` + docs** | Document the optional `config/.env.<stage>` convention so adopters know how to wire secrets without the extension storing them. |
| **4** | Phase C | **Cross-link + publish** | Add BDD Pilot link in Guardian README; publish **0.1.0** to VS Marketplace (private beta or public). |
| **5** | Phase C | **i18n EN/ES** | Port the lightweight i18n pattern from Guardian for status bar, dashboard, and diagnostics hints. |
| **6** | Phase A | **Configurable filter mapping** | Support SpecFlow/NUnit naming differences via settings when projects don't follow Reqnroll's `Feature` class suffix. |

---

## Phases

- **Phase A — Multi-framework stability** *(foundation)*: areas 1 + 2.
- **Phase B — UX that delights** ✅ *in v0.1.0*: areas 3 + 4.
- **Phase C — Product**: areas 5 + 6 + 7 + 8.

---

## Phase B — UX that delights ✅

### 3. User experience
- ✅ **Native Test Explorer** (`TestController`): Run + Debug profiles, TRX/Cucumber
  results mapped back with rich failure messages.
- ✅ **CodeLens** on Feature/Scenario lines (`Run` / `Debug`).
- ✅ **Saved execution profiles** + **tree search** filter.
- ✅ **Re-run failed** from the last run's filter.
- ✅ **Debug** via `coreclr` launch of `dotnet test`.

### 4. Results & reporting
- ✅ **Webview dashboard**: run history, pass/fail totals, flaky scenario table.
- ✅ **Cucumber JSON** parser + unified result loader (TRX preferred, Cucumber fallback).
- ✅ **Rich failure detail**: error text + recent evidence file links (screenshots/traces).

---

## Phase A — Multi-framework stability *(planned)*

### 1. Runner robustness & multi-framework compatibility
- [ ] Scenario Outline: expand Examples rows in tree and filters.
- [ ] Tag inheritance from Feature/Background onto scenarios.
- [ ] Configurable filter mapping (Reqnroll vs SpecFlow vs NUnit/MSTest).
- [ ] Project/solution selection for multi-project layouts.

### 2. Configuration & environments
- [ ] Custom stage names per project.
- [ ] Documented `.env` convention + `env.example`.
- [ ] Runtime toggles in UI (`HEADLESS_MODE`, etc.).

---

## Phase C — Product *(planned)*

### 5. Diagnostics & reliability
- [ ] More build/runtime patterns (timeout, port in use, test host crash).
- [ ] Integration smoke tests against a minimal sample .NET BDD project in CI.

### 6. Security hardening
- [ ] Audit sanitizer patterns; optional strict mode (block run if env file missing for prod).

### 7. Distribution
- [ ] VS Marketplace listing + icon/banner.
- [ ] GitHub release with `.vsix` artifact.
- [ ] Reciprocal README link with [BDD Guardian](https://github.com/AngHelll/bdd-guardian).

### 8. Community
- [ ] Issue templates, changelog (`CHANGELOG.md`).
- [ ] Optional shared `@anghelll/bdd-gherkin-lite` package if Pilot + Guardian parsers converge.

---

## Shipped (v0.1.0)

- ✅ Domain/Feature/Scenario tree, filters, env loading, TRX decoration.
- ✅ Diagnostics analyzer (SDK, NuGet, Playwright, etc.).
- ✅ Pure unit-tested `core/`; MIT licensed; framework-agnostic.
- ✅ BDD extension family documented alongside BDD Guardian.
