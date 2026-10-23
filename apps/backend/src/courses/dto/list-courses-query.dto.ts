import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ListCoursesQueryDto {
  @IsIn(['PLANNED', 'ACTIVE', 'ARCHIVED'], {
    message: 'El estado debe ser PLANNED, ACTIVE o ARCHIVED.',
  })
  @IsOptional()
  status?: string;

  @IsString({ message: 'La búsqueda debe ser texto.' })
  @MaxLength(100, { message: 'La búsqueda no puede superar los 100 caracteres.' })
  @IsOptional()
  search?: string;
}
