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

    if (name.toLowerCase() === "exampletags" || textStartsArray(inner, i)) {
      i = skipValue(inner, i);
      continue;
    }

    const parsed = readTheoryValue(inner, i);
    if (!parsed) {
      break;
    }

    params.push({ name, value: parsed.value });
    i = parsed.next;
  }

  return params;
}

/** Reqnroll/xUnit internals: `__*` pickle keys and `exampleTags`. */
export function isRunnerMetadataParamName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.startsWith("__")) {
    return true;
  }
  return trimmed.toLowerCase() === "exampletags";
}

/** Theory params that compare to Gherkin Examples (excludes runner metadata). */
export function businessTheoryParams(params: readonly TheoryParam[]): TheoryParam[] {
  return params.filter((param) => !isRunnerMetadataParamName(param.name));
}

/** 0-based Examples-row tie-break from `__pickleIndex` / `__PickleIndex`. */
export function pickleIndexFromParams(params: readonly TheoryParam[]): number | undefined {
  const found = params.find((param) => param.name.toLowerCase() === "__pickleindex");
  if (!found) {
    return undefined;
  }
  const raw = found.value.trim();
  if (!/^\d+$/.test(raw)) {
    return undefined;
  }
  return Number.parseInt(raw, 10);
}

/**
 * When `parseTheoryDisplayName` fails on a FQN prefix, retry with the method
 * segment before `(`.
 */
export function theoryCandidateFromTestName(testName: string): string {
  if (parseTheoryDisplayName(testName)) {
    return testName;
  }
  const open = testName.indexOf("(");
  if (open <= 0 || !testName.endsWith(")")) {
    return testName;
  }
  const beforeParen = testName.slice(0, open);
  const lastDot = beforeParen.lastIndexOf(".");
  const title = (lastDot >= 0 ? beforeParen.slice(lastDot + 1) : beforeParen).trim();
  if (!title) {
    return testName;
  }
  return `${title}${testName.slice(open)}`;
}

export function pickleIndexFromTestName(testName: string): number | undefined {
  const parsed = parseTheoryDisplayName(theoryCandidateFromTestName(testName));
  return parsed ? pickleIndexFromParams(parsed.params) : undefined;
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

/** Quoted string, or unquoted int/decimal / true|false / identifier (R2). */
function readTheoryValue(text: string, start: number): { value: string; next: number } | undefined {
  if (text[start] === '"') {
    return readQuotedValue(text, start);
  }
  return readUnquotedValue(text, start);
}

function readUnquotedValue(text: string, start: number): { value: string; next: number } | undefined {
  const rest = text.slice(start);
  const match = rest.match(/^(true|false|-?\d+(?:\.\d+)?|[A-Za-z0-9_.-]+)/i);
  if (!match) {
    return undefined;
  }
  return { value: match[1], next: start + match[0].length };
}

function textStartsArray(text: string, start: number): boolean {
  return text[start] === "[";
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
  const parsed = readTheoryValue(text, start);
  return parsed?.next ?? text.length;
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
