import io from 'socket.io-client';

async function initializeWebSocket() {
  console.log('Attempting to connect to WebSocket server...');
  
  const socket = io('http://localhost:3002', {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 10000,
  });

  // Connection events
  socket.on('connect', () => {
    console.log('Connected to WebSocket server');
    console.log('Socket ID:', socket.id);
  });

  socket.on('connect_error', (error) => {
    console.error('Connection error:', error.message);
  });

  socket.on('disconnect', (reason) => {
    console.log('Disconnected from WebSocket server:', reason);
  });
}

// Start the client
initializeWebSocket();