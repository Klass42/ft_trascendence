import { IsEmail } from 'class-validator';
export class CreatePlatformOrganizationAdminDto {
  @IsEmail({ require_tld: false }) email: string;
}
