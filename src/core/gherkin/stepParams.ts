const PLACEHOLDER_RE = /<([^>\s]+)>/g;

/** Unique `<param>` names found in Gherkin text (order preserved). */
export function extractStepParams(...texts: string[]): string[] {
  const seen = new Set<string>();
  const params: string[] = [];
  for (const text of texts) {
    if (!text) {
      continue;
    }
    for (const match of text.matchAll(PLACEHOLDER_RE)) {
      const name = match[1]?.trim();
      if (name && !seen.has(name)) {
        seen.add(name);
        params.push(name);
      }
    }
  }
  return params;
}
