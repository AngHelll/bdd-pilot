import { sanitize } from "./sanitizer";

/** Deep-sanitizes string leaves in JSON-like tool payloads (defensive MCP layer). */
export function sanitizeToolPayload<T>(value: T): T {
  if (typeof value === "string") {
    return sanitize(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeToolPayload(item)) as T;
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      out[key] = sanitizeToolPayload(entry);
    }
    return out as T;
  }
  return value;
}
