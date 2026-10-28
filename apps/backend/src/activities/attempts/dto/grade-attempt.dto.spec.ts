import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GRADE_FEEDBACK_MAX, GradeAttemptDto } from './grade-attempt.dto';

async function errorsFor(answers: unknown[]) {
  return validate(plainToInstance(GradeAttemptDto, { answers }));
}

describe('GradeAttemptDto', () => {
  it('accepts points, feedback or both per question', async () => {
    expect(
      await errorsFor([
        { questionId: 'q1', awarded: 2, feedback: 'Bien' },
        { questionId: 'q2', feedback: 'Solo comentario' },
        { questionId: 'q3', awarded: 0 },
      ]),
    ).toHaveLength(0);
  });

  it('accepts feedback of exactly the maximum length', async () => {
    const feedback = 'a'.repeat(GRADE_FEEDBACK_MAX);
    expect(await errorsFor([{ questionId: 'q1', feedback }])).toHaveLength(0);
  });

  it('rejects feedback longer than the maximum', async () => {
    const feedback = 'a'.repeat(GRADE_FEEDBACK_MAX + 1);
    const errors = await errorsFor([{ questionId: 'q1', feedback }]);
    expect(errors).toHaveLength(1);
    expect(JSON.stringify(errors)).toContain('maxLength');
  });

  it('rejects non-string feedback and negative points', async () => {
    expect(await errorsFor([{ questionId: 'q1', feedback: 42 }])).toHaveLength(1);
    expect(await errorsFor([{ questionId: 'q1', awarded: -1 }])).toHaveLength(1);
  });
});
