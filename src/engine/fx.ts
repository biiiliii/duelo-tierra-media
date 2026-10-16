import type { Fx, GameState } from './types.js';

/**
 * Replays one event on a copy of the previous state, so the UI can show a rival's turn step by step.
 * It updates what the board shows (pieces, coins, quest, cards, tokens, places, formation); a new chapter's
 * formation is not in the event, so callers take it from the final state.
 */
export function applyFx(s: GameState, e: Fx): void {
  switch (e.t) {
    case 'turn':
      s.current = e.side;
      return;
    case 'chapter':
      s.chapter = e.chapter;
      return;
    case 'card': {
      const slot = s.slots[e.slot];
      if (slot) slot.taken = true;
      if (e.cardId) s.players[e.by].cards.push(e.cardId);
      return;
    }
    case 'free':
      s.players[e.by].cards.push(e.cardId);
      return;
    case 'location':
      s.locationsFaceUp = s.locationsFaceUp.filter((id) => id !== e.id);
      s.players[e.by].locations.push(e.id);
      return;
    case 'coins':
      s.players[e.side].coins += e.n;
      return;
    case 'ring':
      s.players[e.side].ring = e.to;
      return;
    case 'units':
      s.regions[e.region].units[e.side] += e.n;
      s.players[e.side].unitsSupply -= e.n;
      return;
    case 'move':
      s.regions[e.from].units[e.side]--;
      s.regions[e.to].units[e.side]++;
      return;
    case 'conflict':
      for (const side of ['fellowship', 'sauron'] as const) {
        s.regions[e.region].units[side] -= e.n;
        s.players[side].unitsSupply += e.n;
      }
      return;
    case 'kill':
      s.regions[e.region].units[e.side]--;
      s.players[e.side].unitsSupply++;
      return;
    case 'fortress':
      s.regions[e.region].fortress = e.side;
      s.players[e.side].fortressSupply--;
      return;
    case 'raze':
      s.regions[e.region].fortress = null;
      s.players[e.side].fortressSupply++;
      return;
    case 'token':
      s.players[e.side].tokens.push(e.token);
      return;
    case 'burn': {
      const cards = s.players[e.side].cards;
      const i = cards.indexOf(e.cardId);
      if (i >= 0) cards.splice(i, 1);
      return;
    }
    case 'extra':
      return;
    case 'reveal': {
      const slot = s.slots[e.slot];
      if (slot) slot.faceUp = true;
      return;
    }
  }
}
