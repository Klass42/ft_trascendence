import { AttemptStatus } from '@prisma/client';
import { pickCell, summarizeSubjectResults } from './gradable-activities';

describe('pickCell', () => {
  it('prefers the best GRADED attempt and exposes its score', () => {
    const cell = pickCell('act', [
      { id: 'a1', score: 5, status: AttemptStatus.GRADED, attemptNo: 1 },
      { id: 'a2', score: 9, status: AttemptStatus.GRADED, attemptNo: 2 },
      { id: 'a3', score: 3, status: AttemptStatus.SUBMITTED, attemptNo: 3 },
    ]);
    expect(cell).toEqual({
      activityId: 'act',
      attemptId: 'a2',
      score: 9,
      partialScore: null,
      status: AttemptStatus.GRADED,
    });
  });

  it('a SUBMITTED attempt has no final score, only the partial one', () => {
    const cell = pickCell('act', [
      { id: 'a1', score: 4, status: AttemptStatus.SUBMITTED, attemptNo: 1 },
      { id: 'a2', score: 6, status: AttemptStatus.SUBMITTED, attemptNo: 2 },
      { id: 'a3', score: null, status: AttemptStatus.IN_PROGRESS, attemptNo: 3 },
    ]);
    expect(cell).toEqual({
      activityId: 'act',
      attemptId: 'a2',
      score: null,
      partialScore: 6,
      status: AttemptStatus.SUBMITTED,
    });
  });

  it('is empty when there are only drafts', () => {
    expect(
      pickCell('act', [{ id: 'a1', score: null, status: AttemptStatus.IN_PROGRESS }]),
    ).toEqual({ activityId: 'act', attemptId: null, score: null, partialScore: null, status: null });
  });
});

describe('summarizeSubjectResults', () => {
  it('counts a SUBMITTED partial score as pending, never as a grade', () => {
    const summary = summarizeSubjectResults(
      [{ id: 'act', maxScore: 10 }],
      ['s1', 's2'],
      [
        { activityId: 'act', userId: 's1', status: AttemptStatus.SUBMITTED, score: 4, attemptNo: 1 },
        { activityId: 'act', userId: 's2', status: AttemptStatus.GRADED, score: 8, attemptNo: 1 },
      ],
    );
    expect(summary).toMatchObject({ delivered: 2, graded: 1, pending: 1, percents: [80] });
  });
});
