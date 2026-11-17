/**
 * Opt-in lifecycle trace. Disabled until `startTraceSession`.
 * IDs and counters are diagnostic only. They must not gate execution,
 * matching, discovery, or cancellation.
 */

export const LIFECYCLE_TRACE_CONFIGURATION = "bddPilot.diagnostics.lifecycleTrace";

export type TraceSink = (line: string) => void;

export interface AbortTraceMeta {
  controllerId: string;
  operationId?: string;
  role?: string;
  parentControllerId?: string;
}

export interface LiveProcessInfo {
  resourceId: string;
  pid?: number;
  kind: string;
  operationId?: string;
  controllerId?: string;
}

export interface ResultTraceContext {
  operationId?: string;
  /** Wall clock captured for diagnostics. Not a proof of artifact ownership. */
  runStartedAt?: number;
}

const RESERVED = new Set(["sessionId", "sequence", "timestamp", "elapsedMs", "event"]);
const SENSITIVE_KEY =
  /password|secret|token|authorization|cookie|credential|connectionstring|apikey|privatekey|^env$|^environment$|^args$|^argv$|^stdout$|^stderr$|^output$|^command$|^commandline$|^filter$|^rawfilter$|^text$|^content$/i;

let enabled = false;
let sink: TraceSink | undefined;
let sessionSerial = 0;
let sessionId = "";
let sequence = 0;
let origin = 0;
const serials = new Map<string, number>();
const controllerIds = new WeakMap<AbortController, string>();
const signalMetaMap = new WeakMap<AbortSignal, AbortTraceMeta>();
const processBySignal = new WeakMap<AbortSignal, string>();
const liveProcesses = new Map<string, LiveProcessInfo>();
const presentationCounts = new Map<string, number>();
let enrichInflight = 0;
let ambientOperationId: string | undefined;
let resultContext: ResultTraceContext | undefined;
let discoveryCause = "refresh";

export function isTraceEnabled(): boolean {
  return enabled;
}

export function startTraceSession(nextSink: TraceSink): string {
  sessionSerial += 1;
  sessionId = `s${pad(sessionSerial)}`;
  sequence = 0;
  origin = monotonicNow();
  sink = nextSink;
  enabled = true;
  return sessionId;
}

export function stopTraceSession(): void {
  enabled = false;
  sink = undefined;
  ambientOperationId = undefined;
  resultContext = undefined;
}

/** Test isolation. Does not change production call sites. */
export function resetTraceState(): void {
  stopTraceSession();
  sessionSerial = 0;
  sessionId = "";
  sequence = 0;
  origin = 0;
  serials.clear();
  presentationCounts.clear();
  liveProcesses.clear();
  enrichInflight = 0;
  discoveryCause = "refresh";
}

export function trace(event: string, fields?: Record<string, unknown>): void {
  if (!enabled || !sink) {
    return;
  }
  try {
    sequence += 1;
    const body: Record<string, unknown> = {
      sessionId,
      sequence,
      timestamp: new Date().toISOString(),
      elapsedMs: Math.round(monotonicNow() - origin),
      event,
    };
    if (fields) {
      const clean = sanitizeFields(fields, 0);
      for (const [key, value] of Object.entries(clean)) {
        if (!RESERVED.has(key)) {
          body[key] = value;
        }
      }
    }
    sink(JSON.stringify(body));
  } catch {
    // A broken diagnostic channel must not fail the operation that emitted it.
  }
}

export function nextId(prefix: string): string {
  const n = (serials.get(prefix) ?? 0) + 1;
  serials.set(prefix, n);
  return `${prefix}${pad(n)}`;
}

export function trackController(
  controller: AbortController,
  meta: { operationId?: string; role?: string; parentControllerId?: string } = {},
): string {
  if (!enabled) {
    return "";
  }
  let controllerId = controllerIds.get(controller);
  if (!controllerId) {
    controllerId = nextId("c");
    controllerIds.set(controller, controllerId);
  }
  signalMetaMap.set(controller.signal, {
    controllerId,
    operationId: meta.operationId,
    role: meta.role,
    parentControllerId: meta.parentControllerId,
  });
  return controllerId;
}

export function controllerIdOf(controller: AbortController | undefined): string | undefined {
  if (!enabled || !controller) {
    return undefined;
  }
  return controllerIds.get(controller);
}

export function signalMeta(signal: AbortSignal | undefined): AbortTraceMeta | undefined {
  if (!enabled || !signal) {
    return undefined;
  }
  return signalMetaMap.get(signal);
}

export function setAmbientOperation(operationId: string | undefined): void {
  if (!enabled) {
    return;
  }
  ambientOperationId = operationId;
}

export function ambientOperation(): string | undefined {
  if (!enabled) {
    return undefined;
  }
  return ambientOperationId;
}

export function operationIdFrom(signal: AbortSignal | undefined): string | undefined {
  return signalMeta(signal)?.operationId ?? ambientOperation();
}

export function noteDiscoveryCause(cause: string): void {
  if (!enabled) {
    return;
  }
  discoveryCause = cause;
}

export function consumeDiscoveryCause(): string {
  const cause = discoveryCause;
  discoveryCause = "refresh";
  return cause;
}

