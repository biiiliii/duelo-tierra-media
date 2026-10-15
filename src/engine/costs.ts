import { CARDS, LOCATIONS } from './data.js';
import type { GameState, Side, Skill } from './types.js';

export interface SkillPool {
  fixed: Record<Skill, number>;
  /** Each entry produces ONE of the listed skills per turn ("/" cards, Elves wild token). */
  flexible: Skill[][];
}

const ALL_SKILLS: Skill[] = ['mask', 'fist', 'heart', 'book', 'crown'];

export function skillPool(state: GameState, side: Side): SkillPool {
  const fixed: Record<Skill, number> = { mask: 0, fist: 0, heart: 0, book: 0, crown: 0 };
  const flexible: Skill[][] = [];
  const player = state.players[side];
  for (const id of player.cards) {
    const card = CARDS[id];
    for (const s of card.effect.skills) fixed[s]++;
    if (card.effect.skillChoice) flexible.push(card.effect.skillChoice);
  }
  if (player.tokens.includes('elves_wild_skill')) flexible.push(ALL_SKILLS);
  return { fixed, flexible };
}

/** For each required skill symbol, whether the pool already produces it (uncovered ones cost 1 coin each). */
export function skillCoverage(required: Skill[], pool: SkillPool): boolean[] {
  const covered: boolean[] = new Array(required.length).fill(false);
  const left = { ...pool.fixed };
  const deficit: number[] = [];
  required.forEach((s, i) => {
    if (left[s] > 0) {
      left[s]--;
      covered[i] = true;
    } else {
      deficit.push(i);
    }
  });
  // Max bipartite matching: flexible producers -> deficit symbols.
  const matchOf: number[] = new Array(deficit.length).fill(-1);
  const tryAssign = (p: number, seen: boolean[]): boolean => {
    for (let d = 0; d < deficit.length; d++) {
      if (seen[d] || !pool.flexible[p].includes(required[deficit[d]])) continue;
      seen[d] = true;
      if (matchOf[d] === -1 || tryAssign(matchOf[d], seen)) {
        matchOf[d] = p;
        return true;
      }
    }
    return false;
  };
  for (let p = 0; p < pool.flexible.length; p++) tryAssign(p, new Array(deficit.length).fill(false));
  matchOf.forEach((p, d) => { if (p !== -1) covered[deficit[d]] = true; });
  return covered;
}

/** Number of required skill symbols the pool cannot cover (each costs 1 coin). */
export function missingSkills(required: Skill[], pool: SkillPool): number {
  return skillCoverage(required, pool).filter((c) => !c).length;
}

export function chainSymbols(state: GameState, side: Side): Set<string> {
  const out = new Set<string>();
  for (const id of state.players[side].cards) {
    const sym = CARDS[id].effect.chainOut;
    if (sym) out.add(sym);
  }
  return out;
}

export interface CostQuote {
  coins: number;
  viaChain: boolean;
  affordable: boolean;
}

export function cardCost(state: GameState, side: Side, cardId: string): CostQuote {
  const card = CARDS[cardId];
  const player = state.players[side];
  if (card.cost.chain && chainSymbols(state, side).has(card.cost.chain)) {
    return { coins: 0, viaChain: true, affordable: true };
  }
  const coins = card.cost.coins + missingSkills(card.cost.skills, skillPool(state, side));
  return { coins, viaChain: false, affordable: coins <= player.coins };
}

export function fortressesOnBoard(state: GameState, side: Side): number {
  return Object.values(state.regions).filter((r) => r.fortress === side).length;
}

export function locationCost(state: GameState, side: Side, locationId: string): CostQuote {
  const loc = LOCATIONS[locationId];
  const player = state.players[side];
  const extra = player.tokens.includes('dwarves_loc_discount') ? 0 : fortressesOnBoard(state, side);
  const coins = loc.cost.coins + extra + missingSkills(loc.cost.skills, skillPool(state, side));
  return { coins, viaChain: false, affordable: coins <= player.coins };
}
