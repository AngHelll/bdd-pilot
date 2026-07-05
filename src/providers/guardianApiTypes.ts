import { GuardianStepResolveDto } from "../core/bindings/guardianStepDto";

export interface GuardianIndexApiV1 {
  readonly apiVersion: 1;
  readonly isReady: boolean;
  getSnapshot(): unknown;
  onDidChangeIndex(listener: () => void): { dispose(): void };
  resolveStep?(featurePath: string, line: number): GuardianStepResolveDto | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isGuardianIndexApiV1(value: unknown): value is GuardianIndexApiV1 {
  if (!isRecord(value)) {
    return false;
  }
  return (
    value.apiVersion === 1 &&
    typeof value.isReady === "boolean" &&
    typeof value.getSnapshot === "function" &&
    typeof value.onDidChangeIndex === "function"
  );
}

export function hasGuardianResolveStepApi(api: GuardianIndexApiV1): boolean {
  return typeof api.resolveStep === "function";
}
