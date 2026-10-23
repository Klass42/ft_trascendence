import { csvField } from './csv';

describe('csvField', () => {
  it.each(['=CMD()', '+1', '-1', '@SUM'])('neutralizes formula prefix %s', (value) => {
    expect(csvField(value)).toBe(`'${value}`);
  });

  it.each([
    ['\t=CMD()', "'\t=CMD()"],
    ['\r=CMD()', `"'\r=CMD()"`],
  ])('neutralizes leading control prefix', (value, expected) => {
    expect(csvField(value)).toBe(expected);
  });

  it('escapes commas, quotes, and line breaks using RFC-4180 quoting', () => {
    expect(csvField('Ada, "Ace"\r\nLovelace')).toBe('"Ada, ""Ace""\r\nLovelace"');
  });

  it('escapes formula-like content before applying CSV quoting', () => {
    expect(csvField('=CMD("x,y")')).toBe('"\'=CMD(""x,y"")"');
  });
});
