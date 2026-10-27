import { ParseIdPipe } from '@/common/pipes/parse-id.pipe';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser, AuthUser } from '@/common/auth';
import { ForumsService } from './forums.service';
import { CreateThreadDto } from './dto/create-thread.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { UpdateThreadDto } from './dto/update-thread.dto';
import { SearchForumDto } from './dto/search-forum.dto';

@Controller()
export class ForumsController {
  constructor(private readonly forums: ForumsService) {}

  @Get('subjects/:subjectId/forum/threads')
  async listThreads(
    @Param('subjectId', ParseIdPipe) subjectId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.forums.listThreads(subjectId, user.userId);
  }

  @Post('subjects/:subjectId/forum/threads')
  async createThread(
    @Param('subjectId', ParseIdPipe) subjectId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateThreadDto,
  ) {
    return this.forums.createThread(subjectId, user.userId, dto);
  }

  // Declared before the parametrised search-less routes so Nest's router does
  // not treat "search" as a courseId — but these live under distinct paths so
  // order is not actually load-bearing here.
  @Get('subjects/:subjectId/forum/search')
  async search(
    @Param('subjectId', ParseIdPipe) subjectId: string,
    @CurrentUser() user: AuthUser,
    @Query() query: SearchForumDto,
  ) {
    return this.forums.search(subjectId, user.userId, query.q);
  }

  @Get('threads/:id')
  async getThread(@Param('id', ParseIdPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.forums.getThread(id, user.userId);
  }

  @Patch('threads/:id')
  async updateThread(
    @Param('id', ParseIdPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateThreadDto,
  ) {
    return this.forums.updateThread(id, user.userId, dto);
  }

  @Post('threads/:id/posts')
  async addPost(
    @Param('id', ParseIdPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePostDto,
  ) {
    return this.forums.addPost(id, user.userId, dto);
  }

  @Patch('threads/:id/pin')
  async togglePin(@Param('id', ParseIdPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.forums.togglePin(id, user.userId);
  }

  @Delete('threads/:id')
  async deleteThread(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.forums.deleteThread(id, user.userId);
    return { deleted: true };
  }

  @Patch('posts/:id')
  async updatePost(
    @Param('id', ParseIdPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdatePostDto,
  ) {
    return this.forums.updatePost(id, user.userId, dto);
  }

  @Delete('posts/:id')
  async deletePost(@Param('id', ParseIdPipe) id: string, @CurrentUser() user: AuthUser) {
    await this.forums.deletePost(id, user.userId);
    return { deleted: true };
  }
}
