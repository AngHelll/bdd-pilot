import { StepLocation } from "../gherkin/stepLocations";
import { GuardianStepResolveDto, isGuardianStepResolveDto } from "./guardianStepDto";

export interface BindingGateIssue {
  featurePath: string;
  line0: number;
  scenarioName: string;
  stepText: string;
  status: "unbound" | "ambiguous";
  candidateCount?: number;
}

export type ResolveStepFn = (featurePath: string, line0: number) => unknown;

export interface BindingGateEvaluation {
  unboundIssues: BindingGateIssue[];
  ambiguousIssues: BindingGateIssue[];
}

export function evaluateBindingGate(
  locations: StepLocation[],
  resolveStep: ResolveStepFn,
): BindingGateEvaluation {
  const unboundIssues: BindingGateIssue[] = [];
  const ambiguousIssues: BindingGateIssue[] = [];

  for (const location of locations) {
    let raw: unknown;
    try {
      raw = resolveStep(location.featurePath, location.line0);
    } catch {
      continue;
    }

    if (!isGuardianStepResolveDto(raw)) {
      continue;
    }

    if (raw.status === "bound") {
      continue;
    }

    const issue: BindingGateIssue = {
      featurePath: location.featurePath,
      line0: location.line0,
      scenarioName: location.scenarioName,
      stepText: raw.stepText || location.stepText,
      status: raw.status,
      candidateCount: raw.candidateCount,
    };

    if (raw.status === "unbound") {
      unboundIssues.push(issue);
    } else {
      ambiguousIssues.push(issue);
    }
  }

  return { unboundIssues, ambiguousIssues };
}

/** @internal test helper */
export function issueFromDto(location: StepLocation, dto: GuardianStepResolveDto): BindingGateIssue {
  return {
    featurePath: location.featurePath,
    line0: location.line0,
    scenarioName: location.scenarioName,
    stepText: dto.stepText,
    status: dto.status === "unbound" ? "unbound" : "ambiguous",
    candidateCount: dto.candidateCount,
  };
}
