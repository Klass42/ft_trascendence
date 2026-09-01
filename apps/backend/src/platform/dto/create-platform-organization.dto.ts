import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';
export class CreatePlatformOrganizationDto {
  @IsString() @MinLength(1) name: string;
  @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) slug: string;
  @IsEmail({ require_tld: false }) adminEmail: string;
  @IsString() @MinLength(1) adminName: string;
  @IsOptional() @IsString() logoUrl?: string;
  @IsOptional() @IsString() primaryColor?: string;
  @IsOptional() @IsString() defaultLanguage?: string;
  @IsOptional() @IsString() timezone?: string;
}
