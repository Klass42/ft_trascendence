import { escapeCsvField } from './csv-field';

describe('escapeCsvField', () => {
  it.each(['=', '+', '-', '@', '\t', '\r'])(
    'prefixes cells beginning with %p to prevent spreadsheet formulas',
    (prefix) => {
      const expected = prefix === '\r'
        ? `"'${prefix}SUM(A1:A2)"`
        : `'${prefix}SUM(A1:A2)`;
      expect(escapeCsvField(`${prefix}SUM(A1:A2)`)).toBe(expected);
    },
  );

  it('keeps RFC-4180 quote escaping after formula neutralization', () => {
    expect(escapeCsvField('=SUM("a,b")')).toBe('"\'=SUM(""a,b"")"');
    expect(escapeCsvField('curso, uno')).toBe('"curso, uno"');
  });
});
