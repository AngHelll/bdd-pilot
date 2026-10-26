import { buildExampleLabel } from "../gherkin/parser";
import {
  businessTheoryParams,
  parseTheoryDisplayName,
  theoryCandidateFromTestName,
} from "../runner/theoryDisplayName";

/** Visible cap for a dashboard example label. The title keeps the full text. */
export const DASHBOARD_EXAMPLE_LABEL_MAX = 64;

export interface DashboardScenarioLabel {
  /** Text shown in the row. May be ellipsized. */
  label: string;
  /** Full visible name for title and the accessible name. */
  title: string;
}

/**
 * Display name for a stored scenario or example.
 * Theory signatures lose runner metadata (`exampleTags`, `__pickleIndex`)
 * and reuse the tree's `header=value` example label.
 * The stored history key is not part of this result.
 */
export function formatDashboardScenarioLabel(storedName: string): DashboardScenarioLabel {
  const title = visibleDashboardScenarioTitle(storedName.trim());
  return {
    title,
    label: truncateVisualLabel(title, DASHBOARD_EXAMPLE_LABEL_MAX),
  };
}

function visibleDashboardScenarioTitle(storedName: string): string {
  if (!storedName) {
    return storedName;
  }
  const parsed = parseTheoryDisplayName(theoryCandidateFromTestName(storedName));
  if (!parsed) {
    return storedName;
  }

  const scenarioTitle = displayScenarioTitle(parsed.title);
  const business = businessTheoryParams(parsed.params);
  if (business.length === 0) {
    return scenarioTitle;
  }

  const cells = buildExampleLabel(
    business.map((param) => param.name),
    business.map((param) => param.value),
  );
  return `${scenarioTitle} · ${cells}`;
}

/** A dotted identifier with no spaces is a runner method name, not a Gherkin title. */
function displayScenarioTitle(title: string): string {
  const trimmed = title.trim();
  const lastDot = trimmed.lastIndexOf(".");
  if (lastDot > 0 && lastDot < trimmed.length - 1 && !/\s/.test(trimmed)) {
    return trimmed.slice(lastDot + 1);
  }
  return trimmed;
}

function truncateVisualLabel(text: string, maxLen: number): string {
  if (text.length <= maxLen) {
    return text;
  }
  return `${text.slice(0, maxLen - 1)}…`;
}
