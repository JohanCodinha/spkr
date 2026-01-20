# State Management Guide

This app uses [Zustand](https://github.com/pmndrs/zustand) for state management. All shared state lives in a single store (`src/store.js`).

## Quick Reference

```javascript
import { getState, subscribe } from './store.js';

// Read state
const { cards, localPlayer } = getState();

// Call actions
getState().updateLocalPlayer({ voted: true });

// Subscribe to changes
subscribe(
  (state) => state.players,
  (players) => console.log('Players changed:', players)
);
```

## Store Structure

### State

| Property | Type | Description |
|----------|------|-------------|
| `cards` | `Card[]` | Cards currently on the table |
| `particles` | `Particle[]` | Confetti particles |
| `isRevealed` | `boolean` | Whether cards are flipped |
| `revealComplete` | `boolean` | All cards finished animating |
| `gameStarted` | `boolean` | Game is active (not in lobby) |
| `ctx` | `CanvasRenderingContext2D` | Canvas context |
| `width`, `height` | `number` | Canvas dimensions |
| `players` | `Record<string, Player>` | Remote players by peer ID |
| `localPlayer` | `Player` | Current user |
| `engine` | `Matter.Engine` | Physics engine |
| `elements` | `Record<string, HTMLElement>` | Cached DOM elements |

### Actions

**Cards:**
- `setCards(cards)` - Replace all cards
- `pushCard(card)` - Add a card
- `filterCards(predicate)` - Remove cards matching predicate
- `updateCard(index, updates)` - Update card at index

**Players:**
- `setLocalPlayer(player)` - Replace local player
- `updateLocalPlayer(updates)` - Merge updates into local player
- `setPlayer(id, player)` - Add/update remote player
- `updatePlayer(id, updates)` - Merge updates into remote player
- `deletePlayer(id)` - Remove remote player
- `clearPlayers()` - Remove all remote players

**Game:**
- `reveal()` - Set `isRevealed: true`
- `resetGame()` - Reset all game state (cards, votes, etc.)

**Selectors:**
- `getAllPlayers()` - Returns `[localPlayer, ...remotePlayers]`
- `getPlayerCount()` - Total player count
- `getVoters()` - All non-observer players
- `getVotedCount()` - Number of players who voted
- `areAllVotesIn()` - Whether all voters have voted
- `canObserverReveal()` - Whether observer can trigger reveal

## Patterns

### Reading State

```javascript
// Destructure what you need
const { cards, isRevealed, localPlayer } = getState();

// Use selectors for derived data
const { areAllVotesIn, getVotedCount } = getState();
if (areAllVotesIn()) {
  console.log(`All ${getVotedCount()} votes are in`);
}
```

### Updating State

Always use actions, never mutate directly:

```javascript
// GOOD
getState().updateLocalPlayer({ voted: true, vote: '5' });

// BAD - won't trigger updates
getState().localPlayer.voted = true;
```

### Cache State at Function Start

When you need multiple properties, destructure once:

```javascript
// GOOD
function handleVote(value) {
  const { localPlayer, elements, updateLocalPlayer } = getState();
  if (localPlayer.voted) return;
  updateLocalPlayer({ voted: true, vote: value });
  elements.deck.classList.add('voted');
}

// AVOID - multiple getState() calls
function handleVote(value) {
  if (getState().localPlayer.voted) return;
  getState().updateLocalPlayer({ voted: true, vote: value });
  getState().elements.deck.classList.add('voted');
}
```

### Re-read After Mutations (When Needed)

If you need fresh state after a mutation:

```javascript
const { updateLocalPlayer } = getState();
updateLocalPlayer({ name: 'Alice' });

// Re-read to get updated value
const { localPlayer } = getState();
broadcast(localPlayer); // Has new name
```

### Subscribing to Changes

Use subscriptions for reactive UI updates:

```javascript
import { subscribe } from './store.js';
import { shallow } from 'zustand/vanilla/shallow';

// Subscribe to specific state slice
subscribe(
  (state) => state.isRevealed,
  (isRevealed) => {
    if (isRevealed) startRevealAnimation();
  }
);

// Use shallow comparison for objects
subscribe(
  (state) => ({ players: state.players, localPlayer: state.localPlayer }),
  () => renderHeader(),
  { equalityFn: shallow }
);
```

## Adding New State

1. Add the property with initial value in `store.js`:

```javascript
export const store = createStore(
  subscribeWithSelector((set, get) => ({
    // ... existing state
    myNewProperty: initialValue,
```

2. Add an action to update it:

```javascript
    setMyNewProperty: (value) => set({ myNewProperty: value }),
```

3. For complex updates, use immutable patterns:

```javascript
    // Adding to an array
    addItem: (item) => set((state) => ({
      items: [...state.items, item]
    })),

    // Updating nested object
    updateNested: (id, updates) => set((state) => ({
      items: {
        ...state.items,
        [id]: { ...state.items[id], ...updates }
      }
    })),
```

## Adding New Selectors

Selectors compute derived state. Add them in the helpers section:

```javascript
    // Simple selector
    getActiveCards: () => {
      return get().cards.filter(c => !c.removed);
    },

    // Selector using other selectors
    getVoteDistribution: () => {
      const voters = get().getVoters().filter(p => p.voted);
      return voters.reduce((acc, p) => {
        acc[p.vote] = (acc[p.vote] || 0) + 1;
        return acc;
      }, {});
    },
```

## Testing

The store can be reset for tests:

```javascript
import { setState } from './store.js';

beforeEach(() => {
  setState({
    cards: [],
    players: {},
    localPlayer: { id: 'test', name: 'Test', voted: false },
    // ... reset to initial state
  });
});
```

## Debugging

In development, log state changes:

```javascript
subscribe(
  (state) => state,
  (state) => console.log('State updated:', state)
);
```

Or inspect current state in browser console:

```javascript
// The store is not exposed globally by default, but you can add:
window.__STORE__ = store; // in store.js, for debugging only
```

## Common Mistakes

1. **Mutating state directly** - Always use actions
2. **Forgetting immutability** - Spread objects/arrays when updating
3. **Too many getState() calls** - Cache at function start
4. **Not using selectors** - Don't recompute derived state everywhere
5. **Subscribing in render loops** - Subscribe once in init, not in animation frames
