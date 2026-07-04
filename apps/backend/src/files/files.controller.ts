import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FilesService } from './files.service';
import { CreateFileDto } from './dto/create-file.dto';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateFileDto,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    return this.filesService.createUpload(
      file,
      dto.organizationId,
      dto.uploaderId,
    );
  }

  @Get(':id/url')
  async getUrl(@Param('id') id: string) {
    return this.filesService.getSignedUrl(id);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.filesService.delete(id);
    return { deleted: true };
  }
}
