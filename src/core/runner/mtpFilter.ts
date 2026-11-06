/**
 * Translates one VSTest `--filter` clause, as `buildFilter` emits it, into the
 * xUnit MTP flags `dotnet test --help` printed for `samples/mtp-bdd` on 2026-10-23:
 * `--filter-trait`, `--filter-class`, `--filter-method`, `--filter-display-name`,
 * or `--filter-query` when clauses of different kinds are OR-ed.
 * Does not emit VSTest `--filter`.
 */

type MtpClause =
  | { kind: "trait"; name: string; value: string }
  | { kind: "class"; name: string }
  | { kind: "method"; name: string }
  | { kind: "displayName"; text: string }
  | { kind: "methodAndDisplay"; method: string; display: string };

const SIMPLE_FLAG: Record<"trait" | "class" | "method" | "displayName", string> = {
  trait: "--filter-trait",
  class: "--filter-class",
  method: "--filter-method",
  displayName: "--filter-display-name",
};

/** Reverses {@link escapeVstestFilterValue}. `%25` is decoded last. */
export function decodeVstestFilterValue(value: string): string {
  return value
    .replace(/%7C/gi, "|")
    .replace(/%26/gi, "&")
    .replace(/%22/gi, '"')
    .replace(/%25/g, "%");
}

export function appendMtpFilterArgs(args: string[], filter: string | undefined): void {
  const clauses = splitFilterClauses(filter);
  if (clauses.length === 0) {
    return;
  }
  const parsed = clauses
    .map(parseClause)
    .filter((clause): clause is MtpClause => clause !== undefined);
  if (parsed.length === 0) {
    return;
  }
  if (parsed.every((clause) => clause.kind === "methodAndDisplay")) {
    appendMethodAndDisplayArgs(args, parsed);
    return;
  }
  const simple = parsed.flatMap((clause): Array<Exclude<MtpClause, { kind: "methodAndDisplay" }>> =>
    clause.kind === "methodAndDisplay" ? [{ kind: "method", name: clause.method }] : [clause],
  );
  const kinds = new Set(simple.map((clause) => clause.kind));
  if (kinds.size === 1) {
    for (const clause of simple) {
      args.push(SIMPLE_FLAG[clause.kind], formatSimple(clause));
    }
    return;
  }
  // xUnit rejects `--filter-display-name` together with `--filter-query`
  // (ArgumentException, exit 134 on the fixture). A mixed selection that
  // includes an outline row keeps the other clauses, which the query
  // language can OR. The row alone still uses `--filter-display-name`.
  for (const clause of simple) {
    if (clause.kind === "displayName") {
      continue;
    }
    args.push("--filter-query", formatQuery(clause));
  }
}

function splitFilterClauses(filter: string | undefined): string[] {
  if (!filter?.trim()) {
    return [];
  }
  return filter
    .split("|")
    .map((clause) => clause.trim())
    .filter((clause) => clause.length > 0);
}

function parseMethodAndDisplay(
  clause: string,
): Extract<MtpClause, { kind: "methodAndDisplay" }> | undefined {
  const parts = unwrapParens(clause).split("&").map((part) => part.trim());
  if (parts.length !== 2) {
    return undefined;
  }
  const fqn = /^FullyQualifiedName~([\s\S]+)$/.exec(parts[0]);
  const display = /^DisplayName~([\s\S]+)$/.exec(parts[1]);
  if (!fqn || !display) {
    return undefined;
  }
  const method = fqn[1].trim();
  if (!method.includes(".")) {
    return undefined;
  }
  return {
    kind: "methodAndDisplay",
    method,
    display: decodeVstestFilterValue(display[1].trim()),
  };
}

function unwrapParens(clause: string): string {
  const trimmed = clause.trim();
  if (trimmed.startsWith("(") && trimmed.endsWith(")")) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function appendMethodAndDisplayArgs(
  args: string[],
  clauses: Array<Extract<MtpClause, { kind: "methodAndDisplay" }>>,
): void {
  const methods: string[] = [];
  const displays: string[] = [];
  for (const clause of clauses) {
    if (!methods.includes(clause.method)) {
      methods.push(clause.method);
    }
    if (!displays.includes(clause.display)) {
      displays.push(clause.display);
    }
  }
  for (const method of methods) {
    args.push("--filter-method", `*${method}*`);
  }
  for (const display of displays) {
    args.push("--filter-display-name", `*${display}*`);
  }
}

function parseClause(clause: string): MtpClause | undefined {
  const andRow = parseMethodAndDisplay(clause);
  if (andRow) {
    return andRow;
  }
  const display = /^DisplayName~([\s\S]+)$/.exec(unwrapParens(clause));
  if (display) {
    return { kind: "displayName", text: decodeVstestFilterValue(display[1].trim()) };
  }
  const fqn = /^FullyQualifiedName~([\s\S]+)$/.exec(unwrapParens(clause));
  if (fqn) {
    const name = fqn[1].trim();
    return name.includes(".") ? { kind: "method", name } : { kind: "class", name };
  }
  const trait = /^([A-Za-z_][\w.]*)=(.+)$/.exec(unwrapParens(clause));
  if (trait) {
    return { kind: "trait", name: trait[1], value: trait[2] };
  }
  return undefined;
}

function formatSimple(clause: Exclude<MtpClause, { kind: "methodAndDisplay" }>): string {
  switch (clause.kind) {
    case "trait":
      return `${clause.name}=${clause.value}`;
    case "class":
    case "method":
      return `*${clause.name}*`;
    case "displayName":
      return `*${clause.text}*`;
  }
}

function formatQuery(
  clause: Exclude<MtpClause, { kind: "displayName" | "methodAndDisplay" }>,
): string {
  switch (clause.kind) {
    case "trait":
      return `/[${clause.name}=${clause.value}]`;
    case "class":
      return `/*/*/*${clause.name}*`;
    case "method": {
      const dot = clause.name.lastIndexOf(".");
      const typeName = clause.name.slice(0, dot);
      const method = clause.name.slice(dot + 1);
      return `/*/*/${typeName}/${method}`;
    }
  }
}
