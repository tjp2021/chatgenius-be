import { IsString, IsOptional, IsUUID, IsEnum } from 'class-validator';
import { MessageDeliveryStatus } from './message-events.enum';

export class CreateMessageDto {
  @IsString()
  content: string;

  @IsUUID()
  channelId: string;

  @IsUUID()
  @IsOptional()
  parentId?: string;

  @IsEnum(MessageDeliveryStatus)
  @IsOptional()
  deliveryStatus?: MessageDeliveryStatus;
} 