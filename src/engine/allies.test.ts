import { describe, expect, it } from 'vitest';
import { chooseAction } from './ai';
import { SIDE_ALLIES } from './data';
import { applyAction, isAccessible, legalActions, newGame } from './engine';
import type { GameState, Side } from './types';
import { HIDDEN, redact } from './view';

/** A game with Allies where the player to move holds `ally` (plus `power` tokens). */
function withAlly(ally: string, power = 2, side: Side = 'sauron', seed = 3): GameState {
  const s = newGame(seed, ['allies']);
  s.current = side;
  const p = s.players[side];
  p.allyHand = [ally];
  p.power = power;
  return s;
}

/** Answers every pending decision with its first option. */
function settle(state: GameState): GameState {
  let s = state;
  while (s.prompt && !s.winner) s = applyAction(s, { type: 'choose', value: s.prompt.options[0].value });
  return s;
}

function firstCardAction(state: GameState) {
  return legalActions(state).find((a) => a.type === 'takeCard' && a.mode === 'discard')!;
}

describe('Allies expansion', () => {
  it('deals 3 secret Allies and 1 Power token each, and puts 2 tokens on face-down cards', () => {
    const s = newGame(5, ['allies']);
    expect(s.expansions).toEqual(['allies']);
    for (const side of ['fellowship', 'sauron'] as const) {
      expect(s.players[side].allyHand).toHaveLength(3);
      expect(SIDE_ALLIES[side]).toEqual(expect.arrayContaining(s.players[side].allyHand!));
      expect(s.players[side].power).toBe(1);
    }
    const powered = s.slots.filter((slot) => slot.power);
    expect(powered).toHaveLength(2);
    expect(powered.every((slot) => !slot.faceUp)).toBe(true);
    expect(newGame(5).players.sauron.allyHand).toBeUndefined();
  });

  it('gives the Power token to whoever reveals its card', () => {
    let s = newGame(11, ['allies']);
    const target = s.slots.find((slot) => slot.power)!;
    // Take the cards covering it until it is revealed.
    let guard = 0;
    while (!s.slots[target.id].faceUp && guard++ < 20) {
      // Any accessible card below it: the formation opens up from the bottom.
      const cover = s.slots.find((slot) => isAccessible(s, slot) && slot.row > target.row)!;
      const mover = s.current;
      const before = s.players[mover].power!;
      s = applyAction(s, { type: 'takeCard', slot: cover.id, mode: 'discard' });
      if (s.prompt?.step.k === 'allyOffer') s = applyAction(s, { type: 'choose', value: 'end' });
      if (s.slots[target.id].faceUp) expect(s.players[mover].power).toBeGreaterThan(before);
    }
    expect(s.slots[target.id].faceUp).toBe(true);
    expect(s.slots[target.id].power).toBe(false);
  });

  it('calls an Ally before the main action and keeps the turn open for it', () => {
    let s = withAlly('f_coins', 1, 'fellowship');
    const coins = s.players.fellowship.coins;
    s = applyAction(s, { type: 'ally', value: 'arrive:f_coins' });
    expect(s.players.fellowship.coins).toBe(coins + 3);
    expect(s.players.fellowship.power).toBe(0);
    expect(s.players.fellowship.allies).toEqual(['f_coins']);
    expect(s.current).toBe('fellowship');
    expect(legalActions(s).some((a) => a.type === 'ally')).toBe(false);
    s = applyAction(s, firstCardAction(s));
    expect(s.current).toBe('sauron');
  });

  it('offers the Ally after the main action, once per turn', () => {
    let s = withAlly('s_ring', 1);
    s = applyAction(s, firstCardAction(s));
    expect(s.prompt?.step.k).toBe('allyOffer');
    s = applyAction(s, { type: 'choose', value: 'arrive:s_ring' });
    s = applyAction(s, { type: 'choose', value: 'ring' });
    expect(s.players.sauron.ring).toBe(1);
    expect(s.current).toBe('fellowship');
  });

  it('retreats an Ally for 2 tokens and removes it from the game', () => {
    let s = withAlly('f_coins', 3, 'fellowship');
    s.players.sauron.coins = 5;
    s = applyAction(s, { type: 'ally', value: 'arrive:f_coins' });
    s = applyAction(s, firstCardAction(s));
    s = settle(applyAction(s, firstCardAction(s)));
    if (s.prompt?.step.k === 'allyOffer') s = applyAction(s, { type: 'choose', value: 'end' });
    expect(s.current).toBe('fellowship');
    const coins = s.players.fellowship.coins;
    const rival = s.players.sauron.coins;
    s = applyAction(s, { type: 'ally', value: 'retreat:f_coins' });
    expect(s.players.fellowship.coins).toBe(coins + 5);
    expect(s.players.sauron.coins).toBe(Math.max(0, rival - 2));
    expect(s.players.fellowship.allies).toEqual([]);
    expect(s.players.fellowship.alliesGone).toEqual(['f_coins']);
  });

  it('Power tokens on the Nazgûl cost the rival quest steps', () => {
    let s = withAlly('f_nazgul', 1, 'fellowship');
    s = applyAction(s, { type: 'ally', value: 'arrive:f_nazgul' });
    expect(s.players.sauron.ringBlock).toBe(1);
    s.current = 'sauron';
    s.players.sauron.allyHand = ['s_ring'];
    s.players.sauron.power = 1;
    s.awaitMain = false;
    s.allyUsed = false;
    s = applyAction(s, { type: 'ally', value: 'arrive:s_ring' });
    s = applyAction(s, { type: 'choose', value: 'ring' });
    expect(s.players.sauron.ring).toBe(0);
    expect(s.players.sauron.ringBlock).toBe(0);
  });

  it('a forced card is the only card the rival may take, and locked locations cannot be built', () => {
    let s = withAlly('s_force', 1);
    s = applyAction(s, { type: 'ally', value: 'arrive:s_force' });
    const forcedCard = s.prompt!.options[0].value;
    s = applyAction(s, { type: 'choose', value: forcedCard });
    // Sauron takes another card, then it is the Fellowship's turn.
    const other = legalActions(s).find((a) => a.type === 'takeCard' && s.slots[a.slot].cardId !== forcedCard && a.mode === 'discard')!;
    s = settle(applyAction(s, other));
    expect(s.current).toBe('fellowship');
    const cards = legalActions(s).filter((a) => a.type === 'takeCard');
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.every((a) => a.type === 'takeCard' && s.slots[a.slot].cardId === forcedCard)).toBe(true);
    expect(legalActions(s).some((a) => a.type === 'takeLocation')).toBe(false);
  });

  it('closed roads stop the rival moving along them', () => {
    let s = withAlly('s_road', 1);
    s = applyAction(s, { type: 'ally', value: 'arrive:s_road' });
    s = applyAction(s, { type: 'choose', value: s.prompt!.options[0].value });
    expect(s.locks!.roads).toHaveLength(1);
    expect(s.locks!.roads[0].side).toBe('fellowship');
  });

  it('hides the rival\'s Allies and the offer naming them', () => {
    let s = withAlly('s_ring', 1);
    s = applyAction(s, firstCardAction(s));
    const rivalView = redact(s, 'fellowship');
    expect(rivalView.players.sauron.allyHand!.every((a) => a === HIDDEN)).toBe(true);
    expect(rivalView.players.fellowship.allyHand!.every((a) => a !== HIDDEN)).toBe(true);
    expect(rivalView.prompt!.options).toEqual([]);
    expect(redact(s, 'sauron').prompt!.options.length).toBeGreaterThan(1);
  });

  it('random games with Allies always finish', () => {
    for (let seed = 1; seed <= 150; seed++) {
      let s = newGame(seed, ['allies', 'shire', 'grond']);
      let rand = seed;
      let guard = 0;
      while (!s.winner) {
        const actions = legalActions(s);
        expect(actions.length).toBeGreaterThan(0);
        rand = (rand * 1103515245 + 12345) & 0x7fffffff;
        s = applyAction(s, actions[rand % actions.length]);
        if (++guard > 3000) throw new Error(`seed ${seed} did not finish`);
      }
    }
  });

  it('the AI plays a game with Allies to the end', () => {
    let s = newGame(9, ['allies']);
    let guard = 0;
    let r = 1;
    const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    while (!s.winner && guard++ < 600) s = applyAction(s, chooseAction(s, 'easy', rand));
    expect(s.winner).not.toBeNull();
  }, 60_000);
});
