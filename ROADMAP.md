# BDD Pilot — Roadmap

> **Phase B (UX that delights) — completed in v0.3.0.** Phase C is next.

## Phases

- **Phase A — Multi-framework stability** *(foundation)*: areas 1 + 2.
- **Phase B — UX that delights** ✅ *shipped v0.3.0*: areas 3 + 4.
- **Phase C — Product** *(next)*: areas 5 + 6 + 7 + 8.

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
- Configurable filter mapping (Reqnroll vs SpecFlow vs NUnit/MSTest).
- Robust discovery: Scenario Outline rows, tag inheritance.
- Project/solution selection for multi-project layouts.

### 2. Configuration & environments
- Custom stage names per project.
- Documented `.env` convention + `env.example`.
- Runtime toggles in UI (`HEADLESS_MODE`, etc.).

---

## Phase C — Product *(planned)*

### 5–8. Diagnostics, security, CI/distribution, brand & community
See previous roadmap sections in git history.

---

## Shipped (MVP → v0.3.0)

- ✅ Domain/Feature/Scenario tree, filters, env loading, TRX decoration.
- ✅ Diagnostics analyzer (SDK, NuGet, Playwright, etc.).
- ✅ Pure unit-tested `core/`; MIT licensed; framework-agnostic.
