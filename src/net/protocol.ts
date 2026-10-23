import type { Action, Expansion, GameState, Side } from '../engine/types.js';

export type SeatChoice = Side | 'random';

export interface SeatInfo {
  taken: boolean;
  name: string | null;
}

/** What the server sends to a client: always redacted, plus room metadata. */
export interface RoomView {
  code: string;
  version: number;
  /** The side of the player who asked (null for a spectator / unknown token). */
  you: Side | null;
  seats: Record<Side, SeatInfo>;
  state: GameState;
}

export type RoomRequest =
  | { op: 'create'; side: SeatChoice; name: string; expansions?: Expansion[] }
  | { op: 'join'; code: string; name: string; token?: string }
  | { op: 'action'; code: string; token: string; version: number; action: Action }
  | { op: 'rematch'; code: string; token: string };

export interface JoinResult {
  code: string;
  token: string;
  side: Side;
  room: RoomView;
}

export type PollResult = { unchanged: true; version: number } | { unchanged: false; room: RoomView };
