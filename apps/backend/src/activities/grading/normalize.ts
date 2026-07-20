/**
 * Text normalisation for objective auto-grading (FILL_BLANK / SHORT_ANSWER /
 * textual MATCHING). Deterministic and side-effect free so graders stay pure.
 *
 * Steps: trim → collapse internal whitespace → optionally strip accents →
 * optionally lowercase. Defaults favour lenient matching (accent-insensitive,
 * case-insensitive) which suits vocabulary/short-answer questions.
 */
export interface NormalizeOptions {
  caseSensitive?: boolean;
  ignoreAccents?: boolean; // default true
}

export function normalizeText(
  value: unknown,
  opts: NormalizeOptions = {},
): string {
  const { caseSensitive = false, ignoreAccents = true } = opts;
  let s = typeof value === 'string' ? value : String(value ?? '');
  s = s.trim().replace(/\s+/g, ' ');
  if (ignoreAccents) {
    // Decompose combining marks then drop them (á → a). Safe on plain ASCII.
    s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  if (!caseSensitive) {
    s = s.toLowerCase();
  }
  return s;
}

/** True if `value` matches any of `accepted` under the same normalisation. */
export function matchesAccepted(
  value: unknown,
  accepted: unknown,
  opts: NormalizeOptions = {},
): boolean {
  if (!Array.isArray(accepted)) return false;
  const target = normalizeText(value, opts);
  if (target === '') return false;
  return accepted.some((a) => normalizeText(a, opts) === target);
}
