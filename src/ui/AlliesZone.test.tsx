import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { allyChoices, newGame } from '../engine/engine';
import { redact } from '../engine/view';
import { AlliesZone } from './AlliesZone';

describe('AlliesZone online', () => {
  // As a rival's turn ends online, your screen may already let you act while it still shows their turn,
  // whose Allies are redacted: asking which of them can be called used to crash the page.
  it('renders while the rival, whose Allies are hidden, is still the player to move', () => {
    const view = redact(newGame(4, ['allies']), 'fellowship');
    expect(view.current).toBe('sauron');
    expect(allyChoices(view, 'sauron')).toEqual([]);
    const html = renderToString(createElement(AlliesZone, {
      state: view, order: ['sauron', 'fellowship'], showHand: (side) => side === 'fellowship', onAlly: () => {},
    }));
    expect(html).toContain('Aliat ocult');
  });
});
