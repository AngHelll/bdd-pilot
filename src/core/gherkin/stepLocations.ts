const SCENARIO_RE = /^\s*(?:Scenario|Escenario)\s*:\s*(.*)$/i;
const OUTLINE_RE =
  /^\s*(?:Scenario Outline|Scenario Template|Esquema del escenario)\s*:\s*(.*)$/i;
const BACKGROUND_RE = /^\s*(?:Background|Antecedentes|Antecedente)\s*:\s*(.*)?$/i;

export interface StepLocation {
  featurePath: string;
  /** 0-based line index for Guardian resolveStep. */
  line0: number;
  scenarioName: string;
  stepText: string;
}

function isStepLine(raw: string): boolean {
  return /^\s*(?:Given|When|Then|And|But|\*|Dado|Cuando|Entonces|Y|Pero)\s+/i.test(raw);
}

/**
 * Parses step lines from a .feature file with 0-based line numbers for Guardian.
 */
export function parseFeatureStepLocations(filePath: string, content: string): StepLocation[] {
  const lines = content.split(/\r?\n/);
  const locations: StepLocation[] = [];

  let activeScenarioName: string | undefined;
  let seenScenario = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }

    if (BACKGROUND_RE.test(trimmed) && !seenScenario) {
      activeScenarioName = "Background";
      continue;
    }

    const outlineMatch = OUTLINE_RE.exec(raw);
    if (outlineMatch) {
      seenScenario = true;
      activeScenarioName = outlineMatch[1]?.trim() || "Scenario Outline";
      continue;
    }

    const scenarioMatch = SCENARIO_RE.exec(raw);
    if (scenarioMatch) {
      seenScenario = true;
      activeScenarioName = scenarioMatch[1]?.trim() || "Scenario";
      continue;
    }

    if (isStepLine(raw) && activeScenarioName) {
      locations.push({
        featurePath: filePath,
        line0: i,
        scenarioName: activeScenarioName,
        stepText: trimmed,
      });
    }
  }

  return locations;
}
