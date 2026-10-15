import { describe, expect, it } from 'vitest';
import { applyAction, isAccessible, legalActions, newGame, presence } from './engine';
import { cardCost, locationCost, missingSkills, skillCoverage, skillPool, type SkillPool } from './costs';
import { CARDS, CHAPTER_CARDS, REGION_IDS } from './data';
import type { GameState, Side } from './types';

/** Puts a specific card in an accessible slot so tests can play it. */
function forceAccessibleCard(state: GameState, cardId: string): number {
  const slot = state.slots.find((s) => isAccessible(state, s))!;
  slot.cardId = cardId;
  slot.faceUp = true;
  return slot.id;
}

function chooseFirst(state: GameState): GameState {
  return applyAction(state, { type: 'choose', value: state.prompt!.options[0].value });
}

describe('setup', () => {
  it('follows the rulebook preparation', () => {
    const s = newGame(1);
    expect(s.current).toBe('sauron');
    expect(s.players.fellowship.coins).toBe(3);
    expect(s.players.sauron.coins).toBe(2);
    expect(s.regions.arnor.units.fellowship).toBe(2);
    expect(s.regions.mordor.units.sauron).toBe(2);
    expect(s.players.fellowship.unitsSupply).toBe(13);
    expect(s.slots).toHaveLength(20);
    expect(s.discard).toHaveLength(3);
    expect(s.locationsFaceUp).toHaveLength(3);
    expect(Object.values(s.alliancePiles).every((p) => p.length === 3)).toBe(true);
    // Chapter 1: only the 6-card bottom row is accessible at the start.
    expect(s.slots.filter((sl) => isAccessible(s, sl))).toHaveLength(6);
  });

  it('has 23 cards per chapter', () => {
    expect(CHAPTER_CARDS[1]).toHaveLength(23);
    expect(CHAPTER_CARDS[2]).toHaveLength(23);
    expect(CHAPTER_CARDS[3]).toHaveLength(23);
  });
});

describe('costs', () => {
  it('uses "/" cards and wild skills with an optimal assignment', () => {
    const pool = {
      fixed: { mask: 1, fist: 0, heart: 0, book: 0, crown: 0 },
      flexible: [['crown', 'book'], ['mask', 'fist', 'heart']] as const,
    };
    // needs mask, fist, book: mask fixed, fist via choice #2, book via choice #1
    expect(missingSkills(['mask', 'fist', 'book'], { ...pool, flexible: pool.flexible.map((f) => [...f]) })).toBe(0);
    expect(missingSkills(['fist', 'heart'], { ...pool, flexible: pool.flexible.map((f) => [...f]) })).toBe(1);
  });

  it('marks which required symbols are already covered', () => {
    const pool: SkillPool = { fixed: { mask: 1, fist: 0, heart: 0, book: 0, crown: 0 }, flexible: [['crown', 'book'], ['mask', 'fist']] };
    const covered = skillCoverage(['mask', 'mask', 'fist', 'book', 'heart'], pool);
    // mask from the fixed pool, book from crown/book; mask/fist covers only one of the other two; heart never
    expect(covered[0]).toBe(true);
    expect(covered[3]).toBe(true);
    expect(covered[4]).toBe(false);
    expect(Number(covered[1]) + Number(covered[2])).toBe(1);
    expect(covered.filter((c) => !c).length).toBe(missingSkills(['mask', 'mask', 'fist', 'book', 'heart'], pool));
  });

  it('charges 1 coin per missing skill and frees chained cards', () => {
    const s = newGame(2);
    s.current = 'fellowship';
    // cap2_05 costs heart+fist and requires the horse_head chain (granted by cap1_03)
    expect(cardCost(s, 'fellowship', 'cap2_05')).toMatchObject({ coins: 2, viaChain: false });
    s.players.fellowship.cards.push('cap1_03');
    expect(cardCost(s, 'fellowship', 'cap2_05')).toMatchObject({ coins: 0, viaChain: true });
  });

  it('adds 1 coin per own fortress to key locations, unless Dwarves discount', () => {
    const s = newGame(3);
    const base = locationCost(s, 'sauron', 'erebor').coins;
    s.regions.gondor.fortress = 'sauron';
    s.regions.rohan.fortress = 'sauron';
    expect(locationCost(s, 'sauron', 'erebor').coins).toBe(base + 2);
    s.players.sauron.tokens.push('dwarves_loc_discount');
    expect(locationCost(s, 'sauron', 'erebor').coins).toBe(base);
  });

  it('counts skills from grey cards', () => {
    const s = newGame(4);
    s.players.sauron.cards.push('cap1_09', 'cap2_10');
    expect(skillPool(s, 'sauron').fixed.mask).toBe(3);
  });
});

