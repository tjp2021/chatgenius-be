// Socket Events
export enum MessageEvent {
  // Sending/receiving messages
  SEND = 'message:send',
  NEW = 'message:new',
  SENT = 'message:sent',
  DELETED = 'message:deleted',
  
  // Typing indicators
  TYPING_START = 'message:typing:start',
  TYPING_STOP = 'message:typing:stop',
  
  // Delivery status
  DELIVERED = 'message:delivered',
  READ = 'message:read',
  
  // Reactions
  REACTION_ADDED = 'message:reaction:added',
  REACTION_REMOVED = 'message:reaction:removed',
  
  // Threads
  REPLY_CREATED = 'message:reply:created',
  
  // Offline messages
  OFFLINE_MESSAGES = 'message:offline',
  
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