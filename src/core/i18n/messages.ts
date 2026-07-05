import { PilotLocale } from "./locale";

const EN = {
  "statusBar.stageTooltip": "BDD Pilot: select environment",
  "statusBar.modeTooltip": "BDD Pilot: select parallelism mode",
  "statusBar.projectTooltip": "BDD Pilot: select test project or solution",
  "statusBar.solutionSlowHint":
    "Running against the full solution can be slower. Select the .csproj test project for faster runs.",
  "statusBar.projectMissingTooltip":
    "BDD Pilot: select test project — multiple or none detected",
  "statusBar.stageLabel": "STAGE",
  "statusBar.modeLabel": "mode",
  "statusBar.projectNotSet": "project: (not set)",
  "statusBar.running": "Running…",
  "statusBar.runningTooltip": "BDD Pilot test run in progress — click to cancel",
  "statusBar.debugRunningTooltip": "BDD Pilot debug session in progress — stop from the Debug toolbar",
  "statusBar.compactProjectNotSet": "(not set)",
  "statusBar.hubTooltipTitle": "BDD Pilot — execution settings",
  "statusBar.hubTooltipStage": "Environment (STAGE)",
  "statusBar.hubTooltipMode": "Parallelism",
  "statusBar.hubTooltipProject": "Test target",
  "statusBar.hubTooltipAction": "Click to change settings",
  "statusBar.hubRunningHint": "Run in progress — cancel from sidebar toolbar or command palette",
  "statusBar.hubSectionStage": "Environment (STAGE)",
  "statusBar.hubSectionMode": "Parallelism",
  "statusBar.hubSectionProject": "Test target",

  "hub.stage.dev": "Local development",
  "hub.stage.test": "Integration (default)",
  "hub.stage.stg": "$(warning) Requires confirmation",
  "hub.stage.prod": "$(warning) Requires confirmation · production",
  "hub.mode.debug": "1 thread · sequential",
  "hub.mode.parallel": "4 threads · parallel collections",
  "hub.mode.ci": "8 threads · parallel assemblies",

  "badge.running": "BDD Pilot test run in progress",
  "badge.debugging": "BDD Pilot debug session in progress",

  "dashboard.panelTitle": "BDD Pilot Dashboard",
  "dashboard.title": "BDD Pilot Dashboard",
  "dashboard.subtitle": "Run history and quality signals for your BDD test suite.",
  "dashboard.statRuns": "runs",
  "dashboard.statPassed": "passed (all runs)",
  "dashboard.statFailed": "failed (all runs)",
  "dashboard.recentRuns": "Recent runs",
  "dashboard.noRuns": "No runs recorded yet.",
  "dashboard.emptyHint":
    "Run tests from the <strong>BDD Pilot</strong> sidebar (play icon on a feature or scenario). History is stored per workspace — not related to execution profiles.",
  "dashboard.flakyTitle": "Flaky scenarios (recent window)",
  "dashboard.flakyEmpty": "Not enough data yet (need 2+ runs per scenario).",
  "dashboard.colWhen": "When",
  "dashboard.colEnv": "Env",
  "dashboard.colPass": "Pass",
  "dashboard.colFail": "Fail",
  "dashboard.colSkip": "Skip",
  "dashboard.colDuration": "Duration",
  "dashboard.colScenario": "Scenario",
  "dashboard.colFailureRate": "Failure rate",
  "dashboard.lastKnownTitle": "Last known results",
  "dashboard.lastKnownEmpty": "No results yet",
  "dashboard.lastKnownFromLiveSession": "From current session outcomes",
  "dashboard.lastKnownFromHistory": "From last recorded run ({when})",
  "dashboard.lastKnownFromRehydrate": "Restored from TestResults (not a new test run)",
  "dashboard.lastRunDuration": "Last run duration: {duration}",
  "dashboard.rehydrateNotice":
    "Outcomes restored from TestResults/{file} — not a new test run.",
  "dashboard.colScope": "Scope",
  "dashboard.statusCanceled": "canceled",
  "dashboard.statCanceled": "canceled",
  "dashboard.scopeCanceled": "— (canceled)",
  "dashboard.scopeAllTests": "All tests",
  "dashboard.actionsTitle": "Actions",
  "dashboard.actionShowOutput": "Show Output",
  "dashboard.actionRerunFailed": "Re-run Failed",
  "dashboard.actionCopyForAi": "Copy for AI",
  "dashboard.actionsTarget": "Last failed run · {stage}/{mode} · {failed} failed · {when}",
  "dashboard.actionRerunDisabled": "No failed-test filter available",
  "dashboard.actionCopyDisabledHistory":
    "Available after a run in this session (output not stored in history)",

  "tree.summaryEmpty": "Run tests from the tree to see results.",
  "tree.emptyNoProject": "Select a BDD test project to begin.",
  "tree.emptyNoFeatures": "No .feature files found in this project.",
  "tree.emptySearchNoMatch": "No scenarios match the current filter.",
  "tree.guideNoProject.title": "No test project selected",
  "tree.guideNoProject.subtitle": "Click to choose a .csproj or solution",
  "tree.guideNoFeatures.title": "BDD features not found",
  "tree.guideNoFeatures.subtitle": "Add Reqnroll/SpecFlow .feature files to run tests here",
  "tree.guideNoFeatures.tooltip":
    "BDD Pilot runs **Reqnroll/SpecFlow** scenarios from `.feature` files — not plain xUnit unit tests.\n\nAdd a `Features/` folder with Gherkin scenarios, or open a repo that already has them.\n\n[Learn more](https://github.com/AngHelll/bdd-pilot#quick-start)",
  "tree.guideSearch.title": "No matching scenarios",
  "tree.guideSearch.subtitle": "Clear or change the search filter",
  "tree.guideSearch.tooltip":
    "The active tree filter hid every scenario. Use **Search Tests** to change or clear the filter.",
  "tree.summaryRunning": "Running…",
  "tree.summaryRehydrate": "Restored (not a new run)",
  "tree.pilotSummaryHint": "Click for run summary and history",
  "tree.outlineRowCountOne": "1 row",
  "tree.outlineRowCount": "{count} rows",

  "codeLens.run": "$(play) Run",
  "codeLens.debug": "$(debug) Debug",
  "codeLens.runRow": "$(play) Run row",
  "codeLens.debugRow": "$(debug) Debug row",
  "codeLens.runAllRows": "$(play) Run all rows",
  "codeLens.debugAllRows": "$(debug) Debug all rows",

  "toast.dashboardEmpty":
    "Dashboard opened. Run tests from the BDD Pilot tree to record history here.",
  "toast.noActiveRun": "No test run is currently active.",
  "toast.noFailedRerun": "No failed tests from the last run to re-run.",
  "toast.profileSaved": 'Saved profile "{name}".',
  "toast.profileRemoved": 'Removed profile "{name}".',
  "toast.noProfilesRun":
    "No saved execution profiles. Use Command Palette → 'BDD Pilot: Save Execution Profile'. For run history and flaky stats, use the graph icon (Show Dashboard).",
  "toast.noProfilesManage": "No saved profiles.",
  "toast.treeGroupByTag": "BDD Pilot tree: group by @tag.",
  "toast.treeGroupByDomain": "BDD Pilot tree: group by domain.",
  "toast.runInProgress": "A test run is already in progress.",
  "toast.debugWhileRunning": "Stop the current run before starting a debug session.",
  "toast.debugAlreadyActive": "A BDD Pilot debug session is already active.",
  "toast.debugNoTrx":
    "Debug session ended. No test results file was produced — check the terminal.",
  "toast.runCanceledPartial": "Run canceled — {completed}/{expected} tests finished.",
  "toast.projectNotFound":
    "BDD Pilot: could not locate the .NET test project. Use 'Select Test Project' or set 'bddPilot.projectPath'.",
  "toast.noProjectsFound":
    "No .NET test projects found. Add .feature files and a .csproj, or set bddPilot.projectPath.",
  "toast.multiProjectPrompt": "BDD Pilot found multiple test projects. Select which one to use.",
  "toast.noFailureContext": "No failed run to copy. Run tests first and wait for failures.",
  "toast.failureContextCopied": "Failure context copied to clipboard.",
  "toast.failureContextProdWarning":
    "This context may include staging or production environment details. Review before sharing with external AI.",
  "toast.runSummary": "{failed} failed, {passed} passed, {skipped} skipped ({total} total)",
  "toast.runSummaryFailures": "{failed} failed, {passed} passed ({total} total)",
  "toast.runInfraFallback":
    "The test run did not complete successfully. Check the BDD Pilot output for details.",

  "prompt.searchFilter": "Filter by name, tag (@Smoke), or path…",
  "prompt.searchClear": "Leave empty to clear the filter",
  "prompt.selectStage": "Current: {current}. Select environment (STAGE)",
  "prompt.selectMode": "Current: {current}. Select parallelism mode",
  "prompt.profileName": "Profile name",
  "prompt.profileFilter": "Filter expression",
  "prompt.profileFilterExample": "Category=Smoke or FullyQualifiedName~LoginFeature",
  "prompt.selectProfileRun": "Select an execution profile",
  "prompt.selectProfileDelete": "Select a profile to delete",
  "prompt.selectProject": "Select test project or solution for BDD Pilot",

  "progress.running": "Running tests ({stage}/{mode})",
  "progress.debugging": "Debugging tests ({stage})",
  "progress.starting": "Starting…",
  "progress.doneCount": "{count} done",

  "envGuard.prodConfirm":
    "You are about to run tests against PRODUCTION. This may affect live data and trigger external reporting. Continue?",
  "envGuard.stageConfirm":
    "You are about to run tests against '{stage}', which reports to X-Ray. Continue?",

  "action.run": "Run",
  "action.debug": "Debug",
  "action.selectProject": "Select Project",
  "action.showOutput": "Show Output",
  "action.copyForAi": "Copy for AI",
  "action.copyAnyway": "Copy anyway",
  "action.rerunFailed": "Re-run Failed",

  "bindingGate.skipped": "Binding gate skipped: {reason}",
  "bindingGate.skipReason.notInstalled":
    "BDD Guardian not installed (install anghelll.bdd-guardian v0.8.3+ to enable pre-run binding checks)",
  "bindingGate.skipReason.disabled": "BDD Guardian is disabled in this workspace",
  "bindingGate.skipReason.notReady": "BDD Guardian index is not ready yet",
  "bindingGate.skipReason.unsupported":
    "BDD Guardian does not expose resolveStep (upgrade to v0.8.3+)",
  "bindingGate.skipReason.error": "BDD Guardian could not be activated",
  "bindingGate.modalSummary":
    "{total} binding issue(s) in run scope ({unbound} unbound, {ambiguous} ambiguous).",
  "bindingGate.modalMore": "+{count} more",
  "bindingGate.issueUnbound": "[unbound]",
  "bindingGate.issueAmbiguous": "[ambiguous]",
  "bindingGate.runAnyway": "Run anyway",
  "bindingGate.cancel": "Cancel",
  "bindingGate.ok": "OK",

  "tooltip.errorLine": "Error: {snippet}",
  "tooltip.skipReasonLine": "Skip: {reason}",
  "log.rehydrateRestored":
    "Restored test outcomes from TestResults/{file} ({passed} passed, {failed} failed, {skipped} skipped, {total} total).",
  "log.envLoaded":
    "[bdd-pilot] Loaded environment from {files} ({count} variables, values hidden).",
  "log.envMissing":
    "[bdd-pilot] No config/.env.{stage} found. Tests will rely on the current process environment.",

  "diagnostic.output.header": "\n[bdd-pilot] Diagnostics:",
  "diagnostic.output.summaryLine":
    "[bdd-pilot] Diagnostics: {code} — {title} (+{more} more). Open Output for full log.",
  "diagnostic.output.summaryLineSingle":
    "[bdd-pilot] Diagnostics: {code} — {title}. Open Output for full log.",
  "diagnostic.output.hintPrefix": "→",

  "diagnostic.breakdown.pending": "{n} pending/missing step definition(s)",
  "diagnostic.breakdown.testData": "{n} test data / fixture setup failure(s)",
  "diagnostic.breakdown.nullRef": "{n} NullReferenceException (often failed setup/Given steps)",
  "diagnostic.breakdown.apiHttp": "{n} API/HTTP error(s)",
  "diagnostic.breakdown.cloudCreds": "{n} cloud credential failure(s)",
  "diagnostic.breakdown.ambiguous": "{n} ambiguous step definition(s)",

  "diagnostic.DOTNET_NOT_FOUND.title": ".NET SDK is not installed or not on PATH.",
  "diagnostic.DOTNET_NOT_FOUND.hint":
    "Install the .NET SDK and ensure `dotnet` is available in your shell PATH.",
  "diagnostic.SDK_NOT_FOUND.title": "Required .NET SDK {version} is not installed.",
  "diagnostic.SDK_NOT_FOUND.titleFallback": "Required .NET SDK version is not installed.",
  "diagnostic.SDK_NOT_FOUND.hint":
    "Install the SDK version from global.json, or update global.json to match an installed SDK.",
  "diagnostic.FEED_AUTH.title": "A NuGet feed rejected the request (unauthorized).",
  "diagnostic.FEED_AUTH.hint":
    "Provide valid credentials for the private feed (PAT env var or credential provider). Do not commit secrets.",
  "diagnostic.PACKAGE_NOT_FOUND.title": "Package not found: {pkg}",
  "diagnostic.PACKAGE_NOT_FOUND.titleFallback": "A required NuGet package was not found.",
  "diagnostic.PACKAGE_NOT_FOUND.hint":
    "Check package version in the .csproj and that your feed credentials can access the private feed.",
  "diagnostic.VULNERABILITY_AS_ERROR.title": "Vulnerability policy blocked package: {pkg}",
  "diagnostic.VULNERABILITY_AS_ERROR.titleFallback": "A package vulnerability is treated as an error.",
  "diagnostic.VULNERABILITY_AS_ERROR.hint":
    "Upgrade the affected package or adjust NuGet audit settings for local development.",
  "diagnostic.NO_TESTS_MATCHED.title": "No tests matched the current filter.",
  "diagnostic.NO_TESTS_MATCHED.hint":
    "Clear filters or pick a scenario/feature that exists in the test assembly.",
  "diagnostic.PENDING_STEPS.title": "Tests have pending or missing step definitions.",
  "diagnostic.PENDING_STEPS.titleMany": "{n} tests have pending or missing step definitions.",
  "diagnostic.PENDING_STEPS.hint":
    "Implement the missing step bindings in Steps/ or mark scenarios @ignore until steps exist.",
  "diagnostic.AMBIGUOUS_STEPS.title": "Reqnroll found duplicate step definitions for the same step text.",
  "diagnostic.AMBIGUOUS_STEPS.hint":
    "Remove or rename duplicate [Given]/[When]/[Then] bindings so each step text maps to one method.",
  "diagnostic.TEST_DATA_SETUP.title": "Test data or fixture setup failed.",
  "diagnostic.TEST_DATA_SETUP.titleMany": "{n} failures due to test data or fixture setup.",
  "diagnostic.TEST_DATA_SETUP.hint":
    "Check test data files, database seeds, or Given/setup steps required by your project.",
  "diagnostic.AWS_CREDENTIALS.title": "Cloud credentials are invalid or expired.",
  "diagnostic.AWS_CREDENTIALS.hint":
    "Refresh cloud credentials in your environment file and verify the target account/region.",
  "diagnostic.XRAY_CONFIG.title": "X-Ray integration is not configured.",
  "diagnostic.XRAY_CONFIG.hint":
    "Set X-Ray client credentials in your environment file, or skip @XRay scenarios locally.",
  "diagnostic.API_HTTP_ERRORS.title": "An API call failed during tests{statuses}.",
  "diagnostic.API_HTTP_ERRORS.titleMany": "{n} API calls failed during tests{statuses}.",
  "diagnostic.API_HTTP_ERRORS.detailNoContracts":
    "Some failures: authenticated user has no contracts in test environment.",
  "diagnostic.API_HTTP_ERRORS.hint":
    "Verify test users, endpoints in your environment file, and that the target environment has the expected data.",
  "diagnostic.PLAYWRIGHT_DRIVER_INCOMPLETE.title":
    "Playwright driver bundle is incomplete in the test output folder.",
  "diagnostic.PLAYWRIGHT_DRIVER_INCOMPLETE.hint":
    "Run `dotnet build` then `pwsh bin/Debug/net8.0/playwright.ps1 install` (or rebuild so Playwright copies driver assets).",
  "diagnostic.PLAYWRIGHT_RUNTIME.title": "Playwright failed to launch or connect to the browser.",
  "diagnostic.PLAYWRIGHT_RUNTIME.hint":
    "Run `playwright install` for the browsers you need, then retry. Check for sandbox/CI restrictions.",
  "diagnostic.TEST_HOST_CRASH.title": "The .NET test host process crashed or aborted.",
  "diagnostic.TEST_HOST_CRASH.hint":
    "Inspect the stack trace above for OOM, native crashes, or unhandled exceptions. Try `dotnet test --blame-crash` or run one scenario to isolate.",
  "diagnostic.PORT_IN_USE.title": "Port {port} is already in use.",
  "diagnostic.PORT_IN_USE.titleFallback": "A required network port is already in use.",
  "diagnostic.PORT_IN_USE.hint":
    "Stop the process holding the port (`lsof -i :PORT` on macOS) or change the test app's URL in .env / launchSettings.",
  "diagnostic.TEST_TIMEOUT.title": "Test execution timed out after {duration}.",
  "diagnostic.TEST_TIMEOUT.titleFallback": "Test execution timed out.",
  "diagnostic.TEST_TIMEOUT.hint":
    "Increase xUnit/Reqnroll timeout settings, or debug the hanging step (API wait, browser, deadlock). Run a single scenario to find the blocker.",
  "diagnostic.TEST_RUN_FAILED.title":
    "Test run finished with {failed} failure(s) ({passed} passed, {skipped} skipped).",
  "diagnostic.TEST_RUN_FAILED.hint":
    "Review failure categories above; fix step definitions, test data, env vars, or API/environment issues first.",

  "quickPick.solution": "Solution",

  "outcome.passed": "passed",
  "outcome.failed": "failed",
  "outcome.skipped": "skipped",
  "skip.runner": "skipped by runner",
  "skip.notInTrx": "not in results",
  "skip.canceled": "canceled before completion",
  "skip.unknown": "unknown result",
  "rollup.failed": "{count} failed",
  "rollup.passed": "{count} passed",
  "rollup.skipped": "{count} skipped",
  "rollup.separator": " · ",
} as const;

