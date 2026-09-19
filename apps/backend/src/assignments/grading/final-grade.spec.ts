import {
  computeFinalGrade,
  isClosed,
  FinalItem,
  FinalAttempt,
} from './final-grade';

const pub = (over: Partial<FinalItem>): FinalItem => ({
  id: 'a',
  maxScore: 10,
  countsTowardFinal: true,
  status: 'PUBLISHED',
  closeAt: null,
  dueAt: null,
  ...over,
});

describe('isClosed', () => {
  const now = new Date('2026-09-19T12:00:00Z');

  it('uses closeAt when set', () => {
    expect(isClosed(pub({ closeAt: new Date('2026-09-01T00:00:00Z') }), now)).toBe(
      true,
    );
    expect(isClosed(pub({ closeAt: new Date('2026-12-01T00:00:00Z') }), now)).toBe(
      false,
    );
  });

  it('falls back to dueAt when closeAt is null', () => {
    expect(
      isClosed(pub({ closeAt: null, dueAt: new Date('2026-09-01T00:00:00Z') }), now),
    ).toBe(true);
    expect(
      isClosed(pub({ closeAt: null, dueAt: new Date('2026-12-01T00:00:00Z') }), now),
    ).toBe(false);
  });

  it('is not closed when both dates are null', () => {
    expect(isClosed(pub({ closeAt: null, dueAt: null }), now)).toBe(false);
  });
});

describe('computeFinalGrade', () => {
  const now = new Date('2026-09-19T12:00:00Z');

  it('returns null when no countable items', () => {
    expect(
      computeFinalGrade([pub({ countsTowardFinal: false })], [], 'u', now),
    ).toBeNull();
  });

  it('averages ratios of graded countable items', () => {
    const items = [pub({ id: 'x', maxScore: 10 }), pub({ id: 'y', maxScore: 10 })];
    const attempts: FinalAttempt[] = [
      { activityId: 'x', userId: 'u', status: 'GRADED', score: 10 },
      { activityId: 'y', userId: 'u', status: 'GRADED', score: 5 },
    ];
    expect(computeFinalGrade(items, attempts, 'u', now)).toBe(0.75);
  });

  it('uses the best GRADED attempt', () => {
    const items = [pub({ id: 'x' })];
    const attempts: FinalAttempt[] = [
      { activityId: 'x', userId: 'u', status: 'GRADED', score: 4 },
      { activityId: 'x', userId: 'u', status: 'GRADED', score: 9 },
    ];
    expect(computeFinalGrade(items, attempts, 'u', now)).toBe(0.9);
  });

  it('counts missing as 0 after closeAt', () => {
    const items = [pub({ id: 'x', closeAt: new Date('2026-09-01T00:00:00Z') })];
    expect(computeFinalGrade(items, [], 'u', now)).toBe(0);
  });

  it('omits missing before close', () => {
    const items = [pub({ id: 'x', closeAt: new Date('2026-12-01T00:00:00Z') })];
    expect(computeFinalGrade(items, [], 'u', now)).toBeNull();
  });

  it('omits missing when both closeAt and dueAt are null', () => {
    const items = [pub({ id: 'x', closeAt: null, dueAt: null })];
    expect(computeFinalGrade(items, [], 'u', now)).toBeNull();
  });

  it('counts missing as 0 after dueAt when closeAt is null', () => {
    const items = [
      pub({
        id: 'x',
        closeAt: null,
        dueAt: new Date('2026-09-01T00:00:00Z'),
      }),
    ];
    expect(computeFinalGrade(items, [], 'u', now)).toBe(0);
  });

  it('ignores DRAFT and practice even if graded', () => {
    const items = [
      pub({ id: 'd', status: 'DRAFT' }),
      pub({ id: 'p', countsTowardFinal: false }),
    ];
    const attempts: FinalAttempt[] = [
      { activityId: 'd', userId: 'u', status: 'GRADED', score: 10 },
      { activityId: 'p', userId: 'u', status: 'GRADED', score: 10 },
    ];
    expect(computeFinalGrade(items, attempts, 'u', now)).toBeNull();
  });

  it('includes ARCHIVED countable items', () => {
    const items = [pub({ id: 'x', status: 'ARCHIVED' })];
    const attempts: FinalAttempt[] = [
      { activityId: 'x', userId: 'u', status: 'GRADED', score: 10 },
    ];
    expect(computeFinalGrade(items, attempts, 'u', now)).toBe(1);
  });

  it('skips items with maxScore ≤ 0', () => {
    const items = [pub({ id: 'x', maxScore: 0 })];
    const attempts: FinalAttempt[] = [
      { activityId: 'x', userId: 'u', status: 'GRADED', score: 0 },
    ];
    expect(computeFinalGrade(items, attempts, 'u', now)).toBeNull();
  });

  it('ignores other users’ attempts', () => {
    const items = [pub({ id: 'x' })];
    const attempts: FinalAttempt[] = [
      { activityId: 'x', userId: 'other', status: 'GRADED', score: 10 },
    ];
    expect(computeFinalGrade(items, attempts, 'u', now)).toBeNull();
  });

  it('ignores non-GRADED attempts when picking the best score', () => {
    const items = [pub({ id: 'x' })];
    const attempts: FinalAttempt[] = [
      { activityId: 'x', userId: 'u', status: 'SUBMITTED', score: 10 },
      { activityId: 'x', userId: 'u', status: 'IN_PROGRESS', score: 10 },
    ];
    expect(computeFinalGrade(items, attempts, 'u', now)).toBeNull();
  });
});
