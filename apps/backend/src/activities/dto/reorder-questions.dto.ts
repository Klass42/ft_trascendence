import { ArrayNotEmpty, ArrayUnique, IsArray, IsString } from 'class-validator';

/** Body for `PATCH /activities/:id/questions/reorder` — the full list of the
 * activity's question ids in the desired order. The service validates the set
 * matches the activity's questions exactly. */
export class ReorderQuestionsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  questionIds: string[];
}
