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
  | { kind: "displayName"; text: string };

const SIMPLE_FLAG: Record<MtpClause["kind"], string> = {
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
  const kinds = new Set(parsed.map((clause) => clause.kind));
  if (kinds.size === 1) {
    for (const clause of parsed) {
      args.push(SIMPLE_FLAG[clause.kind], formatSimple(clause));
    }
    return;
  }
  // xUnit rejects `--filter-display-name` together with `--filter-query`
  // (ArgumentException, exit 134 on the fixture). A mixed selection that
  // includes an outline row keeps the other clauses, which the query
  // language can OR. The row alone still uses `--filter-display-name`.
  for (const clause of parsed) {
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

function parseClause(clause: string): MtpClause | undefined {
  const display = /^DisplayName~([\s\S]+)$/.exec(clause);
  if (display) {
    return { kind: "displayName", text: decodeVstestFilterValue(display[1].trim()) };
  }
  const fqn = /^FullyQualifiedName~([\s\S]+)$/.exec(clause);
  if (fqn) {
    const name = fqn[1].trim();
    return name.includes(".") ? { kind: "method", name } : { kind: "class", name };
  }
  const trait = /^([A-Za-z_][\w.]*)=(.+)$/.exec(clause);
  if (trait) {
    return { kind: "trait", name: trait[1], value: trait[2] };
  }
  return undefined;
}

function formatSimple(clause: MtpClause): string {
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

function formatQuery(clause: Exclude<MtpClause, { kind: "displayName" }>): string {
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
