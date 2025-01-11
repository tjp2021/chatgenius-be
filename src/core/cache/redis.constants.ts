export const REDIS_KEYS = {
  MESSAGE_DELIVERY: {
    STATUS: (messageId: string, userId: string) => `message:delivery:${messageId}:${userId}`,
    CACHE: (messageId: string) => `message:delivery:cache:${messageId}`,
  },
  CHANNEL: {
    MEMBERSHIP: (userId: string, channelId: string) => `membership:${userId}:${channelId}`,
    ACTIVITY: (channelId: string) => `activity:${channelId}`,
    LIST: (userId: string) => `channels:${userId}`,
  },
  TYPING: {
    STATUS: (channelId: string) => `typing:${channelId}`,
  },
  OFFLINE: {
    MESSAGES: (userId: string) => `offline:messages:${userId}`,
  },
};

export const REDIS_TTL = {
  DEFAULT: 3600, // 1 hour
  MESSAGE_DELIVERY: 86400, // 24 hours
  CHANNEL_MEMBERSHIP: 300, // 5 minutes
  CHANNEL_ACTIVITY: 300, // 5 minutes
  CHANNEL_LIST: 300, // 5 minutes
  TYPING_STATUS: 5, // 5 seconds
  OFFLINE_MESSAGES: 86400, // 24 hours
}; 