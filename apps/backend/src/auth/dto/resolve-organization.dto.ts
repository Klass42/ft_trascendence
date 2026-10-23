import { IsString, Matches, MaxLength } from 'class-validator';

export class ResolveOrganizationDto {
  @IsString({ message: 'El código de organización debe ser texto.' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'El código de organización solo puede contener letras minúsculas, números y guiones.' })
  @MaxLength(100, { message: 'El código de organización no puede superar los 100 caracteres.' })
  slug: string;
}
