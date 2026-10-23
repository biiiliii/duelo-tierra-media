import { describe, expect, it } from 'vitest';
import { isAccessible, legalActions } from '../engine/engine';
import { HIDDEN } from '../engine/view';
import { MemoryStore, actInRoom, createRoom, joinRoom, pollRoom, rematch } from './rooms';

describe('rooms', () => {
  it('creates, joins and plays a full game through the room API', async () => {
    const store = new MemoryStore();
    const host = await createRoom(store, 'sauron', 'Anna');
    expect(host.side).toBe('sauron');
    expect(host.code).toMatch(/^[A-Z2-9]{5}$/);

    // Nobody can act before the rival joins.
    const firstSlot = host.room.state.slots.find((s) => isAccessible(host.room.state, s))!;
    await expect(actInRoom(store, host.code, host.token, host.room.version,
      { type: 'takeCard', slot: firstSlot.id, mode: 'discard' })).rejects.toThrow(/rival/);

    const guest = await joinRoom(store, host.code.toLowerCase(), 'Biel');
    expect(guest.side).toBe('fellowship');
    expect(guest.room.seats.sauron.name).toBe('Anna');

    // Rejoining with the same token returns the same seat; a third player is rejected.
    expect((await joinRoom(store, host.code, 'x', guest.token)).side).toBe('fellowship');
    await expect(joinRoom(store, host.code, 'Intrús')).rejects.toThrow(/plena/);

    // Play until the end, alternating whoever is to move. Uses the full (server) state only to pick moves.
    let version = guest.room.version;
    let guard = 0;
    for (;;) {
      const record = (await store.get(host.code))!;
      if (record.state.winner) break;
      const actor = record.state.current === 'sauron' ? host : guest;
      const other = actor === host ? guest : host;
      const actions = legalActions(record.state);
      const action = actions[guard % actions.length];
      // The wrong player is refused.
      if (guard === 0) {
        await expect(actInRoom(store, host.code, other.token, version, action)).rejects.toThrow(/torn/);
      }
      const view = await actInRoom(store, host.code, actor.token, version, action);
      version = view.version;
      if (++guard > 2000) throw new Error('game did not finish');
    }

    const poll = await pollRoom(store, host.code, host.token, 0);
    expect(poll.unchanged).toBe(false);
    if (!poll.unchanged) expect(poll.room.state.winner).not.toBeNull();
    expect((await pollRoom(store, host.code, host.token, version)).unchanged).toBe(true);

    const again = await rematch(store, host.code, guest.token);
    expect(again.state.winner).toBeNull();
    expect(again.state.chapter).toBe(1);
  });

  it('rejects stale versions', async () => {
    const store = new MemoryStore();
    const host = await createRoom(store, 'sauron', 'A');
    const guest = await joinRoom(store, host.code, 'B');
    const slot = guest.room.state.slots.find((s) => isAccessible(guest.room.state, s))!;
    await expect(actInRoom(store, host.code, host.token, guest.room.version - 1,
      { type: 'takeCard', slot: slot.id, mode: 'discard' })).rejects.toThrow(/canviat/);
  });

  it('never sends hidden information to clients', async () => {
    const store = new MemoryStore();
    const host = await createRoom(store, 'fellowship', 'A');
    const s = host.room.state;
    expect(s.seed).toBe(0);
    expect(s.discard.every((c) => c === HIDDEN)).toBe(true);
    expect(s.locationDeck.every((c) => c === HIDDEN)).toBe(true);
    expect(Object.values(s.alliancePiles).flat().every((t) => t === HIDDEN)).toBe(true);
    expect(s.slots.filter((sl) => !sl.faceUp).every((sl) => sl.cardId === HIDDEN)).toBe(true);
    expect(s.slots.filter((sl) => sl.faceUp).every((sl) => sl.cardId !== HIDDEN)).toBe(true);
  });

  it('creates a room with the chosen promo tiles, ignores unknown ones and keeps them for the rematch', async () => {
    const store = new MemoryStore();
    const host = await createRoom(store, 'sauron', 'Anna', ['grond', 'balrog' as never]);
    expect(host.room.state.expansions).toEqual(['grond']);
    const guest = await joinRoom(store, host.code, 'Biel');
    const record = (await store.get(host.code))!;
    record.state.winner = { sides: ['sauron'], reason: 'prova' };
    await store.save(record, record.version);
    const again = await rematch(store, host.code, guest.token);
    expect(again.state.expansions).toEqual(['grond']);
    expect(again.state.locationDeck).toHaveLength(5);
  });
});
