// Debug hooks for screenshot automation
// Stripped from production builds via __DEBUG__ flag (set by esbuild)

export function emit(event, detail = {}) {
  if (__DEBUG__) {
    const handler = window.__SPKR_HOOKS__?.[event];
    if (handler) handler(detail);
  }
}

// Events:
// - roomCreated: { code }
// - roomJoined: { code }
// - peerJoined: { peerId, count }
// - allPlayersReady: { count }
// - voteCast: { playerId, value }
// - allVotesIn: { count }
// - cardsSettled: { count } - all thrown cards have stopped moving (velocity ~0)
// - revealStarted: {}
// - revealComplete: {} - all cards flipped AND positioned at targets
// - reset: {}
