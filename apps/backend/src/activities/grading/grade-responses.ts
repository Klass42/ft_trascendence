import { QuestionKind } from '@prisma/client';
import { gradeQuestion, isAutoGradable } from './graders';

export interface GradeableQuestion {
  id: string;
  kind: QuestionKind;
  content: unknown;
  points: number;
}

export interface RawAnswer {
  questionId: string;
  response: unknown;
}

export interface GradedResponse {
  questionId: string;
  autoGradable: boolean;
  correct: boolean | null;
  awarded: number | null;
  points: number;
}

export interface ResponseGrade {
  results: GradedResponse[];
  score: number;
  totalPoints: number;
  awardedSum: number;
  hasManual: boolean;
}

/** Shared, side-effect-free scoring for teacher previews and submitted work. */
export function gradeResponses(
  questions: GradeableQuestion[],
  answers: RawAnswer[],
  maxScore: number,
): ResponseGrade {
  const answersByQuestion = new Map(
    answers.map((answer) => [answer.questionId, answer.response]),
  );
  let totalPoints = 0;
  let awardedSum = 0;
  let hasManual = false;

  const results = questions.map((question): GradedResponse => {
    totalPoints += question.points;
    if (!isAutoGradable(question.kind, question.content)) {
      hasManual = true;
      return {
        questionId: question.id,
        autoGradable: false,
        correct: null,
        awarded: null,
        points: question.points,
      };
    }

    const { correct, awarded } = gradeQuestion(
      question.kind,
      question.content,
      answersByQuestion.get(question.id) ?? {},
      question.points,
    );
    awardedSum += awarded;
    return {
      questionId: question.id,
      autoGradable: true,
      correct,
      awarded,
      points: question.points,
    };
  });

  const scaledScore = totalPoints > 0 ? (awardedSum / totalPoints) * maxScore : 0;
  return {
    results,
    score: round2(scaledScore),
    totalPoints,
    awardedSum,
    hasManual,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
