import { applyFx } from '../engine/fx';
import type { Fx, GameState, RegionId, Side } from '../engine/types';

export type Speed = 'normal' | 'fast' | 'off';
export const SPEED_FACTOR: Record<Speed, number> = { normal: 1, fast: 0.5, off: 0 };

export interface Rect { x: number; y: number; w: number; h: number }

/** One animation on screen. Components pick the ones they draw by `fx.t`. */
export interface Effect {
  id: number;
  fx: Fx;
  /** How long it stays on screen, in ms (already scaled by the speed). */
  life: number;
  /** The log line that describes it. */
  text: string;
  /** Part of the rival's turn being replayed (gets the big, slow version). */
  rival: boolean;
  /** Where a flying thing starts and lands, in viewport pixels. */
  from?: Rect;
  to?: Rect;
  /** The card being shown (for a discard it is read from the formation, as the event does not carry it). */
  cardId?: string;
}

export interface FxSnapshot {
  /** The state to draw: lags behind the real one while the rival's turn is replayed. */
  display: GameState;
  effects: Effect[];
  /** Regions touched recently, glowing in the colour of who touched them. */
  marks: Partial<Record<RegionId, Side>>;
  /** True while the rival's turn is being replayed: the player cannot act yet. */
  playing: boolean;
  speed: Speed;
  you: Side | null;
}

interface Batch { events: Fx[]; final: GameState; rival: boolean }

/** How long the replay waits on each kind of event before the next one (ms at normal speed). */
const STEP: Record<Fx['t'], number> = {
  turn: 0, chapter: 1900, card: 2400, free: 2200, location: 2300, coins: 450, ring: 1000, units: 850, move: 950,
  conflict: 1100, kill: 850, fortress: 950, raze: 950, token: 1500, burn: 1600, extra: 900, reveal: 300,
};

/** How long each animation stays on screen (ms at normal speed). */
const LIFE: Record<Fx['t'], number> = {
  turn: 1500, chapter: 2000, card: 2400, free: 2200, location: 2300, coins: 1300, ring: 1600, units: 1300, move: 1400,
  conflict: 1500, kill: 1200, fortress: 1400, raze: 1400, token: 1500, burn: 1600, extra: 1200, reveal: 700,
};

/** Effects that only make sense as part of a replay (your own moves you already saw). */
const SHOWCASE = new Set<Fx['t']>(['card', 'free', 'location', 'token', 'burn']);

const MARK_LIFE = 5000;
const SPEED_KEY = 'duelo.fxSpeed';

export function loadSpeed(): Speed {
  try {
    const saved = localStorage.getItem(SPEED_KEY);
    if (saved === 'normal' || saved === 'fast' || saved === 'off') return saved;
  } catch { /* storage blocked */ }
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches ? 'off' : 'normal';
}

export function fxRegions(e: Fx): RegionId[] {
  switch (e.t) {
    case 'units': case 'conflict': case 'kill': case 'fortress': case 'raze': return [e.region];
    case 'move': return [e.from, e.to];
    default: return [];
  }
}

