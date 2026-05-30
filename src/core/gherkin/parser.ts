import { FeatureInfo, OutlineExample, ScenarioInfo } from "./model";

const FEATURE_RE = /^\s*(?:Feature|Característica|Funcionalidad)\s*:\s*(.*)$/i;
const SCENARIO_RE = /^\s*(?:Scenario|Escenario)\s*:\s*(.*)$/i;
const OUTLINE_RE =
  /^\s*(?:Scenario Outline|Scenario Template|Esquema del escenario)\s*:\s*(.*)$/i;
const EXAMPLES_RE = /^\s*Examples:\s*(.*)?$/i;
const TAG_RE = /(^|\s)@[^\s@]+/g;

interface OutlineParseState {
  scenario: ScenarioInfo;
  headers: string[] | null;
}

/**
 * Lightweight, dependency-free Gherkin parser.
 *
 * Extracts feature name + tags, scenarios / outlines (with Examples rows), and
 * line numbers. Tags on a Feature block are *not* merged into scenarios here —
 * use {@link effectiveScenarioTags} when inheritance is needed.
 */
export function parseFeature(filePath: string, content: string): FeatureInfo {
  const lines = content.split(/\r?\n/);

  const feature: FeatureInfo = {
    name: "",
    filePath,
    tags: [],
    scenarios: [],
  };

  let pendingTags: string[] = [];
  let featureSeen = false;
  let outlineState: OutlineParseState | undefined;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();

    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }

    if (isTagLine(line)) {
      pendingTags.push(...extractTags(line));
      continue;
    }

    const featureMatch = FEATURE_RE.exec(raw);
    if (featureMatch && !featureSeen) {
      feature.name = featureMatch[1].trim();
      feature.tags = pendingTags;
      pendingTags = [];
      featureSeen = true;
      outlineState = undefined;
      continue;
    }

    const outlineMatch = OUTLINE_RE.exec(raw);
    if (outlineMatch) {
      outlineState = undefined;
      feature.scenarios.push(makeScenario(outlineMatch[1], pendingTags, i + 1, true));
      pendingTags = [];
      outlineState = { scenario: feature.scenarios[feature.scenarios.length - 1], headers: null };
      continue;
    }

    const scenarioMatch = SCENARIO_RE.exec(raw);
    if (scenarioMatch) {
      outlineState = undefined;
      feature.scenarios.push(makeScenario(scenarioMatch[1], pendingTags, i + 1, false));
      pendingTags = [];
      continue;
    }

    if (outlineState && EXAMPLES_RE.test(line)) {
      outlineState.headers = null;
      const inline = EXAMPLES_RE.exec(line)?.[1]?.trim();
      if (inline && inline.includes("|")) {
        parseExampleRow(outlineState, inline, i + 1);
      }
      continue;
    }

    if (outlineState && line.includes("|")) {
      parseExampleRow(outlineState, line, i + 1);
      continue;
    }

    // Steps, Background, etc. — stop Examples parsing for this outline.
    if (outlineState && outlineState.headers !== null) {
      outlineState = undefined;
    }

    pendingTags = [];
  }

  if (feature.name.length === 0) {
    feature.name = fileBaseName(filePath);
  }

  return feature;
}

function parseExampleRow(state: OutlineParseState, line: string, lineNumber: number): void {
  const cells = parseTableRow(line);
  if (cells.length === 0) {
    return;
  }

  if (!state.headers) {
    state.headers = cells;
    return;
  }

  const headers = state.headers;
  const values = cells;
  const rowIndex = state.scenario.examples?.length ?? 0;
  const example: OutlineExample = {
    rowIndex,
    line: lineNumber,
    headers: [...headers],
    values: headers.map((_, idx) => values[idx] ?? ""),
    label: buildExampleLabel(headers, values),
  };

  if (!state.scenario.examples) {
    state.scenario.examples = [];
  }
  state.scenario.examples.push(example);
}

export function parseTableRow(line: string): string[] {
  if (!line.includes("|")) {
    return [];
  }
  const parts = line.split("|").map((cell) => cell.trim());
  if (parts.length >= 2 && parts[0] === "" && parts[parts.length - 1] === "") {
    return parts.slice(1, -1);
  }
  return parts.filter((cell) => cell.length > 0);
}

export function buildExampleLabel(headers: string[], values: string[]): string {
  const pairs = headers
    .map((header, idx) => ({ header, value: (values[idx] ?? "").trim() }))
    .filter((pair) => pair.header.length > 0 && pair.value.length > 0);

  if (pairs.length === 0) {
    return "row";
  }
  if (pairs.length === 1) {
    return `${pairs[0].header}=${pairs[0].value}`;
  }
  if (pairs.length === 2) {
    return `${pairs[0].header}=${pairs[0].value}, ${pairs[1].header}=${pairs[1].value}`;
  }
  return `${pairs[0].header}=${pairs[0].value}, ${pairs[1].header}=${pairs[1].value} +${pairs.length - 2}`;
}

function makeScenario(
  name: string,
  tags: string[],
  line: number,
  isOutline: boolean,
): ScenarioInfo {
  return { name: name.trim(), tags: [...tags], line, isOutline };
}

function isTagLine(line: string): boolean {
  return line.startsWith("@") && line.replace(TAG_RE, "").trim().length === 0;
}

export function extractTags(line: string): string[] {
  const matches = line.match(TAG_RE) || [];
  return matches.map((t) => t.trim().replace(/^@/, "")).filter((t) => t.length > 0);
}

function fileBaseName(filePath: string): string {
  const parts = filePath.split(/[\\/]/);
  const last = parts[parts.length - 1] || filePath;
  return last.replace(/\.feature$/i, "");
}
