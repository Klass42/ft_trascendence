import { SubjectStaffRole } from '@prisma/client';
import { IsEnum, IsString, Matches } from 'class-validator';
import { ID_PATTERN } from '@/common/validation/id';

export class AddStaffDto {
  @IsString({ message: 'El identificador del usuario debe ser texto.' })
  @Matches(ID_PATTERN, { message: 'El identificador del usuario debe tener un formato válido.' })
  userId: string;

  @IsEnum(SubjectStaffRole)
  role: SubjectStaffRole;
}
