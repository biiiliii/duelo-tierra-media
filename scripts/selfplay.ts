/**
 * Self-play for tuning the AI. Plays every candidate config against an opponent over a slice of seeds
 * and prints {id: {wins, draws, games}} as JSON. Run: SPEC=spec.json SHARD=0 SHARDS=80 vite-node scripts/selfplay.ts
 *
 * Spec: { base: AiLevel, opponent: AiLevel | Partial<LevelConfig>, firstSeed, games, candidates: [{ id, config }] }
 * where each candidate's config overrides `base` (its weights are merged, not replaced).
 */
import { readFileSync } from 'node:fs';
import { LEVELS, chooseAction, type AiLevel, type LevelConfig } from '../src/engine/ai';
import { applyAction, newGame } from '../src/engine/engine';
import type { Side } from '../src/engine/types';

type Override = Partial<Omit<LevelConfig, 'weights'>> & { weights?: Partial<LevelConfig['weights']> };
interface Spec {
  base: AiLevel;
  opponent: AiLevel | Override;
  firstSeed: number;
  games: number;
  candidates: { id: string; config: Override }[];
}

function resolve(base: AiLevel, o: Override): LevelConfig {
  return { ...LEVELS[base], ...o, weights: { ...LEVELS[base].weights, ...o.weights } };
}

function seeded(seed: number) {
  return () => {
    let t = (seed = (seed + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const spec: Spec = JSON.parse(readFileSync(process.env.SPEC!, 'utf8'));
const shard = Number(process.env.SHARD ?? 0);
const shards = Number(process.env.SHARDS ?? 1);
const opponent = typeof spec.opponent === 'string' ? LEVELS[spec.opponent] : resolve(spec.base, spec.opponent);

const results: Record<string, { wins: number; draws: number; games: number }> = {};
for (const { id, config } of spec.candidates) {
  const me = resolve(spec.base, config);
  const r = (results[id] = { wins: 0, draws: 0, games: 0 });
  // Every candidate plays the same seeds and sides, so they are compared on equal deals.
  for (let g = shard; g < spec.games; g += shards) {
    const seed = spec.firstSeed + g;
    const side: Side = g % 2 === 0 ? 'fellowship' : 'sauron';
    const rand = seeded(seed * 7 + 1);
    let s = newGame(seed);
    while (!s.winner) s = applyAction(s, chooseAction(s, s.current === side ? me : opponent, rand));
    r.games++;
    if (s.winner.sides.length === 2) r.draws++;
    else if (s.winner.sides[0] === side) r.wins++;
  }
}
console.log(JSON.stringify(results));
