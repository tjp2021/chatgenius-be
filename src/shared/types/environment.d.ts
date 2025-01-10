declare global {
  namespace NodeJS {
    interface ProcessEnv {
      FRONTEND_URL: string;
      SOCKET_URL: string;
      // Add other env variables here
    }
  }
}

export {}; 