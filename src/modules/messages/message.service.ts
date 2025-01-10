import { Injectable } from '@nestjs/common';
import { EventService } from '../../core/events/event.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { MessageRepository } from './message.repository';
import { Message } from '../../core/events/event.types';

@Injectable()
export class MessageService {
  constructor(
    private repository: MessageRepository,
    private events: EventService
  ) {}

  async create(userId: string, dto: CreateMessageDto): Promise<Message> {
    const message = await this.repository.create({
      content: dto.content,
      channelId: dto.channelId,
      userId,
    });

    // Emit message created event to the channel
    this.events.emit(dto.channelId, 'message.created', message);

    return message;
  }

  async findAll(channelId: string): Promise<Message[]> {
    return this.repository.findByChannelId(channelId);
  }

  async findById(id: string): Promise<Message | null> {
    return this.repository.findById(id);
  }

  async update(id: string, userId: string, content: string): Promise<Message> {
    const message = await this.repository.findById(id);
    if (!message) {
      throw new Error('Message not found');
    }
    if (message.userId !== userId) {
      throw new Error('Cannot update message');
    }

    const updated = await this.repository.update(id, { content });
    
    // Emit message updated event to the channel
    this.events.emit(message.channelId, 'message.updated', updated);

    return updated;
  }

  async delete(id: string, userId: string): Promise<void> {
    const message = await this.repository.findById(id);
    if (!message) {
      throw new Error('Message not found');
    }
    if (message.userId !== userId) {
      throw new Error('Cannot delete message');
    }

    await this.repository.delete(id);
    
    // Emit message deleted event to the channel
    this.events.emit(message.channelId, 'message.deleted', { 
      id, 
      channelId: message.channelId 
    });
  }

  async addReaction(messageId: string, userId: string, reaction: string): Promise<void> {
    const message = await this.repository.findById(messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    await this.repository.addReaction(messageId, userId, reaction);
    
    // Emit reaction added event to the channel
    this.events.emit(message.channelId, 'message.reaction_added', {
      messageId,
      userId,
      reaction,
    });
  }

  async removeReaction(messageId: string, userId: string, reaction: string): Promise<void> {
    const message = await this.repository.findById(messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    await this.repository.removeReaction(messageId, userId, reaction);
    
    // Emit reaction removed event to the channel
    this.events.emit(message.channelId, 'message.reaction_removed', {
      messageId,
      userId,
      reaction,
    });
  }
} 