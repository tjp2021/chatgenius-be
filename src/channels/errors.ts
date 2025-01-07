import { HttpException, HttpStatus } from '@nestjs/common';

export class ChannelAccessDeniedException extends HttpException {
  constructor(message: string = 'Access to this channel is denied') {
    super(message, HttpStatus.FORBIDDEN);
  }
}

export class ChannelNotFoundException extends HttpException {
  constructor(message: string = 'Channel not found') {
    super(message, HttpStatus.NOT_FOUND);
  }
}

export class ChannelDeletedException extends HttpException {
  constructor(message: string = 'This channel has been deleted') {
    super(message, HttpStatus.GONE);
  }
}

export class ChannelTransitionFailedException extends HttpException {
  constructor(
    message: string = 'Failed to transition to the next channel',
    public readonly nextAttemptDelay: number = 1000,
    public readonly remainingAttempts: number = 2
  ) {
    super(
      {
        message,
        nextAttemptDelay,
        remainingAttempts,
        timestamp: new Date().toISOString(),
      },
      HttpStatus.SERVICE_UNAVAILABLE
    );
  }
}

export class NetworkConnectivityException extends HttpException {
  constructor(message: string = 'Network connectivity issues detected') {
    super(
      {
        message,
        retry: true,
        timestamp: new Date().toISOString(),
      },
      HttpStatus.SERVICE_UNAVAILABLE
    );
  }
}

export class ChannelCapacityException extends HttpException {
  constructor(message: string = 'Channel has reached maximum capacity') {
    super(message, HttpStatus.CONFLICT);
  }
}

export interface TransitionError {
  channelId: string;
  error: string;
  timestamp: Date;
  attemptCount: number;
  lastAttempt: Date;
}