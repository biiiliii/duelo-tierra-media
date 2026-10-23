import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chooseAction } from '../engine/ai';
import { applyAction, newGame } from '../engine/engine';
import { otherSide } from '../engine/data';
import type { GameState } from '../engine/types';
import { HIDDEN, redact } from '../engine/view';
import { FxDirector } from './fxDirector';

/**
 * A rival's turn and their extra turn arriving online in one poll: the card revealed at the end of the first turn
 * and taken in the extra one is redacted in the final state, so it must not be shown face up with no identity.
 */
function extraTurnThatTakesTheRevealedCard(): { before: GameState; after: GameState } {
  for (let seed = 1; seed < 400; seed++) {
    let r = seed;
    const rand = () => ((r = (r * 1103515245 + 12345) % 2147483648) / 2147483648);
    let s = newGame(seed);
    let turnStart = s;
    while (!s.winner) {
      const next = applyAction(s, chooseAction(s, 'easy', rand));
      if (next.turn !== s.turn) {
        // A turn just ended. Did it end an extra turn that took a card revealed when the previous turn ended?
        const events = next.fx.slice(turnStart.fx.length);
        const extra = events.findIndex((e) => e.t === 'turn' && e.extra);
        const revealed = new Set(events.slice(0, extra).flatMap((e) => (e.t === 'reveal' ? [e.slot] : [])));
        const taken = events.slice(extra).some((e) => e.t === 'card' && revealed.has(e.slot));
        if (extra >= 0 && taken && next.chapter === turnStart.chapter) return { before: turnStart, after: next };
      }
      // The rival's run of turns (extra ones included) starts when the side to move changes.
      if (next.current !== s.current) turnStart = next;
      s = next;
    }
  }
  throw new Error('no such game found');
}

describe('FxDirector', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('window', globalThis);
    vi.stubGlobal('document', { querySelector: () => null });
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('never shows a redacted card face up while replaying a rival turn with an extra turn', () => {
    const { before, after } = extraTurnThatTakesTheRevealedCard();
    const you = otherSide(before.current);
    const director = new FxDirector(redact(before), you, 'normal');
    const shownHidden: number[] = [];
    director.subscribe(() => {
      for (const slot of director.getSnapshot().display.slots) {
        if (slot.faceUp && !slot.taken && slot.cardId === HIDDEN) shownHidden.push(slot.id);
      }
    });
    director.sync(redact(after), you);
    vi.runAllTimers();
    expect(director.getSnapshot().playing).toBe(false);
    expect(shownHidden).toEqual([]);
  });
});
