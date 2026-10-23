import { applyAction, newGame } from './engine.js';
import type { Action, Expansion, GameState, Side } from './types.js';

/**
 * Everything needed to rebuild a game exactly: the seed deals the cards, so the seed plus every move (the AI's
 * included) gives back each position, face-down cards and all.
 */
export interface GameRecord {
  seed: number;
  actions: Action[];
  /** Promo tiles in play, if any. */
  expansions?: Expansion[];
  /** AI level the human played against, if any. */
  level?: string;
  you?: Side;
  /** Times the human pressed Undo (the moves undone are not kept). */
  undos?: number;
  /** Build of the game that played it, in case the rules change later. */
  version?: string;
}

const PREFIX = 'DUELO1';

/** "p3"/"d3": play or discard the card in slot 3; "l:bree": build a key location; "o:arnor": answer a decision. */
export function encodeAction(a: Action): string {
  if (a.type === 'takeCard') return `${a.mode === 'play' ? 'p' : 'd'}${a.slot}`;
  if (a.type === 'takeLocation') return `l:${a.id}`;
  return `o:${a.value}`;
}

export function decodeAction(s: string): Action {
  if (s.startsWith('l:')) return { type: 'takeLocation', id: s.slice(2) };
  if (s.startsWith('o:')) return { type: 'choose', value: s.slice(2) };
  const mode = s[0] === 'p' ? 'play' : s[0] === 'd' ? 'discard' : null;
  const slot = Number(s.slice(1));
  if (!mode || !Number.isInteger(slot)) throw new Error(`Jugada desconeguda: ${s}`);
  return { type: 'takeCard', slot, mode };
}

/** One line of text: DUELO1;seed=…;exp=shire+grond;ia=…;tu=…;desfes=…;v=…;jugades=p3,d5,l:bree,o:arnor */
export function encodeRecord(r: GameRecord): string {
  const fields = [PREFIX, `seed=${r.seed}`];
  if (r.expansions?.length) fields.push(`exp=${r.expansions.join('+')}`);
  if (r.level) fields.push(`ia=${r.level}`);
  if (r.you) fields.push(`tu=${r.you}`);
  if (r.undos !== undefined) fields.push(`desfes=${r.undos}`);
  if (r.version) fields.push(`v=${r.version}`);
  fields.push(`jugades=${r.actions.map(encodeAction).join(',')}`);
  return fields.join(';');
}

/** Finds the game code anywhere in a pasted text and reads it. */
export function decodeRecord(text: string): GameRecord {
  const line = text.split(/\s+/).find((w) => w.startsWith(`${PREFIX};`));
  if (!line) throw new Error(`No hi ha cap codi ${PREFIX} al text.`);
  const fields = Object.fromEntries(line.split(';').slice(1).map((f) => {
    const i = f.indexOf('=');
    return [f.slice(0, i), f.slice(i + 1)];
  }));
  return {
    seed: Number(fields.seed),
    actions: fields.jugades ? fields.jugades.split(',').map(decodeAction) : [],
    expansions: fields.exp ? (fields.exp.split('+') as Expansion[]) : undefined,
    level: fields.ia,
    you: fields.tu as Side | undefined,
    undos: fields.desfes === undefined ? undefined : Number(fields.desfes),
    version: fields.v,
  };
}

/** Every position of the game, from the deal to the last move. */
export function replay(r: GameRecord): GameState[] {
  const states = [newGame(r.seed, r.expansions)];
  for (const a of r.actions) states.push(applyAction(states[states.length - 1], a));
  return states;
}
