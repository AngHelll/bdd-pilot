export type GuardianStepMatchStatus = "bound" | "unbound" | "ambiguous";

export interface GuardianStepResolveDto {
  featurePath: string;
  line: number;
  keyword?: "Given" | "When" | "Then";
  stepText: string;
  status: GuardianStepMatchStatus;
  candidateCount?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isGuardianStepResolveDto(value: unknown): value is GuardianStepResolveDto {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.featurePath === "string" &&
    typeof value.line === "number" &&
    typeof value.stepText === "string" &&
    (value.status === "bound" || value.status === "unbound" || value.status === "ambiguous")
  );
}
