import { SubjectStaffRole } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateStaffRoleDto {
  @IsEnum(SubjectStaffRole)
  role: SubjectStaffRole;
}
