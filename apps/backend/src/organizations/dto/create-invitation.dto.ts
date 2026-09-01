import { IsEmail, IsIn } from 'class-validator';
export class CreateInvitationDto { @IsEmail({ require_tld: false }) email: string; @IsIn(['ADMIN', 'TEACHER', 'STUDENT']) role: 'ADMIN' | 'TEACHER' | 'STUDENT'; }