const ES: Record<keyof typeof EN, string> = {
  "statusBar.stageTooltip": "BDD Pilot: seleccionar entorno",
  "statusBar.modeTooltip": "BDD Pilot: seleccionar modo de paralelismo",
  "statusBar.projectTooltip": "BDD Pilot: seleccionar proyecto o solución de tests",
  "statusBar.solutionSlowHint":
    "Ejecutar contra la solución completa puede ser más lento. Selecciona el .csproj de tests para runs más rápidos.",
  "statusBar.projectMissingTooltip":
    "BDD Pilot: seleccionar proyecto — varios detectados o ninguno",
  "statusBar.stageLabel": "STAGE",
  "statusBar.modeLabel": "modo",
  "statusBar.projectNotSet": "proyecto: (sin asignar)",
  "statusBar.running": "Ejecutando…",
  "statusBar.runningTooltip": "Ejecución BDD Pilot en curso — clic para cancelar",
  "statusBar.debugRunningTooltip":
    "Depuración BDD Pilot en curso — detén desde la barra Debug",
  "statusBar.compactProjectNotSet": "(sin asignar)",
  "statusBar.hubTooltipTitle": "BDD Pilot — configuración de ejecución",
  "statusBar.hubTooltipStage": "Entorno (STAGE)",
  "statusBar.hubTooltipMode": "Paralelismo",
  "statusBar.hubTooltipProject": "Objetivo de tests",
  "statusBar.hubTooltipAction": "Clic para cambiar configuración",
  "statusBar.hubRunningHint":
    "Ejecución en curso — cancelar desde toolbar lateral o paleta",
  "statusBar.hubSectionStage": "Entorno (STAGE)",
  "statusBar.hubSectionMode": "Paralelismo",
  "statusBar.hubSectionProject": "Objetivo de tests",

  "hub.stage.dev": "Desarrollo local",
  "hub.stage.test": "Integración (por defecto)",
  "hub.stage.stg": "$(warning) Requiere confirmación",
  "hub.stage.prod": "$(warning) Requiere confirmación · producción",
  "hub.mode.debug": "1 hilo · secuencial",
  "hub.mode.parallel": "4 hilos · colecciones en paralelo",
  "hub.mode.ci": "8 hilos · ensamblados en paralelo",

  "badge.running": "Ejecución BDD Pilot en curso",
  "badge.debugging": "Depuración BDD Pilot en curso",

  "dashboard.panelTitle": "Panel BDD Pilot",
  "dashboard.title": "Panel BDD Pilot",
  "dashboard.subtitle": "Historial de ejecuciones y señales de calidad de tu suite BDD.",
  "dashboard.statRuns": "ejecuciones",
  "dashboard.statPassed": "correctos (total)",
  "dashboard.statFailed": "fallidos (total)",
  "dashboard.recentRuns": "Ejecuciones recientes",
  "dashboard.noRuns": "Aún no hay ejecuciones registradas.",
  "dashboard.emptyHint":
    "Ejecuta tests desde la barra lateral <strong>BDD Pilot</strong> (icono play en feature o escenario). El historial es por workspace — no está ligado a perfiles de ejecución.",
  "dashboard.flakyTitle": "Escenarios inestables (ventana reciente)",
  "dashboard.flakyEmpty": "Datos insuficientes (se necesitan 2+ ejecuciones por escenario).",
  "dashboard.colWhen": "Cuándo",
  "dashboard.colEnv": "Entorno",
  "dashboard.colPass": "OK",
  "dashboard.colFail": "Fallo",
  "dashboard.colSkip": "Omit.",
  "dashboard.colDuration": "Duración",
  "dashboard.colScenario": "Escenario",
  "dashboard.colFailureRate": "Tasa de fallo",
  "dashboard.lastKnownTitle": "Último estado conocido",
  "dashboard.lastKnownEmpty": "Sin resultados aún",
  "dashboard.lastKnownFromLiveSession": "Desde resultados de la sesión actual",
  "dashboard.lastKnownFromHistory": "Desde la última ejecución registrada ({when})",
  "dashboard.lastKnownFromRehydrate": "Restaurado desde TestResults (no es una nueva ejecución)",
  "dashboard.lastRunDuration": "Duración última ejecución: {duration}",
  "dashboard.rehydrateNotice":
    "Resultados restaurados desde TestResults/{file} — no es una nueva ejecución.",
  "dashboard.colScope": "Ámbito",
  "dashboard.statusCanceled": "cancelada",
  "dashboard.statCanceled": "canceladas",
  "dashboard.scopeCanceled": "— (cancelada)",
  "dashboard.scopeAllTests": "Todos los tests",
  "dashboard.actionsTitle": "Acciones",
  "dashboard.actionShowOutput": "Mostrar salida",
  "dashboard.actionRerunFailed": "Reejecutar fallidos",
  "dashboard.actionCopyForAi": "Copiar para IA",
  "dashboard.actionsTarget": "Última ejecución fallida · {stage}/{mode} · {failed} fallidos · {when}",
  "dashboard.actionRerunDisabled": "No hay filtro de tests fallidos disponible",
  "dashboard.actionCopyDisabledHistory":
    "Disponible tras una ejecución en esta sesión (la salida no se guarda en el historial)",

  "tree.summaryEmpty": "Ejecuta tests en el árbol para ver resultados.",
  "tree.emptyNoProject": "Selecciona un proyecto BDD para empezar.",
  "tree.emptyNoFeatures": "No se encontraron archivos .feature en este proyecto.",
  "tree.emptySearchNoMatch": "Ningún escenario coincide con el filtro actual.",
  "tree.guideNoProject.title": "Sin proyecto de tests seleccionado",
  "tree.guideNoProject.subtitle": "Clic para elegir un .csproj o solución",
  "tree.guideNoFeatures.title": "No se encontraron features BDD",
  "tree.guideNoFeatures.subtitle": "Añade archivos .feature Reqnroll/SpecFlow para ejecutar tests aquí",
  "tree.guideNoFeatures.tooltip":
    "BDD Pilot ejecuta escenarios **Reqnroll/SpecFlow** desde archivos `.feature` — no tests xUnit unitarios simples.\n\nAñade una carpeta `Features/` con escenarios Gherkin, o abre un repo que ya los tenga.\n\n[Más información](https://github.com/AngHelll/bdd-pilot#quick-start)",
  "tree.guideSearch.title": "Ningún escenario coincide",
  "tree.guideSearch.subtitle": "Borra o cambia el filtro de búsqueda",
  "tree.guideSearch.tooltip":
    "El filtro activo ocultó todos los escenarios. Usa **Buscar tests** para cambiar o borrar el filtro.",
  "tree.summaryRunning": "Ejecutando…",
  "tree.summaryRehydrate": "Restaurado (no es una nueva ejecución)",
  "tree.pilotSummaryHint": "Clic para ver resumen e historial",
  "tree.outlineRowCountOne": "1 fila",
  "tree.outlineRowCount": "{count} filas",

  "codeLens.run": "$(play) Ejecutar",
  "codeLens.debug": "$(debug) Depurar",
  "codeLens.runRow": "$(play) Ejecutar fila",
  "codeLens.debugRow": "$(debug) Depurar fila",
  "codeLens.runAllRows": "$(play) Ejecutar todas las filas",
  "codeLens.debugAllRows": "$(debug) Depurar todas las filas",

  "toast.dashboardEmpty":
    "Panel abierto. Ejecuta tests desde el árbol BDD Pilot para registrar historial aquí.",
  "toast.noActiveRun": "No hay ninguna ejecución de tests activa.",
  "toast.noFailedRerun": "No hay tests fallidos en la última ejecución para reintentar.",
  "toast.profileSaved": 'Perfil "{name}" guardado.',
  "toast.profileRemoved": 'Perfil "{name}" eliminado.',
  "toast.noProfilesRun":
    "No hay perfiles de ejecución guardados. Paleta de comandos → 'BDD Pilot: Save Execution Profile'. Para historial e inestabilidad, usa el icono de gráfica (Show Dashboard).",
  "toast.noProfilesManage": "No hay perfiles guardados.",
  "toast.treeGroupByTag": "Árbol BDD Pilot: agrupado por @tag.",
  "toast.treeGroupByDomain": "Árbol BDD Pilot: agrupado por dominio.",
  "toast.runInProgress": "Ya hay una ejecución de tests en curso.",
  "toast.debugWhileRunning": "Detén la ejecución actual antes de depurar.",
  "toast.debugAlreadyActive": "Ya hay una sesión de depuración BDD Pilot activa.",
  "toast.debugNoTrx":
    "Sesión de depuración finalizada. No se generó archivo de resultados — revisa la terminal.",
  "toast.runCanceledPartial": "Ejecución cancelada — {completed}/{expected} tests completados.",
  "toast.projectNotFound":
    "BDD Pilot: no se encontró el proyecto .NET de tests. Usa 'Select Test Project' o configura 'bddPilot.projectPath'.",
  "toast.noProjectsFound":
    "No se encontraron proyectos .NET de tests. Añade archivos .feature y un .csproj, o configura bddPilot.projectPath.",
  "toast.multiProjectPrompt": "BDD Pilot encontró varios proyectos de tests. Elige cuál usar.",
  "toast.noFailureContext":
    "No hay ejecución fallida para copiar. Ejecuta tests y espera a que fallen.",
  "toast.failureContextCopied": "Contexto de fallo copiado al portapapeles.",
  "toast.failureContextProdWarning":
    "Este contexto puede incluir detalles de entorno staging o producción. Revísalo antes de compartirlo con IA externa.",
  "toast.runSummary": "{failed} fallidos, {passed} correctos, {skipped} omitidos ({total} total)",
  "toast.runSummaryFailures": "{failed} fallidos, {passed} correctos ({total} total)",
  "toast.runInfraFallback":
    "La ejecución no terminó correctamente. Revisa la salida de BDD Pilot para más detalles.",

  "prompt.searchFilter": "Filtrar por nombre, tag (@Smoke) o ruta…",
  "prompt.searchClear": "Deja vacío para quitar el filtro",
  "prompt.selectStage": "Actual: {current}. Selecciona entorno (STAGE)",
  "prompt.selectMode": "Actual: {current}. Selecciona modo de paralelismo",
  "prompt.profileName": "Nombre del perfil",
  "prompt.profileFilter": "Expresión de filtro",
  "prompt.profileFilterExample": "Category=Smoke o FullyQualifiedName~LoginFeature",
  "prompt.selectProfileRun": "Selecciona un perfil de ejecución",
  "prompt.selectProfileDelete": "Selecciona un perfil para eliminar",
  "prompt.selectProject": "Selecciona proyecto o solución de tests para BDD Pilot",

  "progress.running": "Ejecutando tests ({stage}/{mode})",
  "progress.debugging": "Depurando tests ({stage})",
  "progress.starting": "Iniciando…",
  "progress.doneCount": "{count} listos",

  "envGuard.prodConfirm":
    "Vas a ejecutar tests contra PRODUCCIÓN. Puede afectar datos reales y reportes externos. ¿Continuar?",
  "envGuard.stageConfirm":
    "Vas a ejecutar tests contra '{stage}', que reporta a X-Ray. ¿Continuar?",

  "action.run": "Ejecutar",
  "action.debug": "Depurar",
  "action.selectProject": "Seleccionar proyecto",
  "action.showOutput": "Mostrar salida",
  "action.copyForAi": "Copiar para IA",
  "action.copyAnyway": "Copiar de todos modos",
  "action.rerunFailed": "Reejecutar fallidos",

  "bindingGate.skipped": "Compuerta de bindings omitida: {reason}",
  "bindingGate.skipReason.notInstalled":
    "BDD Guardian no está instalado (instala anghelll.bdd-guardian v0.8.3+ para comprobaciones pre-run)",
  "bindingGate.skipReason.disabled": "BDD Guardian está deshabilitado en este workspace",
  "bindingGate.skipReason.notReady": "El índice de BDD Guardian aún no está listo",
  "bindingGate.skipReason.unsupported":
    "BDD Guardian no expone resolveStep (actualiza a v0.8.3+)",
  "bindingGate.skipReason.error": "No se pudo activar BDD Guardian",
  "bindingGate.modalSummary":
    "{total} problema(s) de binding en el scope ({unbound} unbound, {ambiguous} ambiguous).",
  "bindingGate.modalMore": "+{count} más",
  "bindingGate.issueUnbound": "[unbound]",
  "bindingGate.issueAmbiguous": "[ambiguous]",
  "bindingGate.runAnyway": "Ejecutar igual",
  "bindingGate.cancel": "Cancelar",
  "bindingGate.ok": "Aceptar",

  "tooltip.errorLine": "Error: {snippet}",
  "tooltip.skipReasonLine": "Omitido: {reason}",
  "log.rehydrateRestored":
    "Resultados restaurados desde TestResults/{file} ({passed} correctos, {failed} fallidos, {skipped} omitidos, {total} total).",
  "log.envLoaded":
    "[bdd-pilot] Entorno cargado desde {files} ({count} variables, valores ocultos).",
  "log.envMissing":
    "[bdd-pilot] No se encontró config/.env.{stage}. Los tests usarán el entorno del proceso actual.",

  "diagnostic.output.header": "\n[bdd-pilot] Diagnósticos:",
  "diagnostic.output.summaryLine":
    "[bdd-pilot] Diagnósticos: {code} — {title} (+{more} más). Abre Output para el log completo.",
  "diagnostic.output.summaryLineSingle":
    "[bdd-pilot] Diagnósticos: {code} — {title}. Abre Output para el log completo.",
  "diagnostic.output.hintPrefix": "→",

  "diagnostic.breakdown.pending": "{n} step(s) pendiente(s) o sin definición",
  "diagnostic.breakdown.testData": "{n} fallo(s) de datos de prueba / fixture",
  "diagnostic.breakdown.nullRef": "{n} NullReferenceException (a menudo setup/Given fallido)",
  "diagnostic.breakdown.apiHttp": "{n} error(es) API/HTTP",
  "diagnostic.breakdown.cloudCreds": "{n} fallo(s) de credenciales cloud",
  "diagnostic.breakdown.ambiguous": "{n} definición(es) de step ambigua(s)",

  "diagnostic.DOTNET_NOT_FOUND.title": "El SDK de .NET no está instalado o no está en PATH.",
  "diagnostic.DOTNET_NOT_FOUND.hint":
    "Instala el SDK de .NET y asegúrate de que `dotnet` esté disponible en el PATH del shell.",
  "diagnostic.SDK_NOT_FOUND.title": "El SDK de .NET {version} requerido no está instalado.",
  "diagnostic.SDK_NOT_FOUND.titleFallback": "La versión requerida del SDK de .NET no está instalada.",
  "diagnostic.SDK_NOT_FOUND.hint":
    "Instala la versión de global.json o actualiza global.json para coincidir con un SDK instalado.",
  "diagnostic.FEED_AUTH.title": "Un feed NuGet rechazó la solicitud (no autorizado).",
  "diagnostic.FEED_AUTH.hint":
    "Proporciona credenciales válidas para el feed privado (PAT o credential provider). No subas secretos.",
  "diagnostic.PACKAGE_NOT_FOUND.title": "Paquete no encontrado: {pkg}",
  "diagnostic.PACKAGE_NOT_FOUND.titleFallback": "No se encontró un paquete NuGet requerido.",
  "diagnostic.PACKAGE_NOT_FOUND.hint":
    "Revisa la versión en el .csproj y que tus credenciales puedan acceder al feed privado.",
  "diagnostic.VULNERABILITY_AS_ERROR.title": "Política de vulnerabilidades bloqueó el paquete: {pkg}",
  "diagnostic.VULNERABILITY_AS_ERROR.titleFallback": "Una vulnerabilidad de paquete se trata como error.",
  "diagnostic.VULNERABILITY_AS_ERROR.hint":
    "Actualiza el paquete afectado o ajusta la auditoría NuGet para desarrollo local.",
  "diagnostic.NO_TESTS_MATCHED.title": "Ningún test coincidió con el filtro actual.",
  "diagnostic.NO_TESTS_MATCHED.hint":
    "Limpia filtros o elige un escenario/feature que exista en el ensamblado de tests.",
  "diagnostic.PENDING_STEPS.title": "Hay steps pendientes o sin definición.",
  "diagnostic.PENDING_STEPS.titleMany": "{n} tests con steps pendientes o sin definición.",
  "diagnostic.PENDING_STEPS.hint":
    "Implementa los bindings faltantes en Steps/ o marca escenarios @ignore hasta que existan.",
  "diagnostic.AMBIGUOUS_STEPS.title": "Reqnroll encontró definiciones duplicadas para el mismo step.",
  "diagnostic.AMBIGUOUS_STEPS.hint":
    "Elimina o renombra bindings [Given]/[When]/[Then] duplicados para que cada step tenga un solo método.",
  "diagnostic.TEST_DATA_SETUP.title": "Falló la configuración de datos de prueba o fixture.",
  "diagnostic.TEST_DATA_SETUP.titleMany": "{n} fallos por datos de prueba o fixture.",
  "diagnostic.TEST_DATA_SETUP.hint":
    "Revisa archivos de datos, seeds de base de datos o steps Given/setup requeridos por tu proyecto.",
  "diagnostic.AWS_CREDENTIALS.title": "Las credenciales cloud son inválidas o expiraron.",
  "diagnostic.AWS_CREDENTIALS.hint":
    "Renueva credenciales cloud en tu archivo de entorno y verifica cuenta/región.",
  "diagnostic.XRAY_CONFIG.title": "La integración X-Ray no está configurada.",
  "diagnostic.XRAY_CONFIG.hint":
    "Configura credenciales X-Ray en tu archivo de entorno, u omite escenarios @XRay en local.",
  "diagnostic.API_HTTP_ERRORS.title": "Una llamada API falló durante los tests{statuses}.",
  "diagnostic.API_HTTP_ERRORS.titleMany": "{n} llamadas API fallaron durante los tests{statuses}.",
  "diagnostic.API_HTTP_ERRORS.detailNoContracts":
    "Algunos fallos: el usuario autenticado no tiene contratos en el entorno de prueba.",
  "diagnostic.API_HTTP_ERRORS.hint":
    "Verifica usuarios de prueba, endpoints en tu archivo de entorno y datos esperados en el entorno.",
  "diagnostic.PLAYWRIGHT_DRIVER_INCOMPLETE.title":
    "El bundle del driver de Playwright está incompleto en la carpeta de salida.",
  "diagnostic.PLAYWRIGHT_DRIVER_INCOMPLETE.hint":
    "Ejecuta `dotnet build` y luego `pwsh bin/Debug/net8.0/playwright.ps1 install` (o recompila para copiar assets).",
  "diagnostic.PLAYWRIGHT_RUNTIME.title": "Playwright no pudo lanzar o conectar con el navegador.",
  "diagnostic.PLAYWRIGHT_RUNTIME.hint":
    "Ejecuta `playwright install` para los navegadores necesarios y reintenta. Revisa restricciones sandbox/CI.",
  "diagnostic.TEST_HOST_CRASH.title": "El proceso host de tests de .NET falló o abortó.",
  "diagnostic.TEST_HOST_CRASH.hint":
    "Revisa el stack trace por OOM, crashes nativos o excepciones no controladas. Prueba `dotnet test --blame-crash` o un solo escenario.",
  "diagnostic.PORT_IN_USE.title": "El puerto {port} ya está en uso.",
  "diagnostic.PORT_IN_USE.titleFallback": "Un puerto de red requerido ya está en uso.",
  "diagnostic.PORT_IN_USE.hint":
    "Detén el proceso que usa el puerto (`lsof -i :PORT` en macOS) o cambia la URL en .env / launchSettings.",
  "diagnostic.TEST_TIMEOUT.title": "La ejecución de tests expiró tras {duration}.",
  "diagnostic.TEST_TIMEOUT.titleFallback": "La ejecución de tests expiró.",
  "diagnostic.TEST_TIMEOUT.hint":
    "Aumenta timeouts de xUnit/Reqnroll o depura el step bloqueado (API, navegador, deadlock). Ejecuta un escenario aislado.",
  "diagnostic.TEST_RUN_FAILED.title":
    "Ejecución terminada con {failed} fallo(s) ({passed} correctos, {skipped} omitidos).",
  "diagnostic.TEST_RUN_FAILED.hint":
    "Revisa las categorías de fallo arriba; corrige bindings, datos de prueba, variables de entorno o API/entorno primero.",

  "quickPick.solution": "Solución",

  "outcome.passed": "correcto",
  "outcome.failed": "fallido",
  "outcome.skipped": "omitido",
  "skip.runner": "omitido por el runner",
  "skip.notInTrx": "sin resultado",
  "skip.canceled": "cancelado antes de terminar",
  "skip.unknown": "resultado desconocido",
  "rollup.failed": "{count} fallidos",
  "rollup.passed": "{count} correctos",
  "rollup.skipped": "{count} omitidos",
  "rollup.separator": " · ",
};

export type MessageKey = keyof typeof EN;

const MESSAGES: Record<PilotLocale, Record<MessageKey, string>> = { en: EN, es: ES };

export function t(
  locale: PilotLocale,
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  let text = MESSAGES[locale][key] ?? MESSAGES.en[key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${name}\\}`, "g"), String(value));
    }
  }
  return text;
}

export function envGuardMessageKey(stage: string): "envGuard.prodConfirm" | "envGuard.stageConfirm" {
  return stage === "prod" ? "envGuard.prodConfirm" : "envGuard.stageConfirm";
}
