import { IllegalAction, applyAction, newGame } from '../engine/engine.js';
import { redact } from '../engine/view.js';
import type { Action, GameState, Side } from '../engine/types.js';
import type { JoinResult, PollResult, RoomView, SeatChoice } from './protocol.js';

/** Persisted room. Tokens are secrets that identify each seat. */
export interface RoomRecord {
  code: string;
  version: number;
  state: GameState;
  seats: Record<Side, { token: string | null; name: string | null }>;
  createdAt: number;
}

/** Storage abstraction: Upstash Redis in production, in-memory in tests. */
export interface RoomStore {
  /** Creates the room only if the code is free. */
  create(record: RoomRecord): Promise<boolean>;
  get(code: string): Promise<RoomRecord | null>;
  version(code: string): Promise<number | null>;
  /** Saves only if the stored version still equals `expectedVersion` (compare-and-set). */
  save(record: RoomRecord, expectedVersion: number): Promise<boolean>;
}

export class RoomError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomString(alphabet: string, length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

function cleanName(name: string, fallback: string): string {
  const trimmed = (name ?? '').trim().slice(0, 24);
  return trimmed || fallback;
}

export function normalizeCode(code: string): string {
  return (code ?? '').trim().toUpperCase();
}

function seatOf(record: RoomRecord, token: string | undefined): Side | null {
  if (!token) return null;
  if (record.seats.fellowship.token === token) return 'fellowship';
  if (record.seats.sauron.token === token) return 'sauron';
  return null;
}

export function toView(record: RoomRecord, token?: string): RoomView {
  return {
    code: record.code,
    version: record.version,
    you: seatOf(record, token),
    seats: {
      fellowship: { taken: Boolean(record.seats.fellowship.token), name: record.seats.fellowship.name },
      sauron: { taken: Boolean(record.seats.sauron.token), name: record.seats.sauron.name },
    },
    state: redact(record.state),
  };
}

export async function createRoom(store: RoomStore, side: SeatChoice, name: string): Promise<JoinResult> {
  const mySide: Side = side === 'random' ? (Math.random() < 0.5 ? 'fellowship' : 'sauron') : side;
  const token = randomString(CODE_ALPHABET + 'abcdefghijkmnpqrstuvwxyz', 32);
  for (let attempt = 0; attempt < 10; attempt++) {
    const record: RoomRecord = {
      code: randomString(CODE_ALPHABET, 5),
      version: 1,
      state: newGame(crypto.getRandomValues(new Uint32Array(1))[0]),
      seats: { fellowship: { token: null, name: null }, sauron: { token: null, name: null } },
      createdAt: Date.now(),
    };
    record.seats[mySide] = { token, name: cleanName(name, mySide === 'fellowship' ? 'Comunitat' : 'Sauron') };
    if (await store.create(record)) {
      return { code: record.code, token, side: mySide, room: toView(record, token) };
    }
  }
  throw new RoomError('No s\'ha pogut crear la sala. Torna-ho a provar.', 500);
}

async function load(store: RoomStore, code: string): Promise<RoomRecord> {
  const record = await store.get(normalizeCode(code));
  if (!record) throw new RoomError('Aquesta sala no existeix o ha caducat.', 404);
  return record;
}

export async function joinRoom(store: RoomStore, code: string, name: string, token?: string): Promise<JoinResult> {
  const record = await load(store, code);
  const existing = seatOf(record, token);
  if (existing) return { code: record.code, token: token!, side: existing, room: toView(record, token) };
  const free = (['fellowship', 'sauron'] as Side[]).find((s) => !record.seats[s].token);
  if (!free) throw new RoomError('La sala ja és plena.', 409);
  const newToken = randomString(CODE_ALPHABET + 'abcdefghijkmnpqrstuvwxyz', 32);
  const expected = record.version;
  record.seats[free] = { token: newToken, name: cleanName(name, free === 'fellowship' ? 'Comunitat' : 'Sauron') };
  record.version++;
  if (!(await store.save(record, expected))) throw new RoomError('La sala ha canviat. Torna-ho a provar.', 409);
  return { code: record.code, token: newToken, side: free, room: toView(record, newToken) };
}

export async function pollRoom(store: RoomStore, code: string, token: string | undefined, since: number): Promise<PollResult> {
  const c = normalizeCode(code);
  const version = await store.version(c);
  if (version === null) throw new RoomError('Aquesta sala no existeix o ha caducat.', 404);
  if (version <= since) return { unchanged: true, version };
  return { unchanged: false, room: toView(await load(store, c), token) };
}

export async function actInRoom(
  store: RoomStore, code: string, token: string, version: number, action: Action,
): Promise<RoomView> {
  const record = await load(store, code);
  const side = seatOf(record, token);
  if (!side) throw new RoomError('No ets jugador d\'aquesta sala.', 403);
  if (record.version !== version) throw new RoomError('La partida ha canviat mentrestant. Ja s\'ha actualitzat.', 409);
  if (!record.seats.fellowship.token || !record.seats.sauron.token) {
    throw new RoomError('Encara falta que s\'uneixi el rival.', 409);
  }
  if (record.state.current !== side) throw new RoomError('No és el teu torn.', 409);
  try {
    record.state = applyAction(record.state, action);
  } catch (e) {
    if (e instanceof IllegalAction) throw new RoomError(e.message, 400);
    throw e;
  }
  record.version++;
  if (!(await store.save(record, version))) throw new RoomError('La partida ha canviat mentrestant.', 409);
  return toView(record, token);
}

export async function rematch(store: RoomStore, code: string, token: string): Promise<RoomView> {
  const record = await load(store, code);
  if (!seatOf(record, token)) throw new RoomError('No ets jugador d\'aquesta sala.', 403);
  if (!record.state.winner) throw new RoomError('La partida encara no ha acabat.', 409);
  const expected = record.version;
  record.state = newGame(crypto.getRandomValues(new Uint32Array(1))[0]);
  record.version++;
  if (!(await store.save(record, expected))) throw new RoomError('La sala ha canviat. Torna-ho a provar.', 409);
  return toView(record, token);
}

export class MemoryStore implements RoomStore {
  private rooms = new Map<string, string>();
  async create(record: RoomRecord) {
    if (this.rooms.has(record.code)) return false;
    this.rooms.set(record.code, JSON.stringify(record));
    return true;
  }
  async get(code: string) {
    const raw = this.rooms.get(code);
    return raw ? (JSON.parse(raw) as RoomRecord) : null;
  }
  async version(code: string) {
    return (await this.get(code))?.version ?? null;
  }
  async save(record: RoomRecord, expectedVersion: number) {
    const current = await this.get(record.code);
    if (!current || current.version !== expectedVersion) return false;
    this.rooms.set(record.code, JSON.stringify(record));
    return true;
  }
}
