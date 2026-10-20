import { RACES, REGION_IDS, RING_LENGTH, otherSide } from './data.js';
import { chainSymbols, skillPool } from './costs.js';
import { COMBO_TOKENS, locationReach, predict, sample, type LearnedModel } from './features.js';
import { applyAction, legalActions, presence, raceSymbols } from './engine.js';
import type { Action, GameState, Side, Skill } from './types.js';

export type AiLevel = 'easy' | 'normal' | 'hard' | 'impossible';

type Rand = () => number;

export interface LevelConfig {
  /** Chance of ignoring the search and playing any legal move. */
  blunder: number;
  /** Random noise added to each candidate's score. */
  noise: number;
  /** Independent guesses of the hidden cards to average over. */
  samples: number;
  /** Options kept at each decision inside a simulated turn. */
  beam: number;
  /** Positions examined per candidate move. */
  nodes: number;
  /** Turns looked ahead: 1 plans only its own turn, 2 also expects the rival's best answer. */
  depth: number;
  /** Most promising ways to finish a turn that are followed into the next one. */
  replies: number;
  /** Candidate moves given the deep search, picked by a quick first pass. */
  shortlist: number;
  /** Pending decisions looked through when ranking options, so a card is judged by its best follow-up. */
  peek: number;
  /** Extra turns belong to the turn that earned them, so a rival's combo of several turns in a row is seen whole. */
  wholeTurns?: boolean;
  weights: Weights;
}


const WIN = 100_000;
const SKILLS: Skill[] = ['mask', 'fist', 'heart', 'book', 'crown'];
const RACE_VALUE = [0, 4, 9, 16, 26, 44, 0];

/** What the AI values in a position. */
export interface Weights {
  ring: number;
  ringLate: number;
  races: number;
  presence: number;
  presence6: number;
  unit: number;
  unitCap: number;
  fortress: number;
  /** How much more the map counts in each later chapter. */
  mapSlope: number;
  coin: number;
  /** Share of a coin's value kept beyond 8 coins: a hoarder saves up for several key locations in a row. */
  hoard: number;
  skill: number;
  flexSkill: number;
  chain: number;
  token: number;
  /** Extra value of the alliances that feed combos: another turn per key location, double coins per discard... */
  combo: number;
  /** A rival that can build its way to 7 regions with the key locations it can already afford. */
  burst: number;
  /** How much less the economy counts in each later chapter. */
  economySlope: number;
  threat: number;
  extraTurn: number;
  /** Regions held by a single unit and no fortress: one enemy action takes them. */
  fragile: number;
  /** Being ahead on regions late in chapter 3, when that decides the game. */
  endLead: number;
  /** When given, the position is judged by this model fitted on self-play games instead of the weights above. */
  learned?: LearnedModel;
}

/** Converts the model's winning odds (a logit) into points comparable with the hand-made evaluation. */
const LEARNED_SCALE = 100;

export const BASE_WEIGHTS: Weights = {
  ring: 6, ringLate: 9, races: 1, presence: 7, presence6: 30, unit: 1.2, unitCap: 3, fortress: 4, mapSlope: 0.35,
  coin: 2, hoard: 0.25, skill: 3, flexSkill: 3, chain: 2.5, token: 4, combo: 0, burst: 0, economySlope: 0.3, threat: 1, extraTurn: 6,
  fragile: 0, endLead: 0,
};

/** Hard plays with weights tuned by self-play; it wins about 70% of its games against Normal. */
export const TUNED_WEIGHTS: Weights = {
  ...BASE_WEIGHTS, races: 2.5, ring: 3, ringLate: 4, presence: 10, presence6: 40, token: 6,
};

/** Retuned by self-play, first against Hard and then against itself: skills, units and alliances matter more, early ring steps less. */
export const IMPOSSIBLE_WEIGHTS: Weights = { ...TUNED_WEIGHTS, ring: 1.5, skill: 4.8, unit: 1.92, token: 9.6 };

const SHALLOW = { depth: 1, replies: 1, shortlist: Infinity, peek: 0 };

// Impossible also expects the rival's best answer; it wins about 80% of its games against Hard.

export const LEVELS: Record<AiLevel, LevelConfig> = {
  easy: { blunder: 0.4, noise: 20, samples: 1, beam: 2, nodes: 400, ...SHALLOW, weights: BASE_WEIGHTS },
  normal: { blunder: 0, noise: 2, samples: 1, beam: 3, nodes: 400, ...SHALLOW, weights: BASE_WEIGHTS },
  hard: { blunder: 0, noise: 0, samples: 2, beam: 3, nodes: 400, ...SHALLOW, weights: TUNED_WEIGHTS },
  impossible: { blunder: 0, noise: 0, samples: 6, beam: 3, nodes: 3000, depth: 2, replies: 4, shortlist: 6, peek: 1, weights: IMPOSSIBLE_WEIGHTS },
};

/**
 * A sparring partner for self-play that plays like the humans who beat Impossible: it collects the alliances that
 * give extra turns and coins, saves up, and builds key locations in a row to reach 7 regions at once.
 */
