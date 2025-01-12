import { EnrichedDMChannel, DMTypingEvent, DMTypingStatus, DMReadReceiptEvent, DMReadReceipt, DMThread, DMThreadMessage } from '../types/dm.types';
import { CreateChannelDto } from '../dto/create-channel.dto';

// Core DM operations
export interface IDMCore {
  create(userId: string, dto: CreateChannelDto): Promise<EnrichedDMChannel>;
  findExistingDM(userId: string, targetUserId: string): Promise<EnrichedDMChannel | null>;
  enrichDMData(channelData: any): Promise<EnrichedDMChannel>;
  getDMChannels(userId: string): Promise<EnrichedDMChannel[]>;
}

// Typing status management
export interface IDMTyping {
  setTypingStatus(channelId: string, userId: string, isTyping: boolean): Promise<DMTypingEvent>;
  getTypingStatus(channelId: string): Promise<DMTypingStatus | null>;
}

// Read receipt management
export interface IDMReadReceipt {
  markMessageAsRead(channelId: string, messageId: string, userId: string): Promise<DMReadReceiptEvent>;
  getReadReceipts(channelId: string, messageId: string): Promise<DMReadReceipt[]>;
}

// Thread management
export interface IDMThread {
  getMessageThread(channelId: string, messageId: string): Promise<DMThread>;
  getThreadedMessages(channelId: string): Promise<DMThreadMessage[]>;
}

// Cache operations (SRP: separate caching concerns)
export interface IDMCache {
  invalidateChannelLists(userIds: string[]): Promise<void>;
  getCachedChannels(userId: string): Promise<EnrichedDMChannel[] | null>;
  setCachedChannels(userId: string, channels: EnrichedDMChannel[]): Promise<void>;
  invalidateTypingStatus(channelId: string): Promise<void>;
  getCachedTypingStatus(channelId: string): Promise<DMTypingStatus | null>;
  setCachedTypingStatus(channelId: string, status: DMTypingStatus): Promise<void>;
}

// Event handling (SRP: separate event concerns)
export interface IDMEventHandler {
  handleTypingEvent(event: DMTypingEvent): Promise<void>;
  handleReadReceiptEvent(event: DMReadReceiptEvent): Promise<void>;
  handleThreadEvent(threadId: string, event: any): Promise<void>;
} 