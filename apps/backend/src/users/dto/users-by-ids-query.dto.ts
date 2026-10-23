import { Transform } from 'class-transformer';
import { IsArray, IsOptional, IsString, Matches } from 'class-validator';
import { ID_PATTERN } from '@/common/validation/id';

export class UsersByIdsQueryDto {
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.split(',').map((id: string) => id.trim()).filter(Boolean)
      : value,
  )
  @IsArray({ message: 'La lista de identificadores no es válida.' })
  @IsString({ each: true, message: 'Cada identificador de usuario debe ser texto.' })
  @Matches(ID_PATTERN, {
    each: true,
    message: 'Cada identificador de usuario debe tener un formato válido.',
  })
  @IsOptional()
  ids?: string[];
}
