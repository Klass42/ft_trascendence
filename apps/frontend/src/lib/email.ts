/**
 * Same rule as the backend (`IsEmail({ require_tld: false })`): `local@domain`,
 * the domain does not need a TLD (seed accounts such as `student@demo`).
 */
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*$/;

export function isValidEmail(value: string): boolean {
  return value.length <= 254 && EMAIL_RE.test(value);
}
