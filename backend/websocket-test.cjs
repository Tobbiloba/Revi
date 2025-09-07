// WebSocket Client Test for Revi Backend
const io = require('socket.io-client');

console.log('🔗 Starting WebSocket connection test...\n');

// Connect to the WebSocket server
const socket = io('http://localhost:4000', {
  transports: ['websocket', 'polling'],
  autoConnect: true,
  reconnection: true
});

// Track connection status
socket.on('connect', () => {
  console.log('✅ Connected to WebSocket server');
  console.log('📡 Socket ID:', socket.id);
  
  // Subscribe to project 4 (our test project)
  console.log('\n🔗 Subscribing to project 4...');
  socket.emit('subscribe:project', 4);
});

socket.on('disconnect', (reason) => {
  console.log('❌ Disconnected from WebSocket server:', reason);
});

socket.on('connect_error', (error) => {
  console.log('🚨 Connection error:', error.message);
});

// Listen for real-time error events
socket.on('error:new', (error) => {
  console.log('\n🔥 NEW ERROR RECEIVED:');
  console.log('  ID:', error.id);
  console.log('  Message:', error.message);
  console.log('  Severity:', error.severity);
  console.log('  Session:', error.session_id);
  console.log('  Timestamp:', error.timestamp);
  console.log('  Is New:', error.isNew);
});

socket.on('errors:batch', (errors) => {
  console.log('\n📦 BATCH ERRORS RECEIVED:', errors.length, 'errors');
  errors.forEach((error, index) => {
    console.log(`  ${index + 1}. ${error.message} (${error.severity})`);
  });
});

socket.on('error:updated', (error) => {
  console.log('\n🔄 ERROR UPDATED:', error.id, '-', error.message);
});

socket.on('error:resolved', (errorId) => {
  console.log('\n✅ ERROR RESOLVED:', errorId);
});

// Keep the test running
console.log('\n⏳ Listening for WebSocket events... (Press Ctrl+C to exit)');
console.log('📨 Send test errors to http://localhost:4000/api/capture/error');
console.log('🔑 API Key: revi_bbb7359be5ef7ac29b99130fe5777aa28bdadf7823198b63c290b51998b01ef0');

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Disconnecting...');
  socket.disconnect();
  process.exit(0);
});