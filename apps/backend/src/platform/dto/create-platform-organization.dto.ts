import { IsEmail, IsIn, IsInt, IsOptional, IsString, Matches, Min, MinLength } from 'class-validator';
export class CreatePlatformOrganizationDto {
  @IsString() @MinLength(1) name: string;
  @IsString() @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) slug: string;
  @IsEmail({ require_tld: false }) adminEmail: string;
  @IsString() @MinLength(1) adminName: string;
  @IsOptional() @IsString() logoUrl?: string;
  @IsOptional() @IsString() primaryColor?: string;
  @IsOptional() @IsString() defaultLanguage?: string;
  @IsOptional() @IsString() timezone?: string;
  // Custom plans/limits (issue #18). Omit a limit to leave it unlimited.
  @IsOptional() @IsIn(['STARTER', 'GROWTH', 'ENTERPRISE', 'CUSTOM']) plan?: 'STARTER' | 'GROWTH' | 'ENTERPRISE' | 'CUSTOM';
  @IsOptional() @IsInt() @Min(1) maxUsers?: number;
  @IsOptional() @IsInt() @Min(1) maxCourses?: number;
  @IsOptional() @IsInt() @Min(1) maxStorageMb?: number;
}
