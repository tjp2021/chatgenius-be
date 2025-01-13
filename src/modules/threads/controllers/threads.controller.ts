import { Controller, Get, Post, Body, Param, UseGuards, Req, Query } from '@nestjs/common';
import { ThreadsService } from '../services/threads.service';
import { ClerkAuthGuard } from '../../../guards/clerk-auth.guard';
import { ThreadResponseDto, ThreadReplyDto } from '../dto/thread-response.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('threads')
@Controller('threads')
@UseGuards(ClerkAuthGuard)
export class ThreadsController {
  constructor(private readonly threadsService: ThreadsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a thread from a message' })
  @ApiResponse({ status: 201, type: ThreadResponseDto })
  async createThread(@Req() req: any, @Body() data: { messageId: string }) {
    return this.threadsService.createThread(req.auth.userId, data.messageId);
  }

  @Get(':threadId')
  @ApiOperation({ summary: 'Get thread details and replies' })
  @ApiResponse({ status: 200, type: ThreadResponseDto })
  async getThread(@Req() req: any, @Param('threadId') threadId: string) {
    return this.threadsService.getThread(threadId);
  }

  @Get(':threadId/replies')
  @ApiOperation({ summary: 'Get thread replies' })
  @ApiResponse({ status: 200, type: [ThreadReplyDto] })
  async getReplies(
    @Req() req: any,
    @Param('threadId') threadId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string
  ) {
    return this.threadsService.getReplies(
      threadId,
      req.auth.userId,
      cursor,
      limit ? parseInt(limit, 10) : undefined
    );
  }

  @Post(':threadId/replies')
  @ApiOperation({ summary: 'Add a reply to a thread' })
  @ApiResponse({ status: 201, type: ThreadResponseDto })
  async addReply(
    @Req() req: any,
    @Param('threadId') threadId: string,
    @Body() data: { content: string }
  ) {
    return this.threadsService.addReply(threadId, req.auth.userId, data.content);
  }
} 