export type FinalItem = {
  id: string;
  maxScore: number;
  countsTowardFinal: boolean;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  closeAt: Date | null;
  dueAt: Date | null;
};

export type FinalAttempt = {
  activityId: string;
  userId: string;
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED';
  score: number | null;
};

export function isClosed(item: FinalItem, now: Date): boolean {
  if (item.closeAt) return now > item.closeAt;
  if (item.dueAt) return now > item.dueAt;
  return false;
}

/**
 * Average of per-item ratios (best GRADED / maxScore). Skips DRAFT, practice,
 * and maxScore ≤ 0. Missing work after close counts as 0; before close it is
 * omitted. Empty set → null.
 */
export function computeFinalGrade(
  items: FinalItem[],
  attempts: FinalAttempt[],
  userId: string,
  now: Date,
): number | null {
  const ratios: number[] = [];

  for (const item of items) {
    if (item.status === 'DRAFT' || !item.countsTowardFinal) continue;
    if (item.maxScore <= 0) continue;

    const graded = attempts.filter(
      (a) =>
        a.activityId === item.id &&
        a.userId === userId &&
        a.status === 'GRADED' &&
        a.score != null,
    );
    if (graded.length > 0) {
      const best = Math.max(...graded.map((a) => a.score as number));
      ratios.push(best / item.maxScore);
      continue;
    }
    if (isClosed(item, now)) {
      ratios.push(0);
    }
  }

  if (ratios.length === 0) return null;
  return ratios.reduce((s, r) => s + r, 0) / ratios.length;
}
