export interface ExecutionProfile {
  id: string;
  name: string;
  /** Raw value for `dotnet test --filter` (Category=Smoke, FullyQualifiedName~Login, etc.). */
  filter: string;
}

export function isExecutionProfile(value: unknown): value is ExecutionProfile {
  if (!value || typeof value !== "object") {
    return false;
  }
  const v = value as ExecutionProfile;
  return typeof v.id === "string" && typeof v.name === "string" && typeof v.filter === "string";
}

export function normalizeProfiles(raw: unknown): ExecutionProfile[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter(isExecutionProfile);
}
