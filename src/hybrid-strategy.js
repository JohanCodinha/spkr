// Hybrid P2P strategy: Cloudflare Worker primary, BitTorrent fallback
// Only uses BitTorrent if CF Worker connection fails

import { joinRoom as cfJoinRoom, selfId as cfSelfId } from './cf-strategy.js';
import { joinRoom as torrentJoinRoom, selfId as torrentSelfId } from 'trystero/torrent';

// Use consistent selfId
export const selfId = cfSelfId;

export function joinRoom(config, roomCode) {
  let activeRoom = null;
  let usingFallback = false;
  let onPeerJoinCb = () => {};
  let onPeerLeaveCb = () => {};

  const actionHandlers = new Map();

  // Try CF first
  console.log('[Hybrid] Trying CF strategy...');

  try {
    activeRoom = cfJoinRoom(config, roomCode, {
      // Called when CF connection fails (WebSocket error/close without connecting)
      onConnectionFailed: () => {
        console.log('[Hybrid] CF connection failed, switching to BitTorrent...');
        activateFallback();
      }
    });

    activeRoom.onPeerJoin(peerId => {
      console.log('[Hybrid] Peer joined via CF:', peerId);
      onPeerJoinCb(peerId);
    });

    activeRoom.onPeerLeave(peerId => {
      console.log('[Hybrid] Peer left:', peerId);
      onPeerLeaveCb(peerId);
    });

  } catch (err) {
    console.warn('[Hybrid] CF strategy failed to initialize:', err);
    activateFallback();
  }

  function activateFallback() {
    if (usingFallback) return;
    usingFallback = true;

    // Clean up CF room if it exists
    if (activeRoom) {
      try {
        activeRoom.leave();
      } catch {}
    }

    console.log('[Hybrid] Switching to BitTorrent...');
    const torrentConfig = { appId: config.appId || `hybrid-p2p-${roomCode}` };
    activeRoom = torrentJoinRoom(torrentConfig, roomCode);

    activeRoom.onPeerJoin(peerId => {
      console.log('[Hybrid] Peer joined via BitTorrent:', peerId);
      onPeerJoinCb(peerId);
    });

    activeRoom.onPeerLeave(peerId => {
      console.log('[Hybrid] Peer left:', peerId);
      onPeerLeaveCb(peerId);
    });

    // Re-register action handlers on the new room
    for (const [name, handler] of actionHandlers) {
      if (handler.onComplete) {
        const [, onReceive] = activeRoom.makeAction(name);
        onReceive(handler.onComplete);
      }
    }
  }

  // Return room interface
  return {
    onPeerJoin: cb => { onPeerJoinCb = cb; },
    onPeerLeave: cb => { onPeerLeaveCb = cb; },

    makeAction: name => {
      if (!actionHandlers.has(name)) {
        actionHandlers.set(name, { onComplete: null });
      }

      const send = (data, targetPeerId) => {
        if (!activeRoom) return;
        const [sendFn] = activeRoom.makeAction(name);
        sendFn(data, targetPeerId);
      };

      const onReceive = cb => {
        actionHandlers.get(name).onComplete = cb;
        if (activeRoom) {
          const [, receiveFn] = activeRoom.makeAction(name);
          receiveFn(cb);
        }
      };

      return [send, onReceive];
    },

    leave: () => {
      if (activeRoom) {
        activeRoom.leave();
        activeRoom = null;
      }
    },

    getPeers: () => activeRoom?.getPeers() || {}
  };
}
