import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ForumsService } from './forums.service';
import { CreateThreadDto } from './dto/create-thread.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { SearchForumDto } from './dto/search-forum.dto';

@Controller()
export class ForumsController {
  constructor(private readonly forums: ForumsService) {}

  @Get('courses/:courseId/forum/threads')
  async listThreads(
    @Param('courseId') courseId: string,
    // TODO(auth): @CurrentUser() (Jorge)
    @Headers('x-dev-user') actingUserId: string,
  ) {
    return this.forums.listThreads(courseId, this.requireUser(actingUserId));
  }

  @Post('courses/:courseId/forum/threads')
  async createThread(
    @Param('courseId') courseId: string,
    // TODO(auth): @CurrentUser() (Jorge)
    @Headers('x-dev-user') actingUserId: string,
    @Body() dto: CreateThreadDto,
  ) {
    return this.forums.createThread(courseId, this.requireUser(actingUserId), dto);
  }

  // Declared before the parametrised search-less routes so Nest's router does
  // not treat "search" as a courseId — but these live under distinct paths so
  // order is not actually load-bearing here.
  @Get('courses/:courseId/forum/search')
  async search(
    @Param('courseId') courseId: string,
    // TODO(auth): @CurrentUser() (Jorge)
    @Headers('x-dev-user') actingUserId: string,
    @Query() query: SearchForumDto,
  ) {
    return this.forums.search(courseId, this.requireUser(actingUserId), query.q);
  }

  @Get('threads/:id')
  async getThread(
    @Param('id') id: string,
    // TODO(auth): @CurrentUser() (Jorge)
    @Headers('x-dev-user') actingUserId: string,
  ) {
    return this.forums.getThread(id, this.requireUser(actingUserId));
  }

  @Post('threads/:id/posts')
  async addPost(
    @Param('id') id: string,
    // TODO(auth): @CurrentUser() (Jorge)
    @Headers('x-dev-user') actingUserId: string,
    @Body() dto: CreatePostDto,
  ) {
    return this.forums.addPost(id, this.requireUser(actingUserId), dto);
  }

  @Patch('threads/:id/pin')
  async togglePin(
    @Param('id') id: string,
    // TODO(auth): @CurrentUser() (Jorge)
    @Headers('x-dev-user') actingUserId: string,
  ) {
    return this.forums.togglePin(id, this.requireUser(actingUserId));
  }

  /**
   * Temporary identity gate — mirrors the other controllers. Without a user id
   * every membership lookup would run with `userId: undefined`, so an empty
   * header is a hard 401 rather than a silent cross-user action.
   * TODO(auth): drop this once @CurrentUser() guarantees identity (Jorge).
   */
  private requireUser(actingUserId?: string): string {
    if (!actingUserId) {
      throw new UnauthorizedException('Missing x-dev-user header');
    }
    return actingUserId;
  }
}
