import { IsBoolean, IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';
import { ID_PATTERN } from '@/common/validation/id';

export class PublishResourceDto {
  @IsString({ message: 'El identificador de la asignatura debe ser texto.' })
  @Matches(ID_PATTERN, { message: 'El identificador de la asignatura debe tener un formato válido.' })
  subjectId: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  order?: number;

  @IsBoolean()
  @IsOptional()
  required?: boolean;
}
