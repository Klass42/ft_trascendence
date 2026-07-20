import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsObject,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

/** One question's raw response. `response` shape depends on the question kind;
 * graders defend against malformed shapes, so it's validated only as an object. */
export class AnswerInputDto {
  @IsString()
  @MinLength(1)
  questionId: string;

  @IsObject()
  response: Record<string, unknown>;
}

/** Body for `PATCH /attempts/:id` — upserts the answers saved so far. Sending a
 * subset is fine (autosave); each save replaces that question's stored answer. */
export class SaveAnswersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayUnique((a: AnswerInputDto) => a.questionId)
  @Type(() => AnswerInputDto)
  answers: AnswerInputDto[];
}
