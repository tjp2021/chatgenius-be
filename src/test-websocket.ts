import { Manager } from 'socket.io-client';
import io from 'socket.io-client';

async function testWebSocketConnection() {
  console.log('Starting WebSocket connection test...');


  /* DO NOT FUCKING TOUCH THIS CONFIG PATH. DO NOT FUCKING EDIT IT. THE CORRECT PATH IS /socket.io*/
  const socket = io('http://localhost:3002', {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 10000,
    auth: {
      token: 'Bearer your-clerk-jwt-here',
      userId: 'your-clerk-user-id'
    }
  });

  // Connection events
  socket.on('connect', () => {
    console.log('Connected to WebSocket server');
    console.log('Socket ID:', socket.id);
  });

  socket.on('connection:success', (data) => {
    console.log('Connection successful:', data);
  });

  socket.on('connection:error', (error) => {
    console.error('Connection error:', error);
    if (error.reconnectAttempt >= 5) {
      console.error('Max reconnection attempts reached');
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('Disconnected:', reason);
    if (reason === 'io server disconnect') {
      console.log('Server initiated disconnect');
    }
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });

  // Test message sending
  setTimeout(() => {
    console.log('Attempting to send test message...');
    socket.emit('message:send', {
      content: 'Test message',
      channelId: 'test-channel',
      tempId: 'test-' + Date.now()
    });
  }, 2000);

  // Listen for message responses
  socket.on('message:delivered', (data) => {
    console.log('Message delivered:', data);
  });

  socket.on('message:created', (data) => {
    console.log('Message created:', data);
  });

  socket.on('message:failed', (data) => {
    console.error('Message failed:', data);
  });

  // Cleanup after tests
  setTimeout(() => {
    console.log('Closing connection...');
    socket.close();
  }, 10000);
}

// Run the test
testWebSocketConnection().catch(console.error); 