// =============================================================================
// ZUSTAND STORE
// =============================================================================

import { createStore } from 'zustand/vanilla';
import { subscribeWithSelector } from 'zustand/middleware';

export const store = createStore(
    subscribeWithSelector((set, get) => ({
            // =================================================================
            // GAME STATE
            // =================================================================
            cards: [],
            particles: [],
            isRevealed: false,
            revealComplete: false,
            gameStarted: false,

            // =================================================================
            // CANVAS STATE
            // =================================================================
            ctx: null,
            width: 0,
            height: 0,

            // =================================================================
            // PLAYER STATE
            // =================================================================
            // Players as plain object (Record<peerId, PlayerInfo>)
            players: {},
            localPlayer: {
                id: null,
                name: 'You',
                color: '#3b82f6',
                voted: false,
                vote: null,
                isObserver: false
            },

            // =================================================================
            // ENGINE STATE
            // =================================================================
            engine: null,
            elements: {},

            // =================================================================
            // CARD ACTIONS
            // =================================================================
            setCards: (cards) => set({ cards }),

            pushCard: (card) =>
                set((state) => ({ cards: [...state.cards, card] })),

            filterCards: (predicate) =>
                set((state) => ({ cards: state.cards.filter(predicate) })),

            updateCard: (index, updates) =>
                set((state) => ({
                    cards: state.cards.map((card, i) =>
                        i === index ? { ...card, ...updates } : card
                    )
                })),

            // =================================================================
            // PARTICLE ACTIONS
            // =================================================================
            setParticles: (particles) => set({ particles }),

            // =================================================================
            // GAME FLAG ACTIONS
            // =================================================================
            setIsRevealed: (isRevealed) => set({ isRevealed }),
            setRevealComplete: (revealComplete) => set({ revealComplete }),
            setGameStarted: (gameStarted) => set({ gameStarted }),

            // =================================================================
            // CANVAS ACTIONS
            // =================================================================
            setCtx: (ctx) => set({ ctx }),
            setDimensions: (width, height) => set({ width, height }),

            // =================================================================
            // PLAYER ACTIONS
            // =================================================================
            setLocalPlayer: (localPlayer) => set({ localPlayer }),

            updateLocalPlayer: (updates) =>
                set((state) => ({
                    localPlayer: { ...state.localPlayer, ...updates }
                })),

            setPlayer: (id, info) =>
                set((state) => ({
                    players: { ...state.players, [id]: info }
                })),

            updatePlayer: (id, updates) =>
                set((state) =>
                    state.players[id]
                        ? { players: { ...state.players, [id]: { ...state.players[id], ...updates } } }
                        : {}
                ),

            deletePlayer: (id) =>
                set((state) => {
                    const { [id]: _, ...rest } = state.players;
                    return { players: rest };
                }),

            clearPlayers: () => set({ players: {} }),

            // =================================================================
            // ENGINE ACTIONS
            // =================================================================
            setEngine: (engine) => set({ engine }),
            setElements: (elements) => set({ elements }),

            // =================================================================
            // GAME ACTIONS
            // =================================================================
            reveal: () => set({ isRevealed: true }),

            resetGame: () => set((state) => ({
                isRevealed: false,
                revealComplete: false,
                cards: [],
                particles: [],
                localPlayer: { ...state.localPlayer, voted: false, vote: null },
                players: Object.fromEntries(
                    Object.entries(state.players).map(([id, p]) => [id, { ...p, voted: false, vote: null }])
                )
            })),

            // =================================================================
            // HELPERS
            // =================================================================
            getAllPlayers: () => {
                const state = get();
                return [state.localPlayer, ...Object.values(state.players)];
            },

            getPlayerCount: () => {
                const state = get();
                return Object.keys(state.players).length + 1;
            },

            // Get all voters (non-observers)
            getVoters: () => {
                const state = get();
                return [state.localPlayer, ...Object.values(state.players)].filter(p => !p.isObserver);
            },

            // Get count of players who have voted
            getVotedCount: () => {
                return get().getVoters().filter(p => p.voted).length;
            },

            // Check if all voters have voted
            areAllVotesIn: () => {
                const voters = get().getVoters();
                return voters.length > 0 && voters.every(p => p.voted);
            },

            // Check if observer can reveal (is observer and there are cards)
            canObserverReveal: () => {
                const state = get();
                return state.localPlayer.isObserver && state.cards.length > 0;
            }
        }))
);

// Convenience exports for direct access
export const { getState, setState, subscribe } = store;
