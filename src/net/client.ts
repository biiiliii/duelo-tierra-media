import { useCallback, useEffect, useRef, useState } from 'react';
import type { Action, Side } from '../engine/types.js';
import type { JoinResult, PollResult, RoomRequest, RoomView, SeatChoice } from './protocol.js';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function call<T>(init: RequestInit, query = ''): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/room${query}`, { ...init, headers: { 'Content-Type': 'application/json' } });
  } catch {
    throw new ApiError('No hi ha connexió amb el servidor.', 0);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? 'Error del servidor.', res.status);
  return body as T;
}

const post = <T>(req: RoomRequest) => call<T>({ method: 'POST', body: JSON.stringify(req) });

// ---------- seat persistence (so a reload keeps your seat) ----------

interface StoredSeat { token: string; side: Side }
const seatKey = (code: string) => `duelo:seat:${code}`;

export function loadSeat(code: string): StoredSeat | null {
  try {
    const raw = localStorage.getItem(seatKey(code));
    return raw ? (JSON.parse(raw) as StoredSeat) : null;
  } catch {
    return null;
  }
}

function saveSeat(code: string, seat: StoredSeat): void {
  try {
    localStorage.setItem(seatKey(code), JSON.stringify(seat));
  } catch {
    /* private mode: the seat only lasts for this tab */
  }
}

export function loadName(): string {
  try {
    return localStorage.getItem('duelo:name') ?? '';
  } catch {
    return '';
  }
}

export function saveName(name: string): void {
  try {
    localStorage.setItem('duelo:name', name);
  } catch {
    /* ignore */
  }
}

export async function createRoom(side: SeatChoice, name: string): Promise<JoinResult> {
  const result = await post<JoinResult>({ op: 'create', side, name });
  saveSeat(result.code, { token: result.token, side: result.side });
  return result;
}

export async function joinRoom(code: string, name: string): Promise<JoinResult> {
  const result = await post<JoinResult>({ op: 'join', code, name, token: loadSeat(code.toUpperCase())?.token });
  saveSeat(result.code, { token: result.token, side: result.side });
  return result;
}

// ---------- live room hook ----------

export interface LiveRoom {
  room: RoomView | null;
  error: string | null;
  /** True when the room does not exist (expired / wrong code). */
  missing: boolean;
  act: (action: Action) => Promise<void>;
  rematch: () => Promise<void>;
  sending: boolean;
}

/** Polls the room: fast while waiting for the rival, slow while it's your own turn. */
export function useLiveRoom(code: string, token: string | null): LiveRoom {
  const [room, setRoom] = useState<RoomView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [sending, setSending] = useState(false);
  const versionRef = useRef(0);
  const roomRef = useRef<RoomView | null>(null);

  const accept = useCallback((view: RoomView) => {
    if (view.version >= versionRef.current) {
      versionRef.current = view.version;
      roomRef.current = view;
      setRoom(view);
    }
  }, []);

  const poll = useCallback(async () => {
    const q = `?code=${encodeURIComponent(code)}&since=${versionRef.current}` +
      (token ? `&token=${encodeURIComponent(token)}` : '');
    try {
      const result = await call<PollResult>({ method: 'GET' }, q);
      if (!result.unchanged) accept(result.room);
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setMissing(true);
      else setError(e instanceof Error ? e.message : String(e));
    }
  }, [code, token, accept]);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const loop = async () => {
      if (!alive) return;
      await poll();
      const r = roomRef.current;
      const myTurn = r && r.you && r.state.current === r.you && !r.state.winner;
      const bothSeated = r && r.seats.fellowship.taken && r.seats.sauron.taken;
      const delay = document.hidden ? 8000 : myTurn && bothSeated ? 6000 : 1500;
      timer = setTimeout(loop, delay);
    };
    loop();
    const onVisible = () => { if (!document.hidden) poll(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [poll]);

  const act = useCallback(async (action: Action) => {
    if (!token || !roomRef.current) return;
    setSending(true);
    try {
      accept(await post<RoomView>({ op: 'action', code, token, version: roomRef.current.version, action }));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      if (e instanceof ApiError && e.status === 409) await poll();
    } finally {
      setSending(false);
    }
  }, [code, token, accept, poll]);

  const rematch = useCallback(async () => {
    if (!token) return;
    try {
      accept(await post<RoomView>({ op: 'rematch', code, token }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [code, token, accept]);

  return { room, error, missing, act, rematch, sending };
}
