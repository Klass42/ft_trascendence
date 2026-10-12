import { IsEnum } from 'class-validator';
import { SubjectStaffRole } from '@prisma/client';

export class UpdateRoleDto {
  @IsEnum(SubjectStaffRole)
  role: SubjectStaffRole;
}
