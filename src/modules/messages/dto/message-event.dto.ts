import { IsOptional, IsEnum } from 'class-validator';
import { CreateMessageDto } from './create-message.dto';
import { MessageDeliveryStatus } from './message-events.enum';

export class MessageEventDto extends CreateMessageDto {
  @IsEnum(MessageDeliveryStatus)
  @IsOptional()
  deliveryStatus?: MessageDeliveryStatus;
} 