// Cloudflare Worker-based P2P signaling strategy
// Provides the same interface as Trystero for drop-in replacement

// Use localhost in dev mode, production URL otherwise
const CF_SIGNAL_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  ? 'ws://localhost:8787/signal'
  : 'wss://eval.work/signal';

// Generate a random peer ID (same format as Trystero)
const genId = n => {
  const chars = '0123456789AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz';
  return Array(n).fill().map(() => chars[Math.floor(Math.random() * chars.length)]).join('');
};

export const selfId = genId(20);

// ICE servers for WebRTC
const iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' }
];

export function joinRoom(config, roomCode, options = {}) {
  const peers = new Map(); // peerId -> { pc, channel }
  const pendingConnections = new Map(); // offerId -> { pc, channel, targetPeerId }
  const connectingToPeers = new Set(); // peerIds we're currently trying to connect to
  const actions = new Map(); // actionName -> { onComplete }
  let ws = null;
  let onPeerJoinCb = () => {};
  let onPeerLeaveCb = () => {};
  let announceTimer = null;
  let closed = false;
  let hasConnected = false;
  let connectionAttempts = 0;
  const MAX_ATTEMPTS = 3;

  const { onConnectionFailed } = options;

  // Connect to CF Worker
  const connect = () => {
    if (closed) return;

    connectionAttempts++;
    ws = new WebSocket(`${CF_SIGNAL_URL}/${roomCode}`);

    ws.onopen = () => {
      console.log('[CF] Connected to signaling server');
      hasConnected = true;
      connectionAttempts = 0;
      // Start announcing presence
      announce();
      announceTimer = setInterval(announce, 5000);
    };

    ws.onmessage = e => handleMessage(JSON.parse(e.data));

    ws.onclose = () => {
      clearInterval(announceTimer);
      if (!closed) {
        if (!hasConnected && connectionAttempts >= MAX_ATTEMPTS) {
          // Never connected successfully after multiple attempts - fallback
          console.log('[CF] Connection failed after', MAX_ATTEMPTS, 'attempts');
          onConnectionFailed?.();
        } else if (hasConnected) {
          // Was connected, try to reconnect
          console.log('[CF] Disconnected, reconnecting...');
          setTimeout(connect, 2000);
        } else {
          // Still trying initial connection
          console.log('[CF] Connection attempt', connectionAttempts, 'failed, retrying...');
          setTimeout(connect, 1000);
        }
      }
    };

    ws.onerror = err => {
      console.error('[CF] WebSocket error:', err);
    };
  };

  // Announce our presence with SDP offers
  const announce = async () => {
    if (closed || !ws || ws.readyState !== WebSocket.OPEN) return;
    // Create a pool of offers for potential peers - in parallel for speed
    const offerPromises = [];
    for (let i = 0; i < 3; i++) {
      offerPromises.push(createOffer());
    }

    const offers = (await Promise.all(offerPromises)).filter(Boolean);

    if (offers.length > 0 && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'announce',
        peerId: selfId,
        offers
      }));
    }
  };

  // Create a single offer
  const createOffer = async () => {
    const offerId = genId(12);
    const pc = createPeerConnection(offerId);

    // Create data channel (initiator creates it)
    const channel = pc.createDataChannel('data', { ordered: true });
    setupDataChannel(channel, offerId, pc);

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering (short timeout)
      await waitForIce(pc);

      pendingConnections.set(offerId, { pc, channel });

      return {
        offer_id: offerId,
        offer: { type: 'offer', sdp: pc.localDescription.sdp }
      };
    } catch (err) {
      console.error('[CF] Error creating offer:', err);
      pc.close();
      return null;
    }
  };

  const waitForIce = pc => new Promise(resolve => {
    if (pc.iceGatheringState === 'complete') {
      resolve();
      return;
    }
    const timeout = setTimeout(resolve, 1000); // Short timeout
    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === 'complete') {
        clearTimeout(timeout);
        resolve();
      }
    };
  });

  const handleMessage = async data => {
    switch (data.type) {
      case 'offer':
        await handleOffer(data);
        break;
      case 'answer':
        handleAnswer(data);
        break;
      case 'peer_left':
        handlePeerLeft(data.peer_id);
        break;
    }
  };

  const handleOffer = async data => {
    const { peer_id: peerId, offer_id: offerId, offer } = data;

    // Don't connect to ourselves
    if (peerId === selfId) return;

    // Already connected to this peer?
    if (peers.has(peerId)) return;

    // Already trying to connect to this peer?
    if (connectingToPeers.has(peerId)) return;

    // Collision detection: if we have a pending offer to this peer,
    // use peer ID comparison to decide whose offer wins
    const existingPending = Array.from(pendingConnections.entries())
      .find(([id, conn]) => conn.targetPeerId === peerId);

    if (existingPending && selfId > peerId) {
      // Our offer wins, ignore theirs
      return;
    }

    connectingToPeers.add(peerId);

    const pc = createPeerConnection(offerId);

    // Non-initiator receives data channel
    pc.ondatachannel = e => {
      setupDataChannel(e.channel, peerId, pc);
    };

    try {
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await waitForIce(pc);

      ws.send(JSON.stringify({
        type: 'answer',
        to_peer_id: peerId,
        offer_id: offerId,
        answer: { type: 'answer', sdp: pc.localDescription.sdp }
      }));
    } catch (err) {
      pc.close();
    }
  };

  const handleAnswer = async data => {
    const { peer_id: peerId, offer_id: offerId, answer } = data;

    const pending = pendingConnections.get(offerId);
    if (!pending) return;

    // Already connected to this peer?
    if (peers.has(peerId)) {
      // Clean up this pending connection since we don't need it
      pending.pc.close();
      pendingConnections.delete(offerId);
      return;
    }

    // Check if the peer connection is in the right state
    if (pending.pc.signalingState !== 'have-local-offer') {
      // Already processed or in wrong state
      pendingConnections.delete(offerId);
      return;
    }

    pending.targetPeerId = peerId;
    connectingToPeers.add(peerId);

    try {
      await pending.pc.setRemoteDescription(answer);
    } catch (err) {
      // Connection failed, clean up
      pending.pc.close();
      pendingConnections.delete(offerId);
      connectingToPeers.delete(peerId);
    }
  };

  const createPeerConnection = id => {
    const pc = new RTCPeerConnection({ iceServers });

    pc.onconnectionstatechange = () => {
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        // Find and remove this peer
        for (const [peerId, peer] of peers) {
          if (peer.pc === pc) {
            handlePeerLeft(peerId);
            break;
          }
        }
      }
    };

    return pc;
  };

  const setupDataChannel = (channel, id, pc) => {
    channel.binaryType = 'arraybuffer';

    channel.onopen = () => {
      // Find the peer ID for this connection
      let peerId = null;

      // Check pending connections
      for (const [offerId, pending] of pendingConnections) {
        if (pending.pc === pc || pending.channel === channel) {
          peerId = pending.targetPeerId;
          pendingConnections.delete(offerId);
          break;
        }
      }

      // If not found in pending, the ID might be from an incoming connection
      if (!peerId) {
        peerId = id;
      }

      if (!peerId || peerId === selfId) return;

      // Already connected?
      if (peers.has(peerId)) {
        pc.close();
        return;
      }

      // Clean up any other pending connections to this peer
      for (const [offerId, pending] of pendingConnections) {
        if (pending.targetPeerId === peerId) {
          pending.pc.close();
          pendingConnections.delete(offerId);
        }
      }
      connectingToPeers.delete(peerId);

      console.log('[CF] Peer connected:', peerId);
      peers.set(peerId, { pc, channel });
      onPeerJoinCb(peerId);
    };

    channel.onclose = () => {
      for (const [peerId, peer] of peers) {
        if (peer.channel === channel) {
          handlePeerLeft(peerId);
          break;
        }
      }
    };

    channel.onmessage = e => {
      try {
        const { action, data, from } = JSON.parse(e.data);
        const handler = actions.get(action);
        if (handler?.onComplete) {
          // Find peer ID from channel
          for (const [peerId, peer] of peers) {
            if (peer.channel === channel) {
              handler.onComplete(data, peerId);
              break;
            }
          }
        }
      } catch (err) {
        console.error('[CF] Error handling message:', err);
      }
    };
  };

  const handlePeerLeft = peerId => {
    connectingToPeers.delete(peerId);
    const peer = peers.get(peerId);
    if (peer) {
      peer.pc.close();
      peers.delete(peerId);
      console.log('[CF] Peer left:', peerId);
      onPeerLeaveCb(peerId);
    }
  };

  // Start connection
  connect();

  // Return room interface (Trystero-compatible)
  return {
    onPeerJoin: cb => { onPeerJoinCb = cb; },
    onPeerLeave: cb => { onPeerLeaveCb = cb; },

    makeAction: name => {
      if (!actions.has(name)) {
        actions.set(name, { onComplete: null });
      }

      const send = (data, targetPeerId) => {
        const message = JSON.stringify({ action: name, data, from: selfId });

        if (targetPeerId) {
          // Send to specific peer
          const peer = peers.get(targetPeerId);
          if (peer?.channel?.readyState === 'open') {
            peer.channel.send(message);
          }
        } else {
          // Broadcast to all peers
          for (const [peerId, peer] of peers) {
            if (peer.channel?.readyState === 'open') {
              peer.channel.send(message);
            }
          }
        }
      };

      const onReceive = cb => {
        actions.get(name).onComplete = cb;
      };

      return [send, onReceive];
    },

    leave: () => {
      closed = true;
      clearInterval(announceTimer);
      if (ws) {
        ws.close();
        ws = null;
      }
      for (const [peerId, peer] of peers) {
        peer.pc.close();
      }
      peers.clear();
      pendingConnections.forEach(p => p.pc.close());
      pendingConnections.clear();
    },

    getPeers: () => Object.fromEntries(
      Array.from(peers.entries()).map(([id, { pc }]) => [id, pc])
    )
  };
}
