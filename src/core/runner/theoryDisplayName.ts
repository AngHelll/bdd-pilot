export interface TheoryParam {
  name: string;
  value: string;
}

export interface ParsedTheoryDisplayName {
  /** Scenario title before the theory argument list. */
  title: string;
  params: TheoryParam[];
}

const STEP_LINE_RE = /^\s*(?:Given|When|Then|And|But|\*)\s+/i;

/**
 * Parses xUnit / Reqnroll theory display names, e.g.
 * `Add two numbers(first: "1", second: "2", result: "3", exampleTags: [])`.
 */
export function parseTheoryDisplayName(raw: string): ParsedTheoryDisplayName | undefined {
  const line = raw.trim();
  const open = line.indexOf("(");
  if (open <= 0 || !line.endsWith(")")) {
    return undefined;
  }

  const title = line.slice(0, open).trim();
  const inner = line.slice(open + 1, -1).trim();
  if (!title || !inner) {
    return undefined;
  }

  const params = parseTheoryParamList(inner);
  if (params.length === 0) {
    return undefined;
  }

  return { title, params };
}

function parseTheoryParamList(inner: string): TheoryParam[] {
  const params: TheoryParam[] = [];
  let i = 0;

  while (i < inner.length) {
    while (i < inner.length && (inner[i] === " " || inner[i] === ",")) {
      i++;
    }
    if (i >= inner.length) {
      break;
    }

    const colon = inner.indexOf(":", i);
    if (colon <= i) {
      break;
    }

    const name = inner.slice(i, colon).trim();
    i = colon + 1;
    while (i < inner.length && inner[i] === " ") {
      i++;
    }

    if (name === "exampleTags") {
      i = skipValue(inner, i);
      continue;
    }

    const parsed = readQuotedValue(inner, i);
    if (!parsed) {
      break;
    }

    params.push({ name, value: parsed.value });
    i = parsed.next;
  }

  return params;
}

function readQuotedValue(text: string, start: number): { value: string; next: number } | undefined {
  if (text[start] !== '"') {
    return undefined;
  }
  let value = "";
  let i = start + 1;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "\\" && i + 1 < text.length) {
      value += text[i + 1];
      i += 2;
      continue;
    }
    if (ch === '"') {
      return { value, next: i + 1 };
    }
    value += ch;
    i++;
  }
  return undefined;
}

function skipValue(text: string, start: number): number {
  if (text[start] === "[") {
    let depth = 0;
    for (let i = start; i < text.length; i++) {
      if (text[i] === "[") {
        depth++;
      } else if (text[i] === "]") {
        depth--;
        if (depth === 0) {
          return i + 1;
        }
      }
    }
  }
  if (text[start] === '"') {
    const parsed = readQuotedValue(text, start);
    return parsed?.next ?? text.length;
  }
  return text.length;
}

/** True when a list-tests line looks like a Reqnroll/xUnit theory row. */
export function isTheoryDisplayNameLine(line: string): boolean {
  return parseTheoryDisplayName(line) !== undefined;
}

/** Extracts theory display names from `dotnet test --list-tests` stdout. */
export function extractListedTestNames(output: string): string[] {
  const names: string[] = [];
  for (const raw of output.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("The following") || line.startsWith("Test run for")) {
      continue;
    }
    if (line.endsWith(".dll") || line.startsWith("A total of")) {
      continue;
    }
    names.push(line);
  }
  return names;
}

export function isStepLine(line: string): boolean {
  return STEP_LINE_RE.test(line);
}
