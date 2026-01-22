// Cloudflare Worker for WebRTC signaling
// Requires Durable Objects (paid plan) for WebSocket support

export { SignalRoom } from './signal-room.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Handle signaling WebSocket connections: /signal/:roomCode
    if (url.pathname.startsWith('/signal/')) {
      const roomCode = url.pathname.split('/')[2];

      if (!roomCode || !/^[A-Z2-9]{6}$/.test(roomCode)) {
        return new Response('Invalid room code', { status: 400 });
      }

      // Get or create the Durable Object for this room
      const roomId = env.SIGNAL_ROOM.idFromName(roomCode);
      const room = env.SIGNAL_ROOM.get(roomId);

      // Forward the request to the Durable Object
      return room.fetch(request);
    }

    // Static assets are served automatically by the [assets] config
    return new Response('Not Found', { status: 404 });
  },
};
