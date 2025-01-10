import { IsUUID, IsEnum } from 'class-validator';
import { MessageDeliveryStatus } from '../dto/message-events.enum';

export class MessageDeliveryDto {
  @IsUUID()
  messageId: string;

  @IsEnum(MessageDeliveryStatus)
  status: MessageDeliveryStatus;

  @IsUUID()
  channelId: string;
} 