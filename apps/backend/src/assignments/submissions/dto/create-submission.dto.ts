import { SubmissionStatus } from '@prisma/client';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { ID_PATTERN } from '@/common/validation/id';

/**
 * Body for `POST /assignments/:id/submissions`.
 *
 * Files are uploaded first through the shared `/files` endpoint (the frontend's
 * `FileUpload` does this), so here we only receive the resulting file ids to
 * link — no raw multipart on this route.
 */
export class CreateSubmissionDto {
  @IsString()
  @IsOptional()
  text?: string;

  // Only DRAFT or SUBMITTED may come from the client; LATE/GRADED are derived
  // server-side, never trusted from the request.
  @IsEnum(SubmissionStatus)
  @IsIn([SubmissionStatus.DRAFT, SubmissionStatus.SUBMITTED])
  @IsOptional()
  status?: SubmissionStatus;

  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @Matches(ID_PATTERN, {
    each: true,
    message: 'Cada identificador de archivo debe tener un formato válido.',
  })
  @IsOptional()
  fileIds?: string[];
}
