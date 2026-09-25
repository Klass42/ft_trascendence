import { SubjectStaffRole } from '@prisma/client';
import { IsEnum, IsString, MinLength } from 'class-validator';

export class AddStaffDto {
  @IsString()
  @MinLength(1)
  userId: string;

  @IsEnum(SubjectStaffRole)
  role: SubjectStaffRole;
}