export const SPARRING: LevelConfig = {
  ...LEVELS.impossible,
  wholeTurns: true,
  weights: { ...IMPOSSIBLE_WEIGHTS, combo: 20, hoard: 0.8, fortress: 8 },
};

// ---------- evaluation ----------

/** How good the position is for `side`, ignoring the rival. */
function score(state: GameState, side: Side, w: Weights): number {
  const p = state.players[side];
  let v = 0;

  // Ring quest: every step counts, the last ones much more.
  v += w.ring * p.ring + Math.max(0, p.ring - 9) * w.ringLate;

  // Races: each new symbol brings the 6-race victory closer.
  v += RACE_VALUE[Math.min(5, raceSymbols(state, side).size)] * w.races;

  // Map: presence wins the game outright (7 regions) and decides the end of chapter 3.
  const pres = presence(state, side);
  const mapWeight = 1 + w.mapSlope * (state.chapter - 1);
  let board = pres * w.presence + (pres >= 6 ? w.presence6 : 0);
  for (const r of Object.values(state.regions)) {
    board += Math.min(r.units[side], w.unitCap) * w.unit;
    if (r.fortress === side) board += w.fortress;
    else if (r.units[side] === 1) board -= w.fragile;
  }
  v += board * mapWeight;

  // Economy: coins, skills and chain symbols make future cards cheaper. Worth less as the game ends.
  const economy = 1.4 - w.economySlope * (state.chapter - 1);
  let eco = w.coin * Math.min(p.coins, 8) + w.hoard * w.coin * Math.max(0, p.coins - 8);
  const pool = skillPool(state, side);
  for (const s of SKILLS) eco += w.skill * Math.min(pool.fixed[s], 2) + (w.skill / 3) * Math.max(0, pool.fixed[s] - 2);
  eco += pool.flexible.length * w.flexSkill;
  eco += chainSymbols(state, side).size * w.chain;
  v += eco * economy;

  v += p.tokens.length * w.token;
  v += p.tokens.filter((t) => COMBO_TOKENS.includes(t)).length * w.combo;
  return v;
}


/** Score from `side`'s point of view: positive is good for it. */
export function evaluate(state: GameState, side: Side, w: Weights = BASE_WEIGHTS): number {
  if (state.winner) {
    if (state.winner.sides.length === 2) return 0;
    return state.winner.sides[0] === side ? WIN : -WIN;
  }
  if (w.learned) {
    const z = LEARNED_SCALE * predict(w.learned, sample(state));
    return state.current === side ? z : -z;
  }
  const opp = otherSide(side);
  let v = score(state, side, w) - score(state, opp, w);
  // Racing threats: a rival one or two steps from any victory must be stopped now.
  v -= (threat(state, opp) - threat(state, side) * 0.5) * w.threat;
  if (state.current === side && !state.prompt) v += w.extraTurn;
  if (w.burst) {
    const reaches = (s: Side) => presence(state, s) + locationReach(state, s) >= REGION_IDS.length;
    v -= w.burst * (Number(reaches(opp)) - 0.5 * Number(reaches(side)));
  }
  if (state.chapter === 3 && w.endLead) {
    const taken = state.slots.filter((slot) => slot.taken).length / state.slots.length;
    v += w.endLead * taken * Math.sign(presence(state, side) - presence(state, opp));
  }
  return v;
}

function threat(state: GameState, side: Side): number {
  const p = state.players[side];
  let t = 0;
  const ringLeft = RING_LENGTH - p.ring;
  if (ringLeft <= 2) t += ringLeft === 1 ? 60 : 30;
  if (raceSymbols(state, side).size >= 5) t += 45;
  if (presence(state, side) >= 6) t += 40;
  return t;
}

// ---------- hidden information ----------

function shuffleInPlace<T>(items: T[], rand: Rand): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

/**
 * A copy of the state where everything the AI cannot see is reshuffled: face-down cards, the discard pile,
 * the location deck, the alliance piles and the seed for future chapters. Searching on it keeps the AI honest.
 */
export function determinize(state: GameState, rand: Rand): GameState {
  const s = structuredClone(state);
  s.log = [];
  s.fx = [];
  s.seed = Math.floor(rand() * 2 ** 31);
  const hidden = s.slots.filter((slot) => !slot.faceUp && !slot.taken);
  // The discard pile is visible while choosing from it (Barad-dûr), so leave it alone then.
  const discardKnown = s.prompt?.step.k === 'playFromDiscard';
  const pool = [...hidden.map((slot) => slot.cardId), ...(discardKnown ? [] : s.discard)];
  shuffleInPlace(pool, rand);
  hidden.forEach((slot, i) => { slot.cardId = pool[i]; });
  if (!discardKnown) s.discard = pool.slice(hidden.length);
  shuffleInPlace(s.locationDeck, rand);
  for (const race of RACES) shuffleInPlace(s.alliancePiles[race], rand);
  return s;
}

// ---------- search ----------

interface Budget { nodes: number }

