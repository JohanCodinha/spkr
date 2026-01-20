// =============================================================================
// ZUSTAND STORE
// =============================================================================

import { createStore } from 'zustand/vanilla';
import { subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

export const store = createStore(
    subscribeWithSelector(
        immer((set, get) => ({
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
                set((state) => {
                    state.cards.push(card);
                }),

            filterCards: (predicate) =>
                set((state) => {
                    state.cards = state.cards.filter(predicate);
                }),

            updateCard: (index, updates) =>
                set((state) => {
                    if (state.cards[index]) {
                        Object.assign(state.cards[index], updates);
                    }
                }),

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
                set((state) => {
                    Object.assign(state.localPlayer, updates);
                }),

            setPlayer: (id, info) =>
                set((state) => {
                    state.players[id] = info;
                }),

            updatePlayer: (id, updates) =>
                set((state) => {
                    if (state.players[id]) {
                        Object.assign(state.players[id], updates);
                    }
                }),

            deletePlayer: (id) =>
                set((state) => {
                    delete state.players[id];
                }),

            clearPlayers: () => set({ players: {} }),

            // =================================================================
            // ENGINE ACTIONS
            // =================================================================
            setEngine: (engine) => set({ engine }),
            setElements: (elements) => set({ elements }),

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
            }
        }))
    )
);

// Convenience exports for direct access
export const { getState, setState, subscribe } = store;
