import { mapAssignment, mapSubmission } from './assignment-mapper';

const assignment = {
  id: 'asg-1',
  courseId: 'course-web-101',
  title: 'Práctica 1',
  description: 'Entrega el informe',
  openAt: new Date('2026-09-01T00:00:00Z'),
  dueAt: new Date('2026-09-10T00:00:00Z'),
  closeAt: new Date('2026-09-12T00:00:00Z'),
  maxScore: 10,
};

describe('mapAssignment', () => {
  it('copies window, publishes, and stamps migratedFromAssignmentId', () => {
    const mapped = mapAssignment({ assignment, hasStudentFiles: false });

    expect(mapped).toMatchObject({
      courseId: 'course-web-101',
      title: 'Práctica 1',
      description: 'Entrega el informe',
      openAt: assignment.openAt,
      dueAt: assignment.dueAt,
      closeAt: assignment.closeAt,
      attemptsAllowed: 1,
      status: 'PUBLISHED',
      countsTowardFinal: true,
      config: { migratedFromAssignmentId: 'asg-1' },
    });
  });

  it('creates a single ESSAY question when there are no student files', () => {
    const mapped = mapAssignment({ assignment, hasStudentFiles: false });

    expect(mapped.questions).toHaveLength(1);
    expect(mapped.questions[0]).toEqual({
      kind: 'ESSAY',
      prompt: 'Entrega el informe',
      points: 10,
      order: 0,
      content: {},
    });
  });

  it('uses the title as the ESSAY prompt when description is null', () => {
    const mapped = mapAssignment({
      assignment: { ...assignment, description: null },
      hasStudentFiles: false,
    });

    expect(mapped.description).toBeNull();
    expect(mapped.questions[0].prompt).toBe('Práctica 1');
  });

  it('adds a zero-point FILE_UPLOAD question when students attached files', () => {
    const mapped = mapAssignment({ assignment, hasStudentFiles: true });

    expect(mapped.questions).toHaveLength(2);
    expect(mapped.questions[0].kind).toBe('ESSAY');
    expect(mapped.questions[0].points).toBe(10);
    expect(mapped.questions[1]).toEqual({
      kind: 'FILE_UPLOAD',
      prompt: 'Entrega el informe',
      points: 0,
      order: 1,
      content: { maxFiles: 10 },
    });
  });
});

describe('mapSubmission', () => {
  const gradedAt = new Date('2026-09-11T10:00:00Z');
  const updatedAt = new Date('2026-09-11T09:00:00Z');

  it('maps a graded submission onto a GRADED attempt and ESSAY awarded', () => {
    const mapped = mapSubmission({
      submission: {
        text: 'mi informe',
        score: 8,
        feedback: 'bien',
        status: 'GRADED',
        gradedById: 'user-diego-001',
        gradedAt,
        updatedAt,
      },
      essayQuestionId: 'q-essay',
      fileQuestionId: null,
      fileIds: [],
    });

    expect(mapped.attempt).toMatchObject({
      attemptNo: 1,
      status: 'GRADED',
      score: 8,
      feedback: 'bien',
      gradedById: 'user-diego-001',
      gradedAt,
    });
    expect(mapped.answers).toEqual([
      {
        questionId: 'q-essay',
        response: { text: 'mi informe' },
        awarded: 8,
      },
    ]);
  });

  it('maps SUBMITTED (and LATE) to SUBMITTED with null awarded', () => {
    for (const status of ['SUBMITTED', 'LATE']) {
      const mapped = mapSubmission({
        submission: {
          text: 'borrador enviado',
          score: null,
          feedback: null,
          status,
          gradedById: null,
          gradedAt: null,
          updatedAt,
        },
        essayQuestionId: 'q-essay',
        fileQuestionId: null,
        fileIds: [],
      });

      expect(mapped.attempt.status).toBe('SUBMITTED');
      expect(mapped.attempt.score).toBeNull();
      expect(mapped.answers[0].awarded).toBeNull();
      expect(mapped.answers[0].response).toEqual({ text: 'borrador enviado' });
    }
  });

  it('maps DRAFT to IN_PROGRESS', () => {
    const mapped = mapSubmission({
      submission: {
        text: null,
        score: null,
        feedback: null,
        status: 'DRAFT',
        gradedById: null,
        gradedAt: null,
        updatedAt,
      },
      essayQuestionId: 'q-essay',
      fileQuestionId: null,
      fileIds: [],
    });

    expect(mapped.attempt.status).toBe('IN_PROGRESS');
    expect(mapped.answers[0].response).toEqual({ text: '' });
    expect(mapped.answers[0].awarded).toBeNull();
  });

  it('treats a non-null score as GRADED even if the old status was SUBMITTED', () => {
    const mapped = mapSubmission({
      submission: {
        text: 'hecho',
        score: 10,
        feedback: null,
        status: 'SUBMITTED',
        gradedById: 'user-diego-001',
        gradedAt,
        updatedAt,
      },
      essayQuestionId: 'q-essay',
      fileQuestionId: null,
      fileIds: [],
    });

    expect(mapped.attempt.status).toBe('GRADED');
    expect(mapped.attempt.score).toBe(10);
    expect(mapped.answers[0].awarded).toBe(10);
  });

  it('adds a FILE_UPLOAD answer with null awarded when fileQuestionId is set', () => {
    const mapped = mapSubmission({
      submission: {
        text: 'con adjunto',
        score: 7,
        feedback: 'ok',
        status: 'GRADED',
        gradedById: 'user-diego-001',
        gradedAt,
        updatedAt,
      },
      essayQuestionId: 'q-essay',
      fileQuestionId: 'q-file',
      fileIds: ['file-1', 'file-2'],
    });

    expect(mapped.answers).toEqual([
      {
        questionId: 'q-essay',
        response: { text: 'con adjunto' },
        awarded: 7,
      },
      {
        questionId: 'q-file',
        response: { fileIds: ['file-1', 'file-2'] },
        awarded: null,
      },
    ]);
  });
});
