// Owner: Aloiki (@illia) — Content & UX; migrated to @CurrentUser by Jorge (Epic 2)
import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseInterceptors,
  UploadedFile,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { FilesService } from './files.service';
import { CurrentUser, AuthUser, Public } from '@/common/auth';
import { MAX_UPLOAD_BYTES } from './file-validation';
import { SignedFileContentQueryDto } from './dto/signed-file-content-query.dto';
import { ResolveFileUrlQueryDto } from './dto/resolve-file-url-query.dto';
import { contentDisposition } from './file-headers';

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

  @Get('resolve-url')
  async resolveUrl(
    @Query() query: ResolveFileUrlQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.filesService.getSignedUrlByObjectKey(query.objectKey, user);
  }

  @Public()
  @Get(':id/content')
  async getContent(
    @Param('id') id: string,
    @Query() query: SignedFileContentQueryDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { file, stream } = await this.filesService.getContent(
      id,
      query.organizationId,
      query.expires,
      query.signature,
    );
    response.setHeader('Content-Type', file.contentType || 'application/octet-stream');
    response.setHeader('Content-Length', file.sizeBytes.toString());
    response.setHeader('Content-Disposition', contentDisposition(file.originalName));
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'private, no-store');
    return new StreamableFile(stream);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.filesService.delete(id, user.organizationId, user.userId);
    return { deleted: true };
  }
}
