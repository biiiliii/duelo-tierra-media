import { describe, expect, it } from 'vitest';
import { applyAction, legalActions, newGame } from './engine';
import { applyFx } from './fx';
import type { GameState } from './types';

/** What the board shows; the events must be enough to rebuild it. */
function shown(s: GameState, withFormation: boolean) {
  const players = Object.fromEntries(Object.entries(s.players).map(([side, p]) => [side, {
    coins: p.coins, ring: p.ring, cards: [...p.cards].sort(), tokens: [...p.tokens].sort(), locations: [...p.locations].sort(),
    unitsSupply: p.unitsSupply, fortressSupply: p.fortressSupply,
  }]));
  return {
    players,
    regions: s.regions,
    current: s.current,
    ...(withFormation ? { slots: s.slots.map((x) => [x.taken, x.faceUp]), locationsFaceUp: s.locationsFaceUp } : {}),
  };
}

describe('events', () => {
  it('replaying them on the previous state rebuilds the board', () => {
    for (let seed = 1; seed <= 60; seed++) {
      let s = newGame(seed);
      let rng = seed * 104729;
      while (!s.winner) {
        const actions = legalActions(s);
        rng = (rng * 1103515245 + 12345) & 0x7fffffff;
        const next = applyAction(s, actions[rng % actions.length]);
        const events = next.fx.slice(s.fx.length);
        expect(next.fx.slice(0, s.fx.length)).toEqual(s.fx);
        const replay = structuredClone(s);
        for (const e of events) applyFx(replay, e);
        const newChapter = events.some((e) => e.t === 'chapter');
        expect(shown(replay, !newChapter)).toEqual(shown(next, !newChapter));
        s = next;
      }
    }
  }, 60_000);

  it('describe each event with the log line written just before it', () => {
    let s = newGame(5);
    s = applyAction(s, legalActions(s).find((a) => a.type === 'takeCard')!);
    for (const e of s.fx) {
      if (e.t === 'card') expect(s.log[e.at - 1]).toMatch(/juga|descarta/);
      if (e.t === 'turn') expect(e.at).toBeLessThanOrEqual(s.log.length);
    }
  });
});
