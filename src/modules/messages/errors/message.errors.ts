import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';

export class MessageNotFoundException extends NotFoundException {
  constructor(messageId: string) {
    super(`Message with ID ${messageId} not found`);
  }
}

export class ThreadNotFoundException extends NotFoundException {
  constructor(messageId: string) {
    super(`Thread with message ID ${messageId} not found`);
  }
}

export class MessageAccessDeniedException extends ForbiddenException {
  constructor(messageId: string, userId: string) {
    super(`User ${userId} does not have access to message ${messageId}`);
  }
}

export class InvalidMessageOperationException extends BadRequestException {
  constructor(message: string) {
    super(message);
  }
}

export class MessageDeliveryException extends BadRequestException {
  constructor(messageId: string, error: string) {
    super(`Failed to deliver message ${messageId}: ${error}`);
  }
} 