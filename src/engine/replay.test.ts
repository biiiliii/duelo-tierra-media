import { describe, expect, it } from 'vitest';
import { applyAction, legalActions, newGame } from './engine';
import { decodeRecord, encodeRecord, replay } from './replay';
import type { Action } from './types';

describe('game code', () => {
  it('rebuilds a whole game, hidden cards included, from the seed and the moves', () => {
    const seed = 1729440000123 | 0;
    let s = newGame(seed);
    const actions: Action[] = [];
    for (let i = 0; !s.winner && i < 400; i++) {
      const options = legalActions(s);
      const a = options[(i * 7) % options.length];
      actions.push(a);
      s = applyAction(s, a);
    }
    const text = `Registre...\nCodi de la partida (per reproduir-la):\n${encodeRecord({ seed, actions, level: 'apocalypse', you: 'sauron', undos: 2, version: 'abc1234' })}`;
    const record = decodeRecord(text);
    expect(record).toMatchObject({ seed, level: 'apocalypse', you: 'sauron', undos: 2, version: 'abc1234' });
    expect(record.actions).toEqual(actions);
    expect(replay(record).at(-1)).toEqual(s);
  });
});
