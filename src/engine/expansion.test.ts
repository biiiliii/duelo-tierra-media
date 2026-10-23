import { describe, expect, it } from 'vitest';
import { chooseAction } from './ai';
import { BASE_LOCATIONS } from './data';
import { applyAction, isAccessible, legalActions, newGame } from './engine';
import { decodeRecord, encodeRecord, replay } from './replay';
import type { GameState, Side } from './types';
import { redact } from './view';

/** The player to move builds `id` right away (enough coins for any skills it lacks). */
function build(state: GameState, id: string): GameState {
  const s = structuredClone(state);
  s.locationsFaceUp[0] = id;
  s.players[s.current].coins = 30;
  return applyAction(s, { type: 'takeLocation', id });
}

describe('promo tiles', () => {
  it('are left out unless chosen, and go into the stack after the first 3 are revealed', () => {
    const base = newGame(7);
    expect(base.expansions).toBeUndefined();
    expect([...base.locationsFaceUp, ...base.locationDeck].sort()).toEqual([...BASE_LOCATIONS].sort());

    const promo = newGame(7, ['shire', 'grond']);
    expect(promo.expansions).toEqual(['shire', 'grond']);
    expect(promo.locationsFaceUp).toEqual(base.locationsFaceUp);
    expect(promo.locationDeck).toHaveLength(base.locationDeck.length + 2);
    expect(promo.locationDeck).toEqual(expect.arrayContaining(['shire', 'grond']));
    expect(promo.log[promo.log.length - 1]).toContain('La Comarca i Grond');
  });

  it('La Comarca plays any face-up card for free, covered or not, and places no fortress', () => {
    const start = newGame(3, ['shire']);
    const covered = start.slots.find((sl) => sl.faceUp && !sl.taken && !isAccessible(start, sl))!;
    const s = build(start, 'shire');
    expect(s.prompt?.step.k).toBe('playVisible');
    expect(s.prompt!.options.map((o) => o.value)).toContain(covered.cardId);
    const after = applyAction(s, { type: 'choose', value: covered.cardId });
    expect(after.players.sauron.cards).toContain(covered.cardId);
    expect(after.slots[covered.id].taken).toBe(true);
    expect(after.players.sauron.locations).toEqual(['shire']);
    expect(after.players.sauron.fortressSupply).toBe(start.players.sauron.fortressSupply);
  });

  it('Grond takes an enemy fortress: its units flee to one adjacent region and fight there', () => {
    const start = newGame(3, ['grond']);
    start.regions.rohan.fortress = 'fellowship';
    start.players.fellowship.fortressSupply--;
    start.regions.rohan.units.fellowship = 2;
    start.regions.gondor.units.sauron = 1;
    let s = build(start, 'grond');
    expect(s.prompt?.step.k).toBe('grondRaze');
    s = applyAction(s, { type: 'choose', value: 'rohan' });
    expect(s.prompt?.step.k).toBe('grondRetreat');
    expect(s.prompt!.options.map((o) => o.value).sort()).toEqual(['enedwaith', 'gondor', 'mordor', 'rhovanion']);
    s = applyAction(s, { type: 'choose', value: 'gondor' });
    // 2 Fellowship units meet 1 of Sauron's in Gondor: one pair falls.
    expect(s.regions.gondor.units).toEqual({ fellowship: 1, sauron: 0 });
    expect(s.regions.rohan.fortress).toBe('sauron');
    expect(s.regions.rohan.units).toEqual({ fellowship: 0, sauron: 1 });
    expect(s.players.fellowship.fortressSupply).toBe(start.players.fellowship.fortressSupply + 1);
    expect(s.current).toBe('fellowship');
  });

  it('Grond skips the retreat when nobody defends the fortress, and does nothing without one', () => {
    const start = newGame(3, ['grond']);
    start.regions.lindon.fortress = 'fellowship';
    const s = applyAction(build(start, 'grond'), { type: 'choose', value: 'lindon' });
    expect(s.regions.lindon.fortress).toBe('sauron');
    expect(s.regions.lindon.units.sauron).toBe(1);

    const none = build(newGame(3, ['grond']), 'grond');
    expect(none.prompt).toBeNull();
    expect(none.current).toBe('fellowship');
  });

  it('random games with both tiles finish, and the AI and online views cope with them', () => {
    let built = 0;
    for (let seed = 1; seed <= 120; seed++) {
      let s = newGame(seed, ['shire', 'grond']);
      let rng = seed * 7919;
      while (!s.winner) {
        const actions = legalActions(s);
        expect(actions.length).toBeGreaterThan(0);
        rng = (rng * 1103515245 + 12345) & 0x7fffffff;
        // Build a promo tile whenever possible, so their effects get exercised.
        const promo = actions.find((a) => a.type === 'takeLocation' && (a.id === 'shire' || a.id === 'grond'));
        if (promo) built++;
        s = applyAction(s, promo ?? actions[rng % actions.length]);
        for (const side of ['fellowship', 'sauron'] as Side[]) {
          expect(Object.values(s.regions).every((r) => r.units[side] >= 0)).toBe(true);
          expect(s.players[side].fortressSupply).toBeGreaterThanOrEqual(0);
        }
        const seen = [...s.players.fellowship.cards, ...s.players.sauron.cards, ...s.discard];
        expect(new Set(seen).size).toBe(seen.length);
      }
    }
    expect(built).toBeGreaterThan(20);
    // The AI picks moves (on the full state, as the app does) and the online view redacts without trouble.
    const s = build(newGame(11, ['shire', 'grond']), 'shire');
    expect(() => chooseAction(s, 'normal', () => 0.4)).not.toThrow();
    expect(redact(s).prompt?.options.length).toBeGreaterThan(0);
  }, 60_000);

  it('game codes keep the promo tiles, so a game replays the same', () => {
    let s = newGame(21, ['grond']);
    const actions = [];
    for (let i = 0; i < 12; i++) {
      const a = legalActions(s)[0];
      actions.push(a);
      s = applyAction(s, a);
    }
    const code = encodeRecord({ seed: 21, expansions: ['grond'], actions });
    expect(code).toContain('exp=grond');
    const states = replay(decodeRecord(code));
    expect(states[states.length - 1]).toEqual(s);
  });
});
