export type MappedActivity = {
  subjectId: string;
  title: string;
  description: string | null;
  openAt: Date | null;
  dueAt: Date | null;
  closeAt: Date | null;
  attemptsAllowed: 1;
  status: 'PUBLISHED';
  countsTowardFinal: true;
  config: { migratedFromAssignmentId: string };
  questions: Array<{
    kind: 'ESSAY' | 'FILE_UPLOAD';
    prompt: string;
    points: number;
    order: number;
    content: Record<string, unknown>;
  }>;
};

export type MappedSubmission = {
  attempt: {
    attemptNo: 1;
    status: 'GRADED' | 'SUBMITTED' | 'IN_PROGRESS';
    score: number | null;
    feedback: string | null;
    gradedById: string | null;
    gradedAt: Date | null;
  };
  answers: Array<{
    questionId: string;
    response: unknown;
    awarded: number | null;
  }>;
};

export function mapAssignment(input: {
  assignment: {
    id: string;
    subjectId: string;
    title: string;
    description: string | null;
    openAt: Date | null;
    dueAt: Date | null;
    closeAt: Date | null;
    maxScore: number;
  };
  hasStudentFiles: boolean;
}): MappedActivity {
  const { assignment, hasStudentFiles } = input;
  const prompt = assignment.description ?? assignment.title;
  const questions: MappedActivity['questions'] = [
    {
      kind: 'ESSAY',
      prompt,
      points: assignment.maxScore,
      order: 0,
      content: {},
    },
  ];
  if (hasStudentFiles) {
    questions.push({
      kind: 'FILE_UPLOAD',
      prompt,
      points: 0,
      order: 1,
      content: { maxFiles: 10 },
    });
  }
  return {
    subjectId: assignment.subjectId,
    title: assignment.title,
    description: assignment.description,
    openAt: assignment.openAt,
    dueAt: assignment.dueAt,
    closeAt: assignment.closeAt,
    attemptsAllowed: 1,
    status: 'PUBLISHED',
    countsTowardFinal: true,
    config: { migratedFromAssignmentId: assignment.id },
    questions,
  };
}

export function mapSubmission(input: {
  submission: {
    text: string | null;
    score: number | null;
    feedback: string | null;
    status: string;
    gradedById: string | null;
    gradedAt: Date | null;
    updatedAt: Date;
  };
  essayQuestionId: string;
  fileQuestionId: string | null;
  fileIds: string[];
}): MappedSubmission {
  const { submission, essayQuestionId, fileQuestionId, fileIds } = input;
  const graded = submission.score != null;
  let status: MappedSubmission['attempt']['status'];
  if (graded) status = 'GRADED';
  else if (submission.status === 'DRAFT') status = 'IN_PROGRESS';
  else status = 'SUBMITTED';

  const answers: MappedSubmission['answers'] = [
    {
      questionId: essayQuestionId,
      response: { text: submission.text ?? '' },
      awarded: graded ? submission.score : null,
    },
  ];
  if (fileQuestionId) {
    answers.push({
      questionId: fileQuestionId,
      response: { fileIds },
      awarded: null,
    });
  }

  return {
    attempt: {
      attemptNo: 1,
      status,
      score: graded ? submission.score : null,
      feedback: submission.feedback,
      gradedById: submission.gradedById,
      gradedAt: submission.gradedAt,
    },
    answers,
  };
}
