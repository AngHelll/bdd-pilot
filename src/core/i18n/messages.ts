import { PilotLocale } from "./locale";

const EN = {
  "statusBar.stageTooltip": "BDD Pilot: select environment",
  "statusBar.modeTooltip": "BDD Pilot: select parallelism mode",
  "statusBar.projectTooltip": "BDD Pilot: select test project or solution",
  "statusBar.projectMissingTooltip":
    "BDD Pilot: select test project — multiple or none detected",
  "statusBar.stageLabel": "STAGE",
  "statusBar.modeLabel": "mode",
  "statusBar.projectNotSet": "project: (not set)",
  "statusBar.running": "Running…",
  "statusBar.runningTooltip": "BDD Pilot test run in progress — click to cancel",
  "statusBar.debugRunningTooltip": "BDD Pilot debug session in progress — stop from the Debug toolbar",

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

  "tooltip.errorLine": "Error: {snippet}",
  "tooltip.skipReasonLine": "Skip: {reason}",
  "log.rehydrateRestored":
    "Restored test outcomes from TestResults/{file} ({passed} passed, {failed} failed, {skipped} skipped, {total} total).",

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
  "statusBar.projectMissingTooltip":
    "BDD Pilot: seleccionar proyecto — varios detectados o ninguno",
  "statusBar.stageLabel": "STAGE",
  "statusBar.modeLabel": "modo",
  "statusBar.projectNotSet": "proyecto: (sin asignar)",
  "statusBar.running": "Ejecutando…",
  "statusBar.runningTooltip": "Ejecución BDD Pilot en curso — clic para cancelar",
  "statusBar.debugRunningTooltip":
    "Depuración BDD Pilot en curso — detén desde la barra Debug",

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

  "tooltip.errorLine": "Error: {snippet}",
  "tooltip.skipReasonLine": "Omitido: {reason}",
  "log.rehydrateRestored":
    "Resultados restaurados desde TestResults/{file} ({passed} correctos, {failed} fallidos, {skipped} omitidos, {total} total).",

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
