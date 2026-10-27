import { OrgLogoUrl } from '../../common/validation/org-fields';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateOrganizationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100, { message: 'El nombre de la organización no puede superar los 100 caracteres.' })
  @IsOptional()
  name?: string;

  /** https only; '' or null clears the logo. */
  @OrgLogoUrl()
  logoUrl?: string | null;
}