function rectOf(key: string): Rect | undefined {
  const el = document.querySelector(`[data-fx="${key}"]`);
  if (!el) return undefined;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return undefined;
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

/**
 * Turns new game events into animations. Your own moves show at once with light effects; the rival's turn is
 * replayed one event at a time on a copy of the board, so you see each thing happen in order.
 */
export class FxDirector {
  private snap: FxSnapshot;
  private listeners = new Set<() => void>();
  private queue: Batch[] = [];
  private latest: GameState;
  private seen: number;
  private running = false;
  private timers = new Set<number>();
  private markTimers = new Map<RegionId, number>();
  private nextId = 1;
  private quietUntil = 0;

  constructor(state: GameState, you: Side | null, speed: Speed) {
    this.latest = state;
    this.seen = state.fx?.length ?? 0;
    this.snap = { display: state, effects: [], marks: {}, playing: false, speed, you };
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  getSnapshot = () => this.snap;

  private set(patch: Partial<FxSnapshot>) {
    this.snap = { ...this.snap, ...patch };
    for (const l of this.listeners) l();
  }

  private later(fn: () => void, ms: number) {
    const id = window.setTimeout(() => { this.timers.delete(id); fn(); }, ms);
    this.timers.add(id);
  }

  private get k() { return SPEED_FACTOR[this.snap.speed]; }

  /** Call with every new state from the game. */
  sync(state: GameState, you: Side | null) {
    if (you !== this.snap.you) this.set({ you });
    if (state === this.latest) return;
    const fx = state.fx ?? [];
    const prev = this.latest;
    this.latest = state;
    // A new game, a rematch or an undo: start over without replaying anything.
    if (fx.length < this.seen || state.log.length < prev.log.length) {
      this.stop();
      this.seen = fx.length;
      this.set({ display: state, effects: [], marks: {}, playing: false });
      return;
    }
    const events = fx.slice(this.seen);
    this.seen = fx.length;
    if (events.length === 0) {
      if (!this.running) this.set({ display: state });
      return;
    }
    const rival = you !== null && events.some((e) => e.t !== 'turn' && e.by !== you);
    if (this.snap.speed === 'off') {
      for (const e of events) this.mark(e);
      if (!this.running) this.set({ display: state });
      return;
    }
    this.queue.push({ events, final: state, rival });
    if (rival) this.set({ playing: true });
    if (!this.running) this.next();
  }

  setSpeed = (speed: Speed) => {
    try { localStorage.setItem(SPEED_KEY, speed); } catch { /* storage blocked */ }
    this.set({ speed });
    if (speed === 'off') {
      // Jump to the end of any replay in progress.
      this.stop(false);
      this.set({ display: this.latest, effects: [], playing: false });
    }
  };

  /** Makes regions glow for a moment (from the turn summary). */
  focus = (regions: RegionId[], side: Side) => {
    for (const r of regions) this.markRegion(r, side, 2500);
  };

  dispose() {
    this.stop();
  }

  private stop(clearMarks = true) {
    for (const id of this.timers) window.clearTimeout(id);
    this.timers.clear();
    if (clearMarks) {
      for (const id of this.markTimers.values()) window.clearTimeout(id);
      this.markTimers.clear();
    }
    this.queue = [];
    this.running = false;
    this.quietUntil = 0;
  }

  private next() {
    const batch = this.queue.shift();
    if (!batch) {
      this.running = false;
      this.set({ display: this.latest, playing: false });
      return;
    }
    this.running = true;
    if (!batch.rival) {
      // Your own move: the board updates at once and the effects play over it.
      this.set({ display: batch.final });
      batch.events.forEach((e, i) => {
        if (SHOWCASE.has(e.t)) return;
        this.later(() => this.spawn(e, batch.final, false), i * 120 * this.k);
      });
      this.next();
      return;
    }
    this.set({ playing: true });
    this.later(() => this.replay(batch, 0), Math.max(0, this.quietUntil - Date.now()));
  }

  private replay(batch: Batch, i: number) {
    if (i >= batch.events.length) {
      this.set({ display: batch.final });
      this.next();
      return;
    }
    const e = batch.events[i];
    // Measure the source (e.g. the card in the formation) before the board changes under it.
    this.spawn(e, batch.final, true);
    const display = structuredClone(this.snap.display);
    if (e.t === 'chapter') {
      display.slots = batch.final.slots;
      display.locationsFaceUp = batch.final.locationsFaceUp;
    }
    if (e.t === 'reveal') {
      // Online the hidden card is redacted in the old state: take it from the final one (same chapter only).
      const slot = batch.final.slots[e.slot];
      if (batch.final.chapter === display.chapter && slot) display.slots[e.slot] = { ...slot, taken: false, faceUp: true };
    } else {
      applyFx(display, e);
    }
    const index = batch.final.fx.length - batch.events.length + i;
    display.log = batch.final.log.slice(0, Math.max(e.at, display.log.length));
    display.fx = batch.final.fx.slice(0, index + 1);
    this.set({ display });
    this.later(() => this.replay(batch, i + 1), STEP[e.t] * this.k);
  }

  private spawn(e: Fx, final: GameState, rival: boolean): Effect {
    const k = this.k;
    const effect: Effect = {
      id: this.nextId++,
      fx: e,
      life: LIFE[e.t] * k,
      text: e.t === 'turn' ? '' : final.log[e.at - 1] ?? '',
      rival,
    };
    if (rival && SHOWCASE.has(e.t)) {
      const panel = (side: Side) => rectOf(`panel-${side}`);
      if (e.t === 'card') {
        effect.from = rectOf(`slot-${e.slot}`);
        effect.to = panel(e.by);
        effect.cardId = e.cardId ?? this.snap.display.slots[e.slot]?.cardId;
      } else if (e.t === 'location') {
        effect.from = rectOf(`loc-${e.id}`);
        effect.to = panel(e.by);
      } else if (e.t === 'free') {
        effect.to = panel(e.by);
        effect.cardId = e.cardId;
      } else if (e.t === 'token') {
        effect.to = panel(e.side);
      } else if (e.t === 'burn') {
        effect.from = panel(e.side);
        effect.cardId = e.cardId;
      }
    }
    if (e.t === 'turn' || e.t === 'chapter') this.quietUntil = Date.now() + effect.life;
    this.mark(e);
    this.set({ effects: [...this.snap.effects, effect] });
    this.later(() => this.set({ effects: this.snap.effects.filter((x) => x.id !== effect.id) }), effect.life);
    return effect;
  }

  private mark(e: Fx) {
    for (const r of fxRegions(e)) this.markRegion(r, e.by, MARK_LIFE);
  }

  private markRegion(region: RegionId, side: Side, ms: number) {
    const old = this.markTimers.get(region);
    if (old) window.clearTimeout(old);
    this.markTimers.set(region, window.setTimeout(() => {
      this.markTimers.delete(region);
      const marks = { ...this.snap.marks };
      delete marks[region];
      this.set({ marks });
    }, ms));
    if (this.snap.marks[region] !== side) this.set({ marks: { ...this.snap.marks, [region]: side } });
  }
}