export function notePresentation(kind: string): void {
  if (!enabled) {
    return;
  }
  presentationCounts.set(kind, (presentationCounts.get(kind) ?? 0) + 1);
}

export function flushPresentation(fields?: Record<string, unknown>): void {
  if (!enabled || presentationCounts.size === 0) {
    return;
  }
  const counts: Record<string, number> = {};
  for (const [kind, count] of presentationCounts) {
    counts[kind] = count;
  }
  presentationCounts.clear();
  trace("presentation.flush", { counts, ...fields });
}

export function beginEnrichObservation(): { overlapping: boolean } {
  if (!enabled) {
    return { overlapping: false };
  }
  const overlapping = enrichInflight > 0;
  enrichInflight += 1;
  return { overlapping };
}

export function endEnrichObservation(): void {
  if (!enabled) {
    return;
  }
  enrichInflight = Math.max(0, enrichInflight - 1);
}

export function noteProcessStart(
  signal: AbortSignal | undefined,
  info: { pid?: number; kind: string },
): string {
  if (!enabled) {
    return "";
  }
  const meta = signal ? signalMetaMap.get(signal) : undefined;
  const resourceId = nextId("p");
  const row: LiveProcessInfo = {
    resourceId,
    pid: typeof info.pid === "number" ? info.pid : undefined,
    kind: info.kind,
    operationId: meta?.operationId,
    controllerId: meta?.controllerId,
  };
  liveProcesses.set(resourceId, row);
  if (signal) {
    processBySignal.set(signal, resourceId);
  }
  trace("process.started", { ...row });
  return resourceId;
}

/** Observed child `close`. This is the only event that means the process ended. */
export function noteProcessExit(
  signal: AbortSignal | undefined,
  info: { exitCode: number | null; forced?: boolean; osSignal?: NodeJS.Signals | null },
): void {
  if (!enabled) {
    return;
  }
  const meta = signal ? signalMetaMap.get(signal) : undefined;
  const resourceId = signal ? processBySignal.get(signal) : undefined;
  const known = resourceId ? liveProcesses.get(resourceId) : undefined;
  if (resourceId) {
    liveProcesses.delete(resourceId);
  }
  trace("process.exited", {
    resourceId,
    pid: known?.pid,
    kind: known?.kind,
    operationId: meta?.operationId,
    controllerId: meta?.controllerId,
    exitCode: info.exitCode,
    osSignal: info.osSignal ?? undefined,
    forced: info.forced === true,
    signalAborted: signal?.aborted === true,
  });
}

/** Watchdog gave up or deactivate ran before `close`. The process is not known to have exited. */
export function noteProcessUnobserved(signal: AbortSignal | undefined, reason: string): void {
  if (!enabled) {
    return;
  }
  const meta = signal ? signalMetaMap.get(signal) : undefined;
  const resourceId = signal ? processBySignal.get(signal) : undefined;
  const known = resourceId ? liveProcesses.get(resourceId) : undefined;
  trace("process.exit.unobserved", {
    reason,
    resourceId,
    pid: known?.pid,
    kind: known?.kind,
    operationId: meta?.operationId,
    controllerId: meta?.controllerId,
    signalAborted: signal?.aborted === true,
  });
}

export function liveProcessSnapshot(): LiveProcessInfo[] {
  if (!enabled) {
    return [];
  }
  return [...liveProcesses.values()];
}

export function withResultContext<T>(context: ResultTraceContext, fn: () => T): T {
  if (!enabled) {
    return fn();
  }
  const previous = resultContext;
  resultContext = context;
  try {
    return fn();
  } finally {
    resultContext = previous;
  }
}

export function currentResultContext(): ResultTraceContext | undefined {
  if (!enabled) {
    return undefined;
  }
  return resultContext;
}

export function targetCensus(targets: ReadonlyArray<{ kind: string }>): { count: number; kinds: string } {
  const counts = new Map<string, number>();
  for (const target of targets) {
    counts.set(target.kind, (counts.get(target.kind) ?? 0) + 1);
  }
  return {
    count: targets.length,
    kinds: [...counts.entries()].map(([kind, count]) => `${kind}:${count}`).join(","),
  };
}

function monotonicNow(): number {
  return performance.now();
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function sanitizeFields(fields: Record<string, unknown>, depth: number): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (SENSITIVE_KEY.test(key)) {
      continue;
    }
    const sanitized = sanitizeValue(value, depth);
    if (sanitized !== undefined) {
      clean[key] = sanitized;
    }
  }
  return clean;
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (value == null || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return sanitizeString(value);
  }
  if (value instanceof Error) {
    return sanitizeString(value.message);
  }
  if (depth >= 3) {
    return "[depth]";
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeValue(item, depth + 1));
  }
  if (typeof value === "object") {
    return sanitizeFields(value as Record<string, unknown>, depth + 1);
  }
  return undefined;
}

function sanitizeString(value: string): string {
  if (value.length > 180) {
    return `[len:${value.length}]`;
  }
  if (isAbsolutePath(value)) {
    return leafName(value);
  }
  return value;
}

function isAbsolutePath(value: string): boolean {
  return value.startsWith("/") || value.startsWith("\\\\") || /^[A-Za-z]:[\\/]/.test(value);
}

function leafName(value: string): string {
  const parts = value.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "[path]";
}
