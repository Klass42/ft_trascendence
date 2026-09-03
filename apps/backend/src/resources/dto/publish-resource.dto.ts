import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class PublishResourceDto {
  @IsString()
  courseId: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  order?: number;

  @IsBoolean()
  @IsOptional()
  required?: boolean;
}
