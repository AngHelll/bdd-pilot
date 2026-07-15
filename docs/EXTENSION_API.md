# BDD Pilot — Extension API

BDD Pilot exposes a **read-only Run API v1** via `extension.exports` for companion extensions (e.g. BDD Jarvis).

**Frozen contract:** [CONTRACT-pilot-run-api-v1.md](https://github.com/AngHelll/bdd-jarvis/blob/main/docs-internal/specs/CONTRACT-pilot-run-api-v1.md) (maintained in the BDD Jarvis repo).  
**Canonical TypeScript:** `src/api/types.ts` in this repository.

## Activation

```typescript
const ext = vscode.extensions.getExtension('anghelll.bdd-pilot');
await ext?.activate();
const api = ext?.exports;
```

## PilotRunApiV1

| Member | Description |
|--------|-------------|
| `apiVersion` | Always `1` |
| `isReady` | `true` when a test project is resolved (settings, stored selection, or single auto-detected candidate) |
| `isRunInProgress()` | `true` during a normal run or active debug session |
| `getRunHistory()` | Up to 50 persisted run entries (newest last). No stdout/stderr. |
| `getLastRun()` | Last **completed or canceled** run in the current session (includes all-green runs). `null` before any run. |
| `getCurrentRollup()` | Tree outcome rollup with `pending` count, or `null` if empty |
| `onDidCompleteRun(listener)` | Fires when a run finishes (completed or canceled). No payload — re-query getters. |
| `onDidChangeHistory(listener)` | Fires when persisted history changes. No payload. |

## Type guard

```typescript
function isPilotRunApiV1(v: unknown): v is PilotRunApiV1 {
  return (
    typeof v === 'object' && v !== null &&
    (v as PilotRunApiV1).apiVersion === 1 &&
    typeof (v as PilotRunApiV1).isReady === 'boolean' &&
    typeof (v as PilotRunApiV1).isRunInProgress === 'function' &&
    typeof (v as PilotRunApiV1).getRunHistory === 'function' &&
    typeof (v as PilotRunApiV1).getLastRun === 'function' &&
    typeof (v as PilotRunApiV1).getCurrentRollup === 'function' &&
    typeof (v as PilotRunApiV1).onDidCompleteRun === 'function' &&
    typeof (v as PilotRunApiV1).onDidChangeHistory === 'function'
  );
}
```

## Security

- In-process only (`extension.exports`) — no network surface
- Read-only — no `run()`, `cancel()`, or `debug()` on the API
- No raw stdout/stderr, `.env` values, or connection strings
- DTOs are deep-copied; error text passes through `sanitize()`
- Event callbacks carry no payload (avoids races and accidental leakage)

## DTO overview

### Run history (`PilotRunHistoryEntryDto`)

Per-run metadata: `stage`, `mode` (xUnit parallelism), optional `runKind` (`run` | `debug` | `profile` — session launch kind; omitted on legacy entries ≡ `run`), `scopeLabel`, `filter`, counts, `status`, per-scenario outcomes (`featurePath`, `scenarioLine`, `scenarioName`), optional `trxPath` (absolute).

Primary source for flaky/runtime trends across passes and failures.

`runKind` is **additive** (optional on the wire). Do not bump `apiVersion` — consumers may ignore unknown fields.

### Last run (`PilotLastRunDto`)

Session snapshot after each run: summary, `failedScenarios`, cached `diagnostics` (from analyzer, not raw log), `evidence` paths, `exitCode`, `status`.

All-green runs return empty `failedScenarios` and `diagnostics` — metadata and summary still present.

### Rollup (`PilotOutcomeRollupDto`)

`passed`, `failed`, `skipped`, `withResults`, `pending` (scenarios without outcome yet).

## Ecosystem (ForgeOne)

| Extension | Role |
|-----------|------|
| **BDD Pilot** (this) | Test execution — **Run API producer** since v1.4.0 |
| **BDD Jarvis** | Workspace analysis, execution insights — **primary consumer** (v0.8.x+) |
| **BDD Guardian** | Structural index & bindings — Index API producer |

Jarvis activates Pilot by exact id `anghelll.bdd-pilot`, validates `isPilotRunApiV1`, and falls back to TRX-on-disk when the API is absent or not ready.

## Consumer checklist

1. Activate Pilot by exact id `anghelll.bdd-pilot`
2. Type-guard with `isPilotRunApiV1`
3. Treat `isReady === false` as “use TRX fallback”
4. Enhanced mode: `isReady && getRunHistory().length > 0`
5. Debounce listeners ≥500ms on `onDidCompleteRun` / `onDidChangeHistory`
6. Do not assume `scenarios[]` is complete on canceled partial runs

Internal implementation notes: `docs-internal/specs/pilot-run-api-v1.md`.
