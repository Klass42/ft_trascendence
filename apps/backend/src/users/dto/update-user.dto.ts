import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { GlobalRole } from '@prisma/client';

export class UpdateUserDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  name?: string;

  @IsEmail({ require_tld: false })
  @IsOptional()
  email?: string;

  @IsEnum(GlobalRole)
  @IsOptional()
  role?: GlobalRole;

  @IsString()
  @IsOptional()
  bio?: string;
}
