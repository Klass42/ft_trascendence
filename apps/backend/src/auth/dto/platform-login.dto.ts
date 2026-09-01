import { IsEmail, IsString, MinLength } from 'class-validator';

/** Deliberately separate from tenant login: platform accounts have no tenant. */
export class PlatformLoginDto {
  @IsEmail({ require_tld: false })
  email: string;

  @IsString()
  @MinLength(1)
  password: string;
}
