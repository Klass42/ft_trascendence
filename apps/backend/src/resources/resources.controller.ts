import { ParseIdPipe } from '@/common/pipes/parse-id.pipe';
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AuthUser, CurrentUser } from '@/common/auth';
import { CreateResourceDto } from './dto/create-resource.dto';
import { ListResourcesDto } from './dto/list-resources.dto';
import { PublishResourceDto } from './dto/publish-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';
import { ResourcesService } from './resources.service';
import { ResourceFoldersService } from './resource-folders.service';
import { BatchDeleteDto, CreateFolderDto, PublishFolderDto, UpdateFolderDto } from './dto/folder.dto';

@Controller()
export class ResourcesController {
  constructor(
    private readonly resources: ResourcesService,
    private readonly folders: ResourceFoldersService,
  ) {}

  // --- Folders (#26) -------------------------------------------------------

  @Get('resource-folders')
  findFolders(@CurrentUser() user: AuthUser) {
    return this.folders.findAll(user);
  }

  @Post('resource-folders')
  createFolder(@Body() dto: CreateFolderDto, @CurrentUser() user: AuthUser) {
    return this.folders.create(dto, user);
  }

  @Patch('resource-folders/:id')
  updateFolder(@Param('id', ParseIdPipe) id: string, @Body() dto: UpdateFolderDto, @CurrentUser() user: AuthUser) {
    return this.folders.update(id, dto, user);
  }

  @Delete('resource-folders/:id')
  async removeFolder(@Param('id', ParseIdPipe) id: string, @CurrentUser() user: AuthUser) {
    await this.folders.remove(id, user);
    return { deleted: true };
  }

  @Post('resource-folders/:id/subjects')
  publishFolder(@Param('id', ParseIdPipe) id: string, @Body() dto: PublishFolderDto, @CurrentUser() user: AuthUser) {
    return this.folders.publishToSubject(id, dto, user);
  }

  @Delete('resource-folders/:id/subjects/:subjectId')
  async unpublishFolder(
    @Param('id', ParseIdPipe) id: string,
    @Param('subjectId', ParseIdPipe) subjectId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.folders.removeFromSubject(id, subjectId, user);
    return { deleted: true };
  }

  /** Declared before `resources/:id` routes; POST avoids DELETE-with-body proxies. */
  @Post('resources/batch-delete')
  batchDelete(@Body() dto: BatchDeleteDto, @CurrentUser() user: AuthUser) {
    return this.folders.batchDelete(dto, user);
  }

  // --- Resources -----------------------------------------------------------

  @Get('resources')
  findAll(@Query() query: ListResourcesDto, @CurrentUser() user: AuthUser) {
    return this.resources.findAll(query, user);
  }

  @Post('resources')
  create(@Body() dto: CreateResourceDto, @CurrentUser() user: AuthUser) {
    return this.resources.create(dto, user);
  }

  @Get('resources/:id')
  findOne(@Param('id', ParseIdPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.resources.findOne(id, user);
  }

  @Patch('resources/:id')
  update(
    @Param('id', ParseIdPipe) id: string,
    @Body() dto: UpdateResourceDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.resources.update(id, dto, user);
  }

  @Delete('resources/:id')
  async remove(@Param('id', ParseIdPipe) id: string, @CurrentUser() user: AuthUser) {
    await this.resources.remove(id, user);
    return { deleted: true };
  }

  @Post('resources/:id/subjects')
  publishToSubject(
    @Param('id', ParseIdPipe) id: string,
    @Body() dto: PublishResourceDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.resources.publishToSubject(id, dto.subjectId, dto, user);
  }

  @Delete('resources/:id/subjects/:subjectId')
  async removeFromSubject(
    @Param('id', ParseIdPipe) id: string,
    @Param('subjectId', ParseIdPipe) subjectId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.resources.removeFromSubject(id, subjectId, user);
    return { deleted: true };
  }

  @Get('subjects/:subjectId/resources')
  findForSubject(
    @Param('subjectId', ParseIdPipe) subjectId: string,
    @Query() query: ListResourcesDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.resources.findForSubject(subjectId, query, user);
  }
}
