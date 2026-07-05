/**
 * Reqnroll-compatible identifier generation (SpecFlow ToIdentifierPart port).
 * @see https://github.com/reqnroll/Reqnroll.VisualStudio/blob/main/Reqnroll.VisualStudio/Snippets/Fallback/CodeFormattingExtensions.cs
 *
 * Hyphens and dots become underscores before non-identifier chars are stripped —
 * required for `dotnet test --filter FullyQualifiedName~` to match generated classes.
 */

/** Capitalize the letter that follows a non-letter run (word boundary). */
const FIRST_WORD_CHAR_RE = /([^\p{Ll}\p{Lu}]+)([\p{Ll}\p{Lu}])/gu;

/** Newlines, dots, and hyphens → underscore (Reqnroll punctCharRe). */
const PUNCT_CHAR_RE = /[\n.-]+/g;

/** Strip characters invalid in C# identifiers (underscore \p{Pc} is kept). */
const NON_IDENTIFIER_RE = /[^\p{Ll}\p{Lu}\p{Lt}\p{Lm}\p{Lo}\p{Nl}\p{Nd}\p{Pc}]/gu;

export function removeQuotationCharacters(text: string): string {
  return text.replace(/['"]/g, "");
}

export function toReqnrollIdentifierPart(text: string): string {
  let result = removeQuotationCharacters(text);
  result = result.replace(FIRST_WORD_CHAR_RE, (_match, pre: string, fc: string) => pre + fc.toUpperCase());
  result = result.replace(PUNCT_CHAR_RE, "_");
  result = result.replace(NON_IDENTIFIER_RE, "");
  if (result.length > 0) {
    result = result.charAt(0).toUpperCase() + result.slice(1);
  }
  return result;
}

/** Full Reqnroll ToIdentifier (adds `_` prefix when the first char is a digit). */
export function toReqnrollIdentifier(text: string): string {
  let identifier = toReqnrollIdentifierPart(text);
  if (identifier.length > 0 && /\d/.test(identifier.charAt(0))) {
    identifier = `_${identifier}`;
  }
  return identifier;
}
