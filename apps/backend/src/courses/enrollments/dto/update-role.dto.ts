import { IsEnum } from 'class-validator';
import { CourseRole } from '@prisma/client';

export class UpdateRoleDto {
  @IsEnum(CourseRole)
  role: CourseRole;
}
