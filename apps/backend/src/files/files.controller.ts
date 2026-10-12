// Owner: Aloiki (@illia) — Content & UX; migrated to @CurrentUser by Jorge (Epic 2)
import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FilesService } from './files.service';
import { CurrentUser, AuthUser } from '@/common/auth';
import { MAX_UPLOAD_BYTES } from './file-validation';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    return this.filesService.createUpload(file, user.organizationId, user.userId);
  }

  @Get(':id/url')
  async getUrl(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.filesService.getSignedUrl(id, user);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.filesService.delete(id, user.organizationId, user.userId);
    return { deleted: true };
  }
}
