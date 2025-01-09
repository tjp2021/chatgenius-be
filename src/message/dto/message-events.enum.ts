// Socket Events
export enum MessageEvent {
  // Sending/receiving messages
  SEND = 'message:send',
  NEW = 'message:new',
  SENT = 'message:sent',
  
  // Typing indicators
  TYPING_START = 'message:typing:start',
  TYPING_STOP = 'message:typing:stop',
  
  // Delivery status
  DELIVERED = 'message:delivered',
  READ = 'message:read',
  
  // Error events
  ERROR = 'message:error'
}

// Message Status (matches Prisma schema)
export enum MessageDeliveryStatus {
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  FAILED = 'FAILED'
} 