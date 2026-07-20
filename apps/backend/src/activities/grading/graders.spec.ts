import { QuestionKind } from '@prisma/client';
import { gradeQuestion, isAutoGradable } from './graders';
import { normalizeText, matchesAccepted } from './normalize';

const g = (kind: QuestionKind, content: unknown, response: unknown, points = 1) =>
  gradeQuestion(kind, content, response, points);

describe('normalizeText', () => {
  it('trims, collapses whitespace, lowercases and strips accents by default', () => {
    expect(normalizeText('  Él  Camión ')).toBe('el camion');
  });
  it('respects caseSensitive and ignoreAccents=false', () => {
    expect(normalizeText('Café', { caseSensitive: true, ignoreAccents: false })).toBe(
      'Café',
    );
  });
  it('coerces non-strings and empty to safe values', () => {
    expect(normalizeText(null)).toBe('');
    expect(normalizeText(42)).toBe('42');
  });
});

describe('matchesAccepted (synonyms)', () => {
  it('matches any accepted synonym under normalisation', () => {
    expect(matchesAccepted('  COCHE ', ['auto', 'coche'])).toBe(true);
  });
  it('never matches empty response', () => {
    expect(matchesAccepted('', ['x'])).toBe(false);
  });
});

describe('MULTIPLE_CHOICE (all-or-nothing, set equality)', () => {
  const content = { options: ['a', 'b', 'c'], correct: [0, 2] };
  it('full marks for the exact set regardless of order', () => {
    expect(g(QuestionKind.MULTIPLE_CHOICE, content, { selected: [2, 0] }, 4)).toEqual({
      correct: true,
      awarded: 4,
    });
  });
  it('zero for a superset / subset / wrong', () => {
    expect(g(QuestionKind.MULTIPLE_CHOICE, content, { selected: [0] }, 4).awarded).toBe(0);
    expect(g(QuestionKind.MULTIPLE_CHOICE, content, { selected: [0, 1, 2] }, 4).awarded).toBe(0);
  });
  it('zero for malformed response', () => {
    expect(g(QuestionKind.MULTIPLE_CHOICE, content, {}, 4).awarded).toBe(0);
  });
});

describe('TRUE_FALSE', () => {
  it('matches the boolean answer', () => {
    expect(g(QuestionKind.TRUE_FALSE, { answer: true }, { value: true }).correct).toBe(true);
    expect(g(QuestionKind.TRUE_FALSE, { answer: true }, { value: false }).awarded).toBe(0);
  });
  it('zero when value missing or non-boolean', () => {
    expect(g(QuestionKind.TRUE_FALSE, { answer: true }, { value: 'true' }).awarded).toBe(0);
  });
});

describe('FILL_BLANK (partial credit per blank, synonyms)', () => {
  const content = {
    blanks: [{ accepted: ['dog', 'perro'] }, { accepted: ['cat'] }],
  };
  it('full marks when all blanks match (accent/case-insensitive)', () => {
    expect(g(QuestionKind.FILL_BLANK, content, { values: ['Perro', 'CAT'] }, 10)).toEqual({
      correct: true,
      awarded: 10,
    });
  });
  it('half marks when one of two blanks matches', () => {
    const r = g(QuestionKind.FILL_BLANK, content, { values: ['dog', 'wrong'] }, 10);
    expect(r).toEqual({ correct: false, awarded: 5 });
  });
  it('zero when nothing matches or values missing', () => {
    expect(g(QuestionKind.FILL_BLANK, content, { values: [] }, 10).awarded).toBe(0);
  });
});

describe('MATCHING (partial credit per pair)', () => {
  const content = {
    left: ['1', '2', '3', '4'],
    right: ['a', 'b', 'c', 'd'],
    pairs: [[0, 0], [1, 1], [2, 2], [3, 3]],
  };
  it('full marks for all pairs correct', () => {
    const r = g(QuestionKind.MATCHING, content, { pairs: [[0, 0], [1, 1], [2, 2], [3, 3]] }, 8);
    expect(r).toEqual({ correct: true, awarded: 8 });
  });
  it('partial for half the pairs', () => {
    const r = g(QuestionKind.MATCHING, content, { pairs: [[0, 0], [1, 1], [2, 3], [3, 2]] }, 8);
    expect(r).toEqual({ correct: false, awarded: 4 });
  });
});

describe('ORDERING (exact sequence)', () => {
  const content = { items: ['x', 'y', 'z'], correctOrder: [2, 0, 1] };
  it('full marks for the exact order', () => {
    expect(g(QuestionKind.ORDERING, content, { order: [2, 0, 1] }, 6).awarded).toBe(6);
  });
  it('zero for any deviation', () => {
    expect(g(QuestionKind.ORDERING, content, { order: [0, 2, 1] }, 6).awarded).toBe(0);
  });
});

describe('SHORT_ANSWER', () => {
  it('matches a normalised accepted answer', () => {
    expect(
      g(QuestionKind.SHORT_ANSWER, { accepted: ['Madrid'] }, { text: ' madrid ' }, 3).awarded,
    ).toBe(3);
  });
  it('is not auto-gradable when accepted is empty (subjective)', () => {
    expect(isAutoGradable(QuestionKind.SHORT_ANSWER, { accepted: [] })).toBe(false);
    expect(isAutoGradable(QuestionKind.SHORT_ANSWER, { accepted: ['x'] })).toBe(true);
  });
});

describe('isAutoGradable', () => {
  it('true for every objective kind', () => {
    for (const kind of [
      QuestionKind.MULTIPLE_CHOICE,
      QuestionKind.TRUE_FALSE,
      QuestionKind.FILL_BLANK,
      QuestionKind.MATCHING,
      QuestionKind.ORDERING,
    ]) {
      expect(isAutoGradable(kind, {})).toBe(true);
    }
  });
});

describe('gradeQuestion clamping', () => {
  it('clamps awarded into [0, points]', () => {
    // A single matched blank out of one → exactly points, never above.
    const r = g(QuestionKind.FILL_BLANK, { blanks: [{ accepted: ['a'] }] }, { values: ['a'] }, 5);
    expect(r.awarded).toBe(5);
  });
});