/** Best score `side` can reach by the end of its current turn (it makes every choice along the way). */
function bestTurnValue(state: GameState, side: Side, beam: number, budget: Budget, startTurn: number, w: Weights): number {
  if (state.winner || state.turn !== startTurn || budget.nodes <= 0) return evaluate(state, side, w);
  let children = legalActions(state).map((a) => applyAction(state, a));
  budget.nodes -= children.length;
  if (children.length > beam) {
    children = children
      .map((c) => ({ c, v: evaluate(c, side, w) }))
      .sort((a, b) => b.v - a.v)
      .slice(0, beam)
      .map((x) => x.c);
  }
  let best = -Infinity;
  for (const child of children) {
    best = Math.max(best, bestTurnValue(child, side, beam, budget, startTurn, w));
    if (best >= WIN) break;
  }
  return best;
}

/**
 * How promising a position is for `side` when choosing which options to explore. A pending decision is judged by
 * its best answer (up to `depth` decisions deep): a card that wins once its units are placed must not look ordinary.
 */
function rank(state: GameState, side: Side, depth: number, budget: Budget, w: Weights): number {
  if (!state.prompt || state.winner || depth === 0 || state.current !== side) return evaluate(state, side, w);
  const actions = legalActions(state);
  budget.nodes -= actions.length;
  return Math.max(...actions.map((a) => rank(applyAction(state, a), side, depth - 1, budget, w)));
}

/** Positions where the current turn can end, each scored for the player making it, best first. */
function turnEnds(state: GameState, cfg: LevelConfig, budget: Budget): { s: GameState; v: number }[] {
  const mover = state.current;
  const w = cfg.weights;
  const ends: { s: GameState; v: number }[] = [];
  const walk = (s: GameState) => {
    if (s.winner || s.turn !== state.turn || budget.nodes <= 0) {
      ends.push({ s, v: evaluate(s, mover, w) });
      return;
    }
    let children = legalActions(s).map((a) => applyAction(s, a));
    budget.nodes -= children.length;
    if (children.length > cfg.beam) {
      children = children
        .map((c) => ({ c, v: rank(c, mover, cfg.peek, budget, w) }))
        .sort((a, b) => b.v - a.v)
        .slice(0, cfg.beam)
        .map((x) => x.c);
    }
    for (const child of children) walk(child);
  };
  walk(state);
  return ends.sort((a, b) => b.v - a.v);
}

/** Value for `side` after `turns` more turns, each player finishing its turn in its own best way. */
function lookahead(state: GameState, side: Side, turns: number, cfg: LevelConfig, budget: Budget): number {
  if (state.winner || turns === 0 || budget.nodes <= 0) return evaluate(state, side, cfg.weights);
  const ends = turnEnds(state, cfg, budget).slice(0, cfg.replies);
  const values = ends.map((e) => {
    const sameMover = cfg.wholeTurns && !e.s.winner && e.s.current === state.current;
    return lookahead(e.s, side, sameMover ? turns : turns - 1, cfg, budget);
  });
  return state.current === side ? Math.max(...values) : Math.min(...values);
}

/** Value of each listed action in one guess of the hidden cards. */
function scoreActions(state: GameState, actions: Action[], cfg: LevelConfig): number[] {
  return actions.map((a) => {
    const next = applyAction(state, a);
    const budget = { nodes: cfg.nodes };
    return cfg.depth > 1
      ? lookahead(next, state.current, cfg.depth, cfg, budget)
      : bestTurnValue(next, state.current, cfg.beam, budget, state.turn, cfg.weights);
  });
}

/** Average value of each action over several guesses of the hidden cards. */
function averageScores(worlds: GameState[], actions: Action[], cfg: LevelConfig): number[] {
  const totals = new Array(actions.length).fill(0);
  for (const world of worlds) {
    scoreActions(world, actions, cfg).forEach((v, j) => { totals[j] += v; });
  }
  return totals.map((t) => t / worlds.length);
}

/** Picks the AI's next action: a card, a key location, or an answer to the pending decision. */
export function chooseAction(state: GameState, level: AiLevel | LevelConfig, rand: Rand = Math.random): Action {
  let actions = legalActions(state);
  if (actions.length === 0) throw new Error('No legal actions');
  if (actions.length === 1) return actions[0];
  const cfg = typeof level === 'string' ? LEVELS[level] : level;
  if (rand() < cfg.blunder) return actions[Math.floor(rand() * actions.length)];

  const worlds = Array.from({ length: cfg.samples }, () => determinize(state, rand));
  // The deep search is costly, so only the moves that look best on a quick pass get it.
  if (cfg.depth > 1 && actions.length > cfg.shortlist) {
    const quick = averageScores(worlds, actions, { ...cfg, depth: 1, nodes: LEVELS.hard.nodes });
    actions = actions
      .map((a, i) => ({ a, v: quick[i] }))
      .sort((x, y) => y.v - x.v)
      .slice(0, cfg.shortlist)
      .map((x) => x.a);
  }
  const values = averageScores(worlds, actions, cfg);
  let best = 0;
  let bestValue = -Infinity;
  values.forEach((value, i) => {
    const v = value + (rand() - 0.5) * 2 * cfg.noise;
    if (v > bestValue) { bestValue = v; best = i; }
  });
  return actions[best];
}
