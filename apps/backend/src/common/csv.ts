/** Escape a CSV cell and neutralize spreadsheet formulas from user content. */
export function csvField(value: string): string {
  const formulaLike = /^[=+\-@]/.test(value.trim()) || /^[\t\r]/.test(value);
  const safeValue = formulaLike ? `'${value}` : value;

  if (/[",\r\n]/.test(safeValue)) {
    return `"${safeValue.replace(/"/g, '""')}"`;
  }
  return safeValue;
}
