import { ADJACENT, CARDS, LOCATIONS, REGION_IDS, RING_LENGTH, otherSide } from './data.js';
import { cardCost, chainSymbols, locationCost, skillPool } from './costs.js';
import { isAccessible, presence, raceSymbols } from './engine.js';
import type { GameState, Side, Skill } from './types.js';

const SKILLS: Skill[] = ['mask', 'fist', 'heart', 'book', 'crown'];

/** Alliances that feed combos: another turn per key location or yellow card, cheaper locations, double coins per discard. */
export const COMBO_TOKENS = ['dwarves_loc_turn', 'dwarves_loc_discount', 'men_discard_double', 'elves_yellow_turn'];

/**
 * Regions `side` could add right now by building face-up key locations where it is absent: one, or as many as its
 * coins pay for in a row when each location gives it another turn.
 */
export function locationReach(state: GameState, side: Side): number {
  const p = state.players[side];
  const costs = state.locationsFaceUp
    .filter((id) => {
      const r = state.regions[LOCATIONS[id].region];
      return r.fortress !== side && r.units[side] === 0;
    })
    .map((id) => locationCost(state, side, id).coins)
    .sort((a, b) => a - b);
  if (costs.length === 0 || costs[0] > p.coins) return 0;
  if (!p.tokens.includes('dwarves_loc_turn')) return 1;
  // Each fortress built makes the next location 1 coin dearer, unless the discount alliance waives it.
  const step = p.tokens.includes('dwarves_loc_discount') ? 0 : 1;
  let spent = 0;
  let n = 0;
  for (const c of costs) {
    if (spent + c + n * step > p.coins) break;
    spent += c + n * step;
    n++;
  }
  return n;
}

export const SIDE_FEATURES = [
  'ring', 'ringLate', 'ringNear', 'ringLast', 'races', 'races4', 'races5', 'presence', 'presence6', 'units',
  'fortresses', 'fragile', 'coins', 'coinsOver8', 'skills', 'skillsOver2', 'flexSkills', 'chains', 'tokens',
  'comboTokens', 'reach7', 'presence5', 'unitsOver3', 'reserveEmpty', 'contested', 'reachable', 'redCards',
  // Fortresses are presence no conflict can take away: many of them all but decide the end of chapter 3.
  'fortresses4', 'fortresses5', 'fortresses6',
] as const;

/** What one player has, as numbers (in the order of SIDE_FEATURES). */
export function sideFeatures(state: GameState, side: Side): number[] {
  const p = state.players[side];
  const ringLeft = RING_LENGTH - p.ring;
  const races = raceSymbols(state, side).size;
  const pres = presence(state, side);
  let units = 0;
  let fortresses = 0;
  let fragile = 0;
  let unitsOver3 = 0;
  let contested = 0;
  const opp = otherSide(side);
  for (const r of Object.values(state.regions)) {
    units += Math.min(r.units[side], 3);
    unitsOver3 += Math.max(0, r.units[side] - 3);
    const mine = r.units[side] > 0 || r.fortress === side;
    if (mine && (r.units[opp] > 0 || r.fortress === opp)) contested++;
    if (r.fortress === side) fortresses++;
    else if (r.units[side] === 1) fragile++;
  }
  // Regions where it is absent but could move in from a neighbour holding its units.
  const reachable = REGION_IDS.filter((id) => {
    const r = state.regions[id];
    return r.units[side] === 0 && r.fortress !== side && ADJACENT[id].some((n) => state.regions[n].units[side] > 0);
  }).length;
  // Red cards on offer that it could pay for: units ready to take regions.
  const redCards = state.slots.filter((slot) => isAccessible(state, slot) && CARDS[slot.cardId].effect.military &&
    slot.faceUp && cardCost(state, side, slot.cardId).affordable).length;
  const pool = skillPool(state, side);
  let skills = 0;
  let skillsOver2 = 0;
  for (const s of SKILLS) {
    skills += Math.min(pool.fixed[s], 2);
    skillsOver2 += Math.max(0, pool.fixed[s] - 2);
  }
  return [
    p.ring, Math.max(0, p.ring - 9), Number(ringLeft <= 2), Number(ringLeft === 1),
    races, Number(races >= 4), Number(races >= 5),
    pres, Number(pres >= 6), units, fortresses, fragile,
    Math.min(p.coins, 8), Math.max(0, p.coins - 8), skills, skillsOver2, pool.flexible.length,
    chainSymbols(state, side).size, p.tokens.length, p.tokens.filter((t) => COMBO_TOKENS.includes(t)).length,
    Number(pres + locationReach(state, side) >= REGION_IDS.length),
    Number(pres >= 5), unitsOver3, Number(p.unitsSupply === 0), contested, reachable, redCards,
    Number(fortresses >= 4), Number(fortresses >= 5), Number(fortresses >= 6),
  ];
}

/** Share of the current chapter's cards already taken (0 at its start, 1 at its end). */
export function chapterProgress(state: GameState): number {
  return state.slots.filter((slot) => slot.taken).length / state.slots.length;
}

/**
 * A position seen by the player to move: its features minus the rival's, and the context they are weighed in.
 */
export interface Sample {
  chapter: number;
  progress: number;
  sauron: number;
  extraTurns: number;
  diff: number[];
}

export function sample(state: GameState): Sample {
  const mover = state.current;
  const mine = sideFeatures(state, mover);
  const theirs = sideFeatures(state, otherSide(mover));
  return {
    chapter: state.chapter,
    progress: chapterProgress(state),
    sauron: Number(mover === 'sauron'),
    extraTurns: state.extraTurns,
    diff: mine.map((v, i) => v - theirs[i]),
  };
}

/**
 * Chance-of-winning model fitted on self-play games, one set of coefficients per chapter:
 * [bias, sauron, extraTurns, ...one weight per feature at the chapter's start, ...its change by the chapter's end].
 */
export interface LearnedModel {
  chapters: number[][];
}

/** Logit of the player to move winning (a draw counts as half a win). */
export function predict(model: LearnedModel, s: Sample): number {
  const c = model.chapters[s.chapter - 1];
  const n = s.diff.length;
  let z = c[0] + c[1] * s.sauron + c[2] * s.extraTurns;
  for (let i = 0; i < n; i++) z += (c[3 + i] + c[3 + n + i] * s.progress) * s.diff[i];
  return z;
}
