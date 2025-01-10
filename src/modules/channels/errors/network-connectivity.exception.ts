import { HttpException, HttpStatus } from '@nestjs/common';

export class NetworkConnectivityException extends HttpException {
  constructor(message: string = 'Network connectivity error') {
    super(message, HttpStatus.SERVICE_UNAVAILABLE);
  }
} 