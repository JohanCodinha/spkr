// SignalRoom Durable Object - handles WebSocket signaling for a single room
// Each room code gets its own Durable Object instance

export class SignalRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    // Map of peerId -> WebSocket
    this.peers = new Map();
    // Map of WebSocket -> peerId
    this.socketToPeer = new Map();
  }

  async fetch(request) {
    // Handle WebSocket upgrade
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Accept the WebSocket connection
    this.state.acceptWebSocket(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, message) {
    try {
      const data = JSON.parse(message);
      console.log('[SignalRoom] Received:', data.type, data.peerId || data.to_peer_id || '');

      switch (data.type) {
        case 'announce':
          this.handleAnnounce(ws, data);
          break;

        case 'answer':
          this.handleAnswer(ws, data);
          break;

        default:
          console.log('[SignalRoom] Unknown message type:', data.type);
          ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
      }
    } catch (err) {
      console.error('[SignalRoom] Error parsing message:', err);
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
    }
  }

  handleAnnounce(ws, data) {
    const { peerId, offers } = data;
    console.log('[SignalRoom] Announce from', peerId, 'with', offers?.length || 0, 'offers');
    console.log('[SignalRoom] Current peers:', Array.from(this.peers.keys()));

    if (!peerId || !Array.isArray(offers)) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid announce' }));
      return;
    }

    // Register this peer
    const existingWs = this.peers.get(peerId);
    if (existingWs && existingWs !== ws) {
      // Peer reconnected with new socket, close old one
      existingWs.close(1000, 'Replaced by new connection');
      this.socketToPeer.delete(existingWs);
    }

    this.peers.set(peerId, ws);
    this.socketToPeer.set(ws, peerId);

    // Broadcast offers to all other peers in the room
    for (const { offer_id, offer } of offers) {
      this.broadcast(ws, {
        type: 'offer',
        peer_id: peerId,
        offer_id,
        offer
      });
    }
  }

  handleAnswer(ws, data) {
    const { to_peer_id, offer_id, answer } = data;
    const fromPeerId = this.socketToPeer.get(ws);
    console.log('[SignalRoom] Answer from', fromPeerId, 'to', to_peer_id, 'offerId:', offer_id);

    if (!fromPeerId || !to_peer_id || !offer_id || !answer) {
      console.log('[SignalRoom] Invalid answer - missing fields');
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid answer' }));
      return;
    }

    // Send answer directly to the target peer
    const targetWs = this.peers.get(to_peer_id);
    if (targetWs) {
      targetWs.send(JSON.stringify({
        type: 'answer',
        peer_id: fromPeerId,
        offer_id,
        answer
      }));
    }
  }

  broadcast(excludeWs, message) {
    const json = JSON.stringify(message);
    for (const [peerId, ws] of this.peers) {
      if (ws !== excludeWs) {
        try {
          ws.send(json);
        } catch {
          // Socket might be closed, will be cleaned up on close event
        }
      }
    }
  }

  async webSocketClose(ws, code, reason) {
    const peerId = this.socketToPeer.get(ws);
    if (peerId) {
      this.peers.delete(peerId);
      this.socketToPeer.delete(ws);

      // Notify other peers that this peer left
      this.broadcast(null, {
        type: 'peer_left',
        peer_id: peerId
      });
    }
  }

  async webSocketError(ws, error) {
    // Clean up on error
    const peerId = this.socketToPeer.get(ws);
    if (peerId) {
      this.peers.delete(peerId);
      this.socketToPeer.delete(ws);
    }
  }
}
