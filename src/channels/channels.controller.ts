import { Controller, Get, Post, Body, Param, Query, Delete, UseGuards } from '@nestjs/common';
import { ChannelsService } from './channels.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { ChannelType } from '@prisma/client';
import { ClerkGuard } from '../auth/clerk.guard';
import { User } from '../decorators/user.decorator';
import { UserId } from '../decorators/user-id.decorator';
import { ChannelMetadataDto } from './dto/channel-metadata.dto';
import { DMHandlerService } from './dm-handler.service';
import { DMParticipantStatus, EnrichedDMChannel } from './types/dm.types';
import { CreateMessageDto } from './dto/create-message.dto';
import { MessageReactionDto } from './dto/message-reaction.dto';
import { CreateThreadReplyDto, ThreadResponseDto } from './dto/message-thread.dto';
import { MessageReadReceiptDto, MessageReadStatusDto } from './dto/message-read.dto';
import { MessageService } from '../message/message.service';

@Controller('channels')
@UseGuards(ClerkGuard)
export class ChannelsController {
  constructor(
    private readonly channelsService: ChannelsService,
    private readonly dmHandler: DMHandlerService,
    private readonly messageService: MessageService,
  ) {}

  @Post()
  create(@User() user: { id: string }, @Body() dto: CreateChannelDto) {
    return this.channelsService.create(user.id, dto);
  }

  @Get()
  findAll(
    @User() user: { id: string },
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: 'memberCount' | 'messages' | 'createdAt' | 'name' | 'lastActivity',
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('type') type?: ChannelType,
  ) {
    return this.channelsService.findAll(user.id, { search, sortBy, sortOrder, type });
  }

  @Get(':id')
  findOne(@User() user: { id: string }, @Param('id') id: string) {
    return this.channelsService.findOne(user.id, id);
  }

  @Post(':id/join')
  join(@User() user: { id: string }, @Param('id') id: string) {
    return this.channelsService.join(user.id, id);
  }

  @Delete(':id/leave')
  leave(
    @User() user: { id: string }, 
    @Param('id') id: string,
    @Query('shouldDelete') shouldDelete?: boolean
  ) {
    return this.channelsService.leave(user.id, id, shouldDelete);
  }

  @Post(':id/read')
  async markAsRead(@User() user: { id: string }, @Param('id') id: string) {
    await this.channelsService.markChannelAsRead(user.id, id);
    return { success: true };
  }

  @Get(':id/unread')
  async getUnreadCount(@User() user: { id: string }, @Param('id') id: string) {
    const count = await this.channelsService.getUnreadCount(user.id, id);
    return { count };
  }

  @Get(':id/activity')
  async getActivity(@Param('id') id: string) {
    return this.channelsService.getChannelActivity(id);
  }

  @Get(':channelId/metadata')
  async getChannelMetadata(
    @UserId() userId: string,
    @Param('channelId') channelId: string,
  ): Promise<ChannelMetadataDto> {
    return this.channelsService.getChannelMetadata(userId, channelId);
  }

  @Get('dm/:userId')
  async checkExistingDM(
    @User() user: { id: string },
    @Param('userId') targetUserId: string
  ): Promise<{ channel: EnrichedDMChannel | null }> {
    const channel = await this.dmHandler.findExistingDM(user.id, targetUserId);
    return { channel };
  }

  @Get(':channelId/participants/status')
  async getDMParticipantStatus(
    @User() user: { id: string },
    @Param('channelId') channelId: string
  ): Promise<DMParticipantStatus> {
    return this.dmHandler.getDMParticipantStatus(channelId);
  }

  @Post(':channelId/typing')
  async setTypingStatus(
    @User() user: { id: string },
    @Param('channelId') channelId: string,
    @Body('isTyping') isTyping: boolean
  ) {
    return this.dmHandler.setTypingStatus(channelId, user.id, isTyping);
  }

  @Get(':channelId/typing')
  async getTypingStatus(
    @User() user: { id: string },
    @Param('channelId') channelId: string
  ) {
    return this.dmHandler.getTypingStatus(channelId);
  }

  @Post(':channelId/messages/:messageId/read')
  async markMessageAsRead(
    @User() user: { id: string },
    @Param('channelId') channelId: string,
    @Param('messageId') messageId: string
  ): Promise<MessageReadReceiptDto> {
    return this.messageService.markAsRead(messageId, user.id);
  }

  @Get(':channelId/messages/:messageId/read')
  async getMessageReadStatus(
    @User() user: { id: string },
    @Param('channelId') channelId: string,
    @Param('messageId') messageId: string
  ): Promise<MessageReadStatusDto> {
    return this.messageService.getReadStatus(messageId, user.id);
  }

  @Get(':channelId/messages/:messageId/thread')
  async getMessageThread(
    @User() user: { id: string },
    @Param('channelId') channelId: string,
    @Param('messageId') messageId: string
  ): Promise<ThreadResponseDto> {
    return this.messageService.getThread(messageId, user.id);
  }

  @Post(':channelId/messages/:messageId/reply')
  async createThreadReply(
    @User() user: { id: string },
    @Param('channelId') channelId: string,
    @Param('messageId') messageId: string,
    @Body() dto: CreateThreadReplyDto
  ) {
    return this.messageService.createReply(messageId, user.id, dto.content);
  }

  @Get(':channelId/threads')
  async getThreadedMessages(
    @User() user: { id: string },
    @Param('channelId') channelId: string
  ) {
    return this.messageService.getThreadedMessages(channelId, user.id);
  }

  @Post(':channelId/messages')
  async createMessage(
    @User() user: { id: string },
    @Param('channelId') channelId: string,
    @Body() dto: CreateMessageDto
  ) {
    return this.messageService.create(user.id, { ...dto, channelId });
  }

  @Get(':channelId/messages')
  async getMessages(
    @User() user: { id: string },
    @Param('channelId') channelId: string
  ) {
    return this.messageService.getChannelMessages(channelId, user.id);
  }

  @Delete(':channelId/messages/:messageId')
  async deleteMessage(
    @User() user: { id: string },
    @Param('channelId') channelId: string,
    @Param('messageId') messageId: string
  ) {
    await this.messageService.delete(messageId, user.id);
    return { success: true };
  }

  @Post(':channelId/messages/:messageId/reactions')
  async addReaction(
    @User() user: { id: string },
    @Param('channelId') channelId: string,
    @Param('messageId') messageId: string,
    @Body() dto: MessageReactionDto
  ) {
    return this.messageService.addReaction(messageId, user.id, dto.emoji);
  }

  @Delete(':channelId/messages/:messageId/reactions/:reactionId')
  async removeReaction(
    @User() user: { id: string },
    @Param('channelId') channelId: string,
    @Param('messageId') messageId: string,
    @Param('reactionId') reactionId: string
  ) {
    await this.messageService.removeReaction(messageId, reactionId, user.id);
    return { success: true };
  }

  @Get(':channelId/messages/:messageId/reactions')
  getReactions(@Param('messageId') messageId: string) {
    return this.messageService.getReactions(messageId);
  }
}