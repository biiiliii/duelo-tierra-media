import { createContext, useContext, useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import type { GameState, RegionId, Side } from '../engine/types';
import { FxDirector, loadSpeed, type Effect, type FxSnapshot, type Speed } from './fxDirector';

export interface FxApi extends FxSnapshot {
  setSpeed: (speed: Speed) => void;
  focus: (regions: RegionId[], side: Side) => void;
}

const FxCtx = createContext<FxApi | null>(null);
export const FxProvider = FxCtx.Provider;

/** Runs the animations for a game screen. */
export function useFxDirector(state: GameState, you: Side | null): FxApi {
  const [director] = useState(() => new FxDirector(state, you, loadSpeed()));
  useLayoutEffect(() => director.sync(state, you), [director, state, you]);
  useEffect(() => () => director.dispose(), [director]);
  const snap = useSyncExternalStore(director.subscribe, director.getSnapshot);
  return { ...snap, setSpeed: director.setSpeed, focus: director.focus };
}

const EMPTY: Effect[] = [];

/** The effects of some kinds currently on screen (none outside a game screen). */
export function useEffects<T extends Effect['fx']['t']>(...kinds: T[]): (Effect & { fx: Extract<Effect['fx'], { t: T }> })[] {
  const api = useContext(FxCtx);
  const list = api?.effects ?? EMPTY;
  return list.filter((e) => (kinds as string[]).includes(e.fx.t)) as (Effect & { fx: Extract<Effect['fx'], { t: T }> })[];
}

export function useFx(): FxApi | null {
  return useContext(FxCtx);
}
