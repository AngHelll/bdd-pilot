# Contributing to BDD Pilot

Thanks for your interest in improving **BDD Pilot**! It is an open-source,
community-driven project (MIT licensed) and contributions of all kinds are
welcome: bug reports, feature ideas, docs, and code.

## Principles

- **Framework-agnostic.** Keep the extension generic. Avoid hardcoding anything
  tied to a specific company, repository, or project layout.
- **Secure by default.** Never read, log, or persist credentials. Secrets stay
  in the user's own `.env`/environment.
- **Pure, testable core.** Logic lives in `src/core/*` with no dependency on the
  VS Code API, so it can be unit tested (and reused) easily.

## Getting started

```bash
npm install
npm run compile     # type-check
npm run lint
npm run test:unit   # core unit tests (node:test)
npm run build       # bundle
```

Press `F5` in VS Code to launch the Extension Development Host.

## Pull requests

1. Fork the repo and create a feature branch.
2. Add or update unit tests for any behavior change (the `core/` modules are the
   place for logic + tests).
3. Make sure `npm run compile`, `npm run lint`, and `npm run test:unit` pass.
4. Open a PR with a clear description of the motivation and the change.

## Reporting issues

Please include: VS Code version, OS, the relevant `.feature`/project layout (no
secrets), and the output from the *BDD Pilot* channel.

By contributing, you agree that your contributions are licensed under the
[MIT License](./LICENSE).
