import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ID_PATTERN } from '@/common/validation/id';

const ID_MESSAGE = { message: 'El identificador debe tener un formato válido.' };

export class CreateFolderDto {
  @IsString()
  @MinLength(1, { message: 'El nombre de la carpeta es obligatorio.' })
  @MaxLength(120, { message: 'El nombre de la carpeta no puede superar los 120 caracteres.' })
  name: string;

  @IsString()
  @Matches(ID_PATTERN, ID_MESSAGE)
  @IsOptional()
  parentId?: string;
}

export class UpdateFolderDto {
  @IsString()
  @MinLength(1, { message: 'El nombre de la carpeta es obligatorio.' })
  @MaxLength(120, { message: 'El nombre de la carpeta no puede superar los 120 caracteres.' })
  @IsOptional()
  name?: string;

  /** `null` moves the folder to the root. */
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @Matches(ID_PATTERN, ID_MESSAGE)
  parentId?: string | null;
}

export class PublishFolderDto {
  @IsString()
  @Matches(ID_PATTERN, { message: 'El identificador de la asignatura debe tener un formato válido.' })
  subjectId: string;

  @IsBoolean()
  @IsOptional()
  required?: boolean;
}

export class BatchDeleteDto {
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @Matches(ID_PATTERN, { each: true, ...ID_MESSAGE })
  @IsOptional()
  resourceIds?: string[];

  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @Matches(ID_PATTERN, { each: true, ...ID_MESSAGE })
  @IsOptional()
  folderIds?: string[];
}
