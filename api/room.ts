import { RedisStore } from '../src/net/redisStore.js';
import { RoomError, actInRoom, createRoom, joinRoom, pollRoom, rematch } from '../src/net/rooms.js';
import type { RoomRequest } from '../src/net/protocol.js';

let store: RedisStore | null = null;
const getStore = () => (store ??= new RedisStore());

function fail(e: unknown): Response {
  if (e instanceof RoomError) return Response.json({ error: e.message }, { status: e.status });
  console.error(e);
  return Response.json({ error: 'Error del servidor. Torna-ho a provar.' }, { status: 500 });
}

const noStore = { 'Cache-Control': 'no-store' };

/** GET /api/room?code=ABCDE&token=...&since=3 → changes since a version (polling). */
export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code') ?? '';
    const token = url.searchParams.get('token') ?? undefined;
    const since = Number(url.searchParams.get('since') ?? 0);
    return Response.json(await pollRoom(getStore(), code, token, since), { headers: noStore });
  } catch (e) {
    return fail(e);
  }
}

/** POST /api/room with a RoomRequest body. */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as RoomRequest;
    const s = getStore();
    switch (body.op) {
      case 'create':
        return Response.json(await createRoom(s, body.side, body.name, body.expansions), { headers: noStore });
      case 'join':
        return Response.json(await joinRoom(s, body.code, body.name, body.token), { headers: noStore });
      case 'action':
        return Response.json(await actInRoom(s, body.code, body.token, body.version, body.action), { headers: noStore });
      case 'rematch':
        return Response.json(await rematch(s, body.code, body.token), { headers: noStore });
      default:
        return Response.json({ error: 'Operació desconeguda.' }, { status: 400 });
    }
  } catch (e) {
    return fail(e);
  }
}
