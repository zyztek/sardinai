import { Server } from 'socket.io';

export const setupSocket = (io: Server) => {
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    // Handle messages
    socket.on('message', (msg: { text: string; senderId: string }) => {
      // Echo: broadcast message only the client who send the message
      socket.emit('message', {
        text: `Echo: ${msg.text}`,
        senderId: 'system',
        timestamp: new Date().toISOString(),
      });
    });

    // Handle real-time data subscriptions
    socket.on('subscribe', (data: { types: string[] }) => {
      console.log(`Client ${socket.id} subscribed to:`, data.types);
      socket.join('realtime-data');
      
      // Send confirmation
      socket.emit('subscription-confirmed', {
        types: data.types,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on('unsubscribe', (data: { types: string[] }) => {
      console.log(`Client ${socket.id} unsubscribed from:`, data.types);
      socket.leave('realtime-data');
    });

    // Handle heartbeat
    socket.on('heartbeat', (data: { timestamp: string }) => {
      socket.emit('heartbeat_response', {
        received: data.timestamp,
        timestamp: new Date().toISOString(),
      });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });

    // Send welcome message
    socket.emit('system', {
      message: 'Connected to SARDIN-AI real-time data stream',
      connectionId: socket.id,
      timestamp: new Date().toISOString(),
    });
  });

  // Export io instance for use in other modules
  (global as any).socketIO = io;
};