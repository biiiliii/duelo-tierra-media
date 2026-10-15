import { describe, expect, it } from 'vitest';
import { legalActions } from '../engine/engine';
import { RedisStore } from './redisStore';
import { actInRoom, createRoom, joinRoom, pollRoom } from './rooms';

// Runs only when real Upstash credentials are present (e.g. after `vercel env pull`).
const live = process.env.KV_REST_API_URL ? describe : describe.skip;

live('RedisStore against Upstash', () => {
  it('creates a room, joins, plays a few moves and enforces compare-and-set', async () => {
    const store = new RedisStore();
    const host = await createRoom(store, 'sauron', 'Test A');
    const guest = await joinRoom(store, host.code, 'Test B');
    let version = guest.room.version;
    for (let i = 0; i < 6; i++) {
      const record = (await store.get(host.code))!;
      const actor = record.state.current === 'sauron' ? host : guest;
      const view = await actInRoom(store, host.code, actor.token, version, legalActions(record.state)[0]);
      expect(view.version).toBe(version + 1);
      version = view.version;
    }
    expect((await pollRoom(store, host.code, host.token, version)).unchanged).toBe(true);
    const stale = (await store.get(host.code))!;
    expect(await store.save(stale, version - 1)).toBe(false);
  }, 30_000);
});
