// Debug hooks for screenshot automation
// Hooks are always active when window.__SPKR_HOOKS__ is set (for testing)
// This allows test harnesses to inject hooks even in production builds

export function emit(event, detail = {}) {
  if (typeof window !== 'undefined' && window.__SPKR_HOOKS__) {
    const handler = window.__SPKR_HOOKS__[event];
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
