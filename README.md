# BDD Pilot

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

**BDD Pilot** is an open-source VS Code extension that gives you a graphical
interface to discover, filter and run **Reqnroll / SpecFlow + xUnit** BDD tests
from `.feature` files — reliably, securely, and with actionable diagnostics.

It is framework-agnostic: it works with any .NET BDD project that runs through
`dotnet test`, regardless of domain (API tests, web/Playwright tests, etc.). No
project- or vendor-specific assumptions are baked in.

## Features

- **Test tree**: Domain → Feature → Scenario, parsed from `.feature` files, with
  tag badges. Domain grouping is derived from a `Feature/` or `Features/` folder.
- **One-click run**: run a domain, a whole feature, or a single scenario; the
  correct `dotnet test --filter` is built automatically.
  - Feature → `FullyQualifiedName~<Feature>Feature`
  - Scenario → `FullyQualifiedName~<Feature>Feature.<Scenario>`
  - Tag → `Category=<tag>`
- **Environment selector** (`dev`/`test`/`stg`/`prod`) in the status bar — sets
  `STAGE` for the run.
- **Parallelism mode** (`debug`/`parallel`/`ci`) passed as xUnit RunSettings, so
  the project's `xunit.runner.json` is never mutated on disk.
- **Reliable execution**: progress UI, cancellation, and live streaming to the
  *BDD Pilot* output channel.
- **TRX results**: scenarios are decorated with pass / fail / skip and duration.
- **Actionable diagnostics**: turns cryptic failures (missing SDK from
  `global.json`, private NuGet feed/auth errors, vulnerability-as-error, missing
  filter matches, broken Playwright drivers) into clear, actionable hints.

## Security

- The extension **never reads or stores credentials**. Secrets continue to come
  from the project's own `.env` mechanism.
- An optional `config/.env.<stage>` file is loaded into the test process's
  environment **in memory only** (never logged or persisted).
- All output is **sanitized** before being written to the channel (client
  secrets, passwords, tokens, JWTs, connection strings are redacted).
- Running against `stg`/`prod` requires an **explicit modal confirmation**
  (configurable).

## Architecture

```
src/
├── core/          # Pure logic, no VS Code API — unit tested
│   ├── gherkin/   # .feature parser, grouping, discovery
│   ├── runner/    # dotnet test arg/env building + spawn
│   ├── results/   # TRX parser
│   ├── diagnostics/ # error-output analyzer
│   └── config/    # stages, modes, project locator, .env loader
├── providers/     # TreeDataProvider + status bar (VS Code layer)
├── security/      # env guard policy + output sanitizer
└── extension.ts   # activation + commands wiring
```

The `core/` layer has no dependency on the VS Code API, so it is fully unit
testable and reusable (e.g. a future CLI).

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `bddPilot.projectPath` | `""` | Path to the .NET test project. Empty = auto-detect. |
| `bddPilot.defaultStage` | `test` | Default `STAGE`. |
| `bddPilot.defaultMode` | `debug` | Default parallelism mode. |
| `bddPilot.requireConfirmationForStages` | `["stg","prod"]` | Stages that require confirmation. |
| `bddPilot.dotnetPath` | `dotnet` | Path to the `dotnet` executable. |

## Requirements

- VS Code 1.90+
- .NET SDK (any feeds your project needs must be reachable / authenticated on
  your machine — BDD Pilot does not manage credentials)

## Development

```bash
npm install
npm run compile      # type-check
npm run lint
npm run test:unit    # core unit tests (node:test)
npm run build        # bundle with esbuild -> dist/extension.js
npm run package      # produce a .vsix
```

Press `F5` in VS Code to launch the Extension Development Host.

## Roadmap

- Webview dashboard (run history, flaky rate, trends).
- CodeLens "Run scenario" inside `.feature` files.
- Native `TestController` (Test Explorer) integration.
- Saved filters / execution profiles.

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md). BDD Pilot is
open source under the [MIT License](./LICENSE).
