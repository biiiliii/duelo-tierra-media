import { describe, expect, it } from 'vitest';
import { applyAction, legalActions, newGame } from './engine';
import { SIDE_FEATURES, locationReach, predict, sample, sideFeatures } from './features';

describe('learned evaluation features', () => {
  it('describes each player with one number per feature, and the mover against its rival', () => {
    let s = newGame(3);
    for (let i = 0; i < 10; i++) s = applyAction(s, legalActions(s)[0]);
    const mine = sideFeatures(s, s.current);
    expect(mine).toHaveLength(SIDE_FEATURES.length);
    const x = sample(s);
    expect(x.diff).toHaveLength(SIDE_FEATURES.length);
    expect(x.sauron).toBe(s.current === 'sauron' ? 1 : 0);
  });

  it('chains key locations only with the alliance that gives a turn per location', () => {
    const s = newGame(4);
    s.players.sauron.coins = 30;
    s.regions.mordor.units.sauron = 0; // absent everywhere, so every face-up location adds a region
    expect(locationReach(s, 'sauron')).toBe(1);
    s.players.sauron.tokens.push('dwarves_loc_turn');
    expect(locationReach(s, 'sauron')).toBe(s.locationsFaceUp.length);
  });

  it('weighs features by chapter and by how far into it the game is', () => {
    const n = SIDE_FEATURES.length;
    const row = new Array(3 + 2 * n).fill(0);
    row[0] = 0.5;
    row[3] = 1;
    row[3 + n] = 2;
    const model = { chapters: [row, row, row] };
    const diff = new Array(n).fill(0);
    diff[0] = 3;
    expect(predict(model, { chapter: 1, progress: 0.5, sauron: 0, extraTurns: 0, diff })).toBeCloseTo(0.5 + (1 + 2 * 0.5) * 3);
  });
});
