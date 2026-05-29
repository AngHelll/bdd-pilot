/**
 * Patterns that commonly carry secrets. Matches are redacted before any text is
 * written to the output channel, so credentials sourced from .env files or the
 * environment are never surfaced in logs.
 */
const SECRET_PATTERNS: RegExp[] = [
  /(client[_-]?secret\s*[=:]\s*)([^\s"']+)/gi,
  /(client[_-]?id\s*[=:]\s*)([^\s"']+)/gi,
  /(password\s*[=:]\s*)([^\s"']+)/gi,
  /(api[_-]?key\s*[=:]\s*)([^\s"']+)/gi,
  /(authorization\s*[=:]\s*)(bearer\s+)?([^\s"']+)/gi,
  /(token\s*[=:]\s*)([^\s"']+)/gi,
  /(aws_secret_access_key\s*[=:]\s*)([^\s"']+)/gi,
  /(connection[_-]?string\s*[=:]\s*)([^\n"']+)/gi,
];

const REDACTION = "***REDACTED***";

export function sanitize(text: string): string {
  let result = text;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, (_match, prefix: string) => `${prefix}${REDACTION}`);
  }
  // Redact long bearer/JWT-like tokens that appear bare in output.
  result = result.replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+/g, REDACTION);
  return result;
}
