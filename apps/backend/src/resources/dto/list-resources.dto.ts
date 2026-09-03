import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { LearningResourceStatus, LearningResourceType } from '@prisma/client';

export class ListResourcesDto {
  @IsString()
  @MaxLength(200)
  @IsOptional()
  search?: string;

  @IsEnum(LearningResourceType)
  @IsOptional()
  type?: LearningResourceType;

  @IsEnum(LearningResourceStatus)
  @IsOptional()
  status?: LearningResourceStatus;
}