describe('turns', () => {
  it('discarding gives coins equal to the chapter and passes the turn', () => {
    let s = newGame(5);
    const slot = s.slots.find((sl) => isAccessible(s, sl))!;
    s = applyAction(s, { type: 'takeCard', slot: slot.id, mode: 'discard' });
    expect(s.players.sauron.coins).toBe(3);
    expect(s.current).toBe('fellowship');
    expect(s.discard).toHaveLength(4);
  });

  it('reveals face-down cards once they become accessible', () => {
    let s = newGame(6);
    // Take the two bottom-left cards of chapter 1 -> the face-down card above them opens.
    s = applyAction(s, { type: 'takeCard', slot: 14, mode: 'discard' });
    s = applyAction(s, { type: 'takeCard', slot: 15, mode: 'discard' });
    const above = s.slots.find((sl) => sl.row === 3 && sl.x === -4)!;
    expect(isAccessible(s, above)).toBe(true);
    expect(above.faceUp).toBe(true);
  });

  it('moves to the next chapter when the formation is empty', () => {
    let s = newGame(7);
    while (s.chapter === 1) {
      const slot = s.slots.find((sl) => isAccessible(s, sl))!;
      s = applyAction(s, { type: 'takeCard', slot: slot.id, mode: 'discard' });
    }
    expect(s.chapter).toBe(2);
    expect(s.slots.filter((sl) => !sl.taken)).toHaveLength(20);
    // Sauron took turn 1, so after 20 turns it is Sauron again.
    expect(s.current).toBe('sauron');
  });
});

describe('military', () => {
  it('resolves conflicts by removing pairs of units', () => {
    let s = newGame(8);
    s.current = 'fellowship';
    s.regions.rohan.units.sauron = 2;
    s.players.sauron.unitsSupply -= 2;
    const slot = forceAccessibleCard(s, 'cap2_19'); // red: 2 units in Lindon or Rohan
    s.players.fellowship.coins = 10;
    s = applyAction(s, { type: 'takeCard', slot, mode: 'play' });
    expect(s.prompt?.target).toBe('region');
    s = applyAction(s, { type: 'choose', value: 'rohan' });
    expect(s.regions.rohan.units).toEqual({ fellowship: 0, sauron: 0 });
    expect(s.players.sauron.unitsSupply).toBe(13);
    expect(s.players.fellowship.unitsSupply).toBe(13);
  });

  it('wins immediately by being present in all 7 regions', () => {
    let s = newGame(9);
    s.current = 'fellowship';
    for (const r of REGION_IDS) if (r !== 'gondor') s.regions[r].units.fellowship = 1;
    s.regions.mordor.units.sauron = 0;
    const slot = forceAccessibleCard(s, 'cap1_23'); // red: Gondor or Rohan
    s.players.fellowship.coins = 10;
    s = applyAction(s, { type: 'takeCard', slot, mode: 'play' });
    s = applyAction(s, { type: 'choose', value: 'gondor' });
    expect(s.winner?.sides).toEqual(['fellowship']);
  });
});

