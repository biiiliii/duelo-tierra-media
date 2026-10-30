import type { GameState, Race, Side } from './types.js';

export const HIDDEN = 'hidden';

/**
 * What a player is allowed to see. Face-down cards, the discard pile, the decks, the alliance piles and
 * the RNG seed (which would reveal every future shuffle) are hidden. Prompt options stay intact: they are
 * exactly what the acting player may legitimately look at (e.g. the discard pile for Barad-dûr), except the offer to
 * call an Ally, which would name the hidden Ally cards. Only `viewer` sees its own hidden Allies.
 */
export function redact(state: GameState, viewer: Side | null = null): GameState {
  const view = structuredClone(state);
  view.seed = 0;
  // Taken slots are hidden too: a discarded card goes face down (played ones are in the player's area).
  view.slots = view.slots.map((s) => (s.faceUp && !s.taken ? s : { ...s, cardId: HIDDEN }));
  view.discard = view.discard.map(() => HIDDEN);
  view.locationDeck = view.locationDeck.map(() => HIDDEN);
  for (const race of Object.keys(view.alliancePiles) as Race[]) {
    view.alliancePiles[race] = view.alliancePiles[race].map(() => HIDDEN);
  }
  for (const side of ['fellowship', 'sauron'] as Side[]) {
    const p = view.players[side];
    if (p.allyHand && side !== viewer) p.allyHand = p.allyHand.map(() => HIDDEN);
  }
  if (view.prompt?.step.k === 'allyOffer' && view.current !== viewer) view.prompt = { ...view.prompt, options: [] };
  if (view.prompt?.drawn) view.prompt = { ...view.prompt, drawn: undefined };
  return view;
}
