import { describe, expect, it } from 'vitest';
import { chooseAction, determinize, type AiLevel } from './ai';
import { applyAction, legalActions, newGame } from './engine';
import type { GameState, Side } from './types';

function seeded(seed: number) {
  return () => {
    let t = (seed = (seed + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Plays a whole game between two AIs, checking every move is legal. */
function play(levels: Record<Side, AiLevel>, seed: number): GameState {
  const rand = seeded(seed);
  let s = newGame(seed);
  for (let guard = 0; !s.winner; guard++) {
    if (guard > 2000) throw new Error(`seed ${seed} did not finish`);
    const action = chooseAction(s, levels[s.current], rand);
    expect(legalActions(s)).toContainEqual(action);
    s = applyAction(s, action);
  }
  return s;
}

describe('AI', () => {
  it('only reshuffles what the player cannot see', () => {
    let s = newGame(5);
    for (let i = 0; i < 6; i++) s = applyAction(s, legalActions(s)[0]);
    const d = determinize(s, seeded(1));
    expect(d.slots.filter((x) => x.faceUp || x.taken)).toEqual(s.slots.filter((x) => x.faceUp || x.taken));
    expect(d.players).toEqual(s.players);
    expect(d.regions).toEqual(s.regions);
    expect(d.locationsFaceUp).toEqual(s.locationsFaceUp);
    const hidden = (g: GameState) => [...g.slots.filter((x) => !x.faceUp && !x.taken).map((x) => x.cardId), ...g.discard].sort();
    expect(hidden(d)).toEqual(hidden(s));
  });

  it('plays legal moves to the end of the game at every level', () => {
    play({ fellowship: 'easy', sauron: 'hard' }, 11);
    play({ fellowship: 'normal', sauron: 'easy' }, 12);
    play({ fellowship: 'hard', sauron: 'normal' }, 13);
    play({ fellowship: 'impossible', sauron: 'hard' }, 14);
    play({ fellowship: 'apocalypse', sauron: 'impossible' }, 15);
  }, 60_000);

  it('hard beats easy most of the time', () => {
    let hardWins = 0;
    for (let g = 0; g < 10; g++) {
      const hardSide: Side = g % 2 === 0 ? 'fellowship' : 'sauron';
      const levels = { fellowship: 'easy', sauron: 'easy', [hardSide]: 'hard' } as Record<Side, AiLevel>;
      const { winner } = play(levels, 100 + g);
      if (winner!.sides.length === 1 && winner!.sides[0] === hardSide) hardWins++;
    }
    expect(hardWins).toBeGreaterThanOrEqual(8);
  }, 60_000);

  it('impossible beats hard most of the time', () => {
    let wins = 0;
    for (let g = 0; g < 6; g++) {
      const side: Side = g % 2 === 0 ? 'fellowship' : 'sauron';
      const levels = { fellowship: 'hard', sauron: 'hard', [side]: 'impossible' } as Record<Side, AiLevel>;
      const { winner } = play(levels, 200 + g);
      if (winner!.sides.length === 1 && winner!.sides[0] === side) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(4);
  }, 120_000);

  it('sees a win that needs a card and then a choice', () => {
    // Seed 7000, turn 40: playing slot 8 lets Sauron play a red card and win by placing it in Gondor.
    const rand = seeded(7001);
    let s = newGame(7000);
    while (!(s.turn === 40 && !s.prompt)) s = applyAction(s, chooseAction(s, 'hard', rand));
    expect(chooseAction(s, 'impossible', seeded(1))).not.toEqual({ type: 'takeCard', slot: 8, mode: 'play' });
  }, 30_000);
});