describe('ring quest', () => {
  it('grants bonuses when reaching them and wins at the end', () => {
    let s = newGame(10);
    s.players.sauron.ring = 2;
    const slot = forceAccessibleCard(s, 'cap1_04'); // blue, free, 1 ring
    const coins = s.players.sauron.coins;
    s = applyAction(s, { type: 'takeCard', slot, mode: 'play' });
    expect(s.players.sauron.ring).toBe(3);
    expect(s.players.sauron.coins).toBe(coins + 1);

    let t = newGame(11);
    t.players.sauron.ring = 13;
    const slot2 = forceAccessibleCard(t, 'cap1_04');
    t = applyAction(t, { type: 'takeCard', slot: slot2, mode: 'play' });
    expect(t.winner?.sides).toEqual(['sauron']);
  });
});

describe('alliances and races', () => {
  it('2 equal race symbols let you pick 1 of 2 alliance tokens', () => {
    let s = newGame(12);
    s.players.sauron.cards.push('cap1_06'); // dwarves
    const slot = forceAccessibleCard(s, 'cap2_08'); // dwarves again (costs fist fist crown)
    s.players.sauron.coins = 10;
    s = applyAction(s, { type: 'takeCard', slot, mode: 'play' });
    expect(s.prompt?.target).toBe('token');
    expect(s.prompt?.options).toHaveLength(2);
    const picked = s.prompt!.options[0].value;
    s = chooseFirst(s);
    expect(s.players.sauron.tokens).toContain(picked);
    expect(s.alliancePiles.dwarves).toHaveLength(2);
  });

  it('6 different race symbols win the game (the Eagle counts)', () => {
    let s = newGame(13);
    s.players.sauron.cards.push('cap1_05', 'cap1_06', 'cap1_07', 'cap3_06');
    s.players.sauron.usedThreeDifferent = true;
    s.players.sauron.tokens.push('hobbits_eagle');
    const slot = forceAccessibleCard(s, 'cap3_08'); // wizards
    s.players.sauron.coins = 20;
    s = applyAction(s, { type: 'takeCard', slot, mode: 'play' });
    expect(s.winner?.sides).toEqual(['sauron']);
  });
});

function invariants(s: GameState): void {
  for (const side of ['fellowship', 'sauron'] as Side[]) {
    const onBoard = REGION_IDS.reduce((n, r) => n + s.regions[r].units[side], 0);
    expect(onBoard + s.players[side].unitsSupply).toBe(15);
    const forts = REGION_IDS.filter((r) => s.regions[r].fortress === side).length;
    expect(forts + s.players[side].fortressSupply).toBe(7);
    expect(s.players[side].coins).toBeGreaterThanOrEqual(0);
    for (const r of REGION_IDS) {
      expect(Math.min(s.regions[r].units.fellowship, s.regions[r].units.sauron)).toBe(0);
    }
  }
  const seen = [...s.players.fellowship.cards, ...s.players.sauron.cards, ...s.discard];
  expect(new Set(seen).size).toBe(seen.length);
}

describe('random full games', () => {
  it('always reach a winner without breaking invariants', () => {
    const reasons: Record<string, number> = {};
    for (let seed = 1; seed <= 200; seed++) {
      let s = newGame(seed);
      let rng = seed * 7919;
      let guard = 0;
      while (!s.winner) {
        const actions = legalActions(s);
        expect(actions.length).toBeGreaterThan(0);
        rng = (rng * 1103515245 + 12345) & 0x7fffffff;
        s = applyAction(s, actions[rng % actions.length]);
        invariants(s);
        if (++guard > 2000) throw new Error(`seed ${seed} did not finish`);
      }
      const key = s.winner.reason.split(':')[0].slice(0, 30);
      reasons[key] = (reasons[key] ?? 0) + 1;
    }
    console.log('Win reasons over 200 random games:', reasons);
    expect(Object.keys(reasons).length).toBeGreaterThan(0);
  }, 60_000);

  it('every card id is valid data', () => {
    for (const card of Object.values(CARDS)) {
      expect(card.cost.coins).toBeGreaterThanOrEqual(0);
      if (card.color === 'red') expect(card.effect.military?.regions).toHaveLength(2);
    }
    const s = newGame(99);
    expect(presence(s, 'fellowship')).toBe(1);
  });
});
