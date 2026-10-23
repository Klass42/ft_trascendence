import { IsString, Matches } from 'class-validator';
import { ID_PATTERN } from '@/common/validation/id';

export class AttachFileDto {
  @IsString({ message: 'El identificador del archivo debe ser texto.' })
  @Matches(ID_PATTERN, { message: 'El identificador del archivo debe tener un formato válido.' })
  fileId: string;
}
