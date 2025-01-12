const { io } = require('socket.io-client');

// The actual session JWT token
const SESSION_TOKEN = 'eyJhbGciOiJSUzI1NiIsImNhdCI6ImNsX0I3ZDRQRDExMUFBQSIsImtpZCI6Imluc18yckhBNmlTQkM5VU1NaUlRRGxjcndEU3FjNWgiLCJ0eXAiOiJKV1QifQ.eyJhenAiOiJodHRwOi8vbG9jYWxob3N0OjMwMDAiLCJleHAiOjE3MzY1NjAyMDksImZ2YSI6WzEsLTFdLCJpYXQiOjE3MzY1NjAxNDksImlzcyI6Imh0dHBzOi8vc3VpdGVkLWxpemFyZC0yOS5jbGVyay5hY2NvdW50cy5kZXYiLCJuYmYiOjE3MzY1NjAxMzksInNpZCI6InNlc3NfMnJTa3FOY0R3STk4RHJaVzFYemNGVlpFTWxBIiwic3ViIjoidXNlcl8yckpxOUtBVTJCc3NxRXdvOFMxSVZ0d3ZMS3EifQ.sx1zrL-BNwh5mZRfnkFhDnBjSDyCy2n24DcYrG1NrKCbutKHeLm_3SaTO5Hf14bzCBvgyR9caSFxkDXQDe_3H75dRQ8okILBbX9q5xSc5K0UHFSp39lwimGR89hPMklvvbeAyZTaxNWlrsFjsd-vzA-Xu5BnlqfoyakcZ1gwcflM5UyVTmIpPMJ5s_Q80IAepF_hcyB2koXDZBbi3w0p8ftpDcoJV1cGnQAia-aq1A-Hc2v_ha6EIDPCpWNCwi9XqKZtJt17d5N6FzuSC43Rrd3lvyAIeBA50FICbFCnVrb2rlCDEK7Y5pJbfiRIq3G7yAiUsArbxj7LD_HrPGMtSQ';

const socket = io('http://localhost:3001', {
  path: '/api/socket/io',
  transports: ['websocket'],
  auth: {
    token: SESSION_TOKEN
  },
  extraHeaders: {
    Authorization: `Bearer ${SESSION_TOKEN}`
  }
});

let connected = false;

socket.on('connect_error', (error) => {
  console.log('Connection Error:', error);
  console.log('Error Details:', {
    message: error.message,
    description: error.description,
    context: error.context
  });
});

socket.on('error', (error) => {
  console.log('Socket Error:', error);
});

socket.on('connect', () => {
  connected = true;
  console.log('Connected!');
  console.log('Socket ID:', socket.id);
  console.log('Auth Status:', socket.auth);
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});

// Debug events
socket.on('connection:starting', (data) => {
  console.log('Connection Starting:', data);
});

socket.on('connection:ready', (data) => {
  console.log('Connection Ready:', data);
});

socket.on('connection:error', (error) => {
  console.log('Connection Error Event:', error);
});

// Keep the process alive
setTimeout(() => {
  if (!connected) {
    console.log('Never connected successfully');
  }
  socket.close();
  process.exit(0);
}, 5000); 