import { IsArray, IsString, Matches } from 'class-validator';
import { ID_PATTERN } from '../validation/id';

export class OrderedIdsDto {
  @IsArray({ message: 'La lista de identificadores debe ser un arreglo.' })
  @IsString({ each: true, message: 'Cada identificador debe ser texto.' })
  @Matches(ID_PATTERN, {
    each: true,
    message: 'Cada identificador debe tener un formato válido.',
  })
  orderedIds: string[];
}
