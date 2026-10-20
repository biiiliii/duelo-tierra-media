/**
 * Collects positions for fitting the learned evaluation. Plays self-play games and prints one JSON line per sampled
 * position: [game, chapter, progress, sauron, extraTurns, ...feature diffs, hand-made evaluation, result], all from the
 * point of view of the player to move; result is 1 if it went on to win, 0.5 for a draw, 0 for a loss.
 * Run: SPEC=spec.json SHARD=0 SHARDS=80 vite-node scripts/collect.ts > rows.jsonl
 *
 * Spec: { policy: { base, ...overrides }, rival?, rivalShare?, firstSeed, games, rate } where `rate` is the chance of
 * keeping a turn's start. With a `rival`, that share of the games has one side (either) play it instead of `policy`,
 * so the positions include styles the policy would never play itself (a key-location rush, say).
 */
import { readFileSync } from 'node:fs';
import { LEVELS, SPARRING, chooseAction, evaluate, IMPOSSIBLE_WEIGHTS, type AiLevel, type LevelConfig } from '../src/engine/ai';
import { applyAction, newGame } from '../src/engine/engine';
import { sample } from '../src/engine/features';
import type { Side } from '../src/engine/types';

type Named = AiLevel | 'sparring';
type Override = Partial<Omit<LevelConfig, 'weights'>> & { weights?: Partial<LevelConfig['weights']>; base: Named };
interface Spec { policy: Override; rival?: Override; rivalShare?: number; firstSeed: number; games: number; rate: number }

const NAMED: Record<Named, LevelConfig> = { ...LEVELS, sparring: SPARRING };

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
function resolve(o: Override): LevelConfig {
  const from = NAMED[o.base];
  return { ...from, ...o, weights: { ...from.weights, ...o.weights } };
}
const policy = resolve(spec.policy);
const rival = spec.rival ? resolve(spec.rival) : policy;

for (let g = shard; g < spec.games; g += shards) {
  const seed = spec.firstSeed + g;
  const rand = seeded(seed * 7 + 1);
  let s = newGame(seed);
  const rows: { mover: Side; row: number[] }[] = [];
  const rivalSide: Side | null = spec.rival && rand() < (spec.rivalShare ?? 0.5) ? (rand() < 0.5 ? 'fellowship' : 'sauron') : null;
  let lastTurn = -1;
  while (!s.winner) {
    if (s.turn !== lastTurn && !s.prompt) {
      lastTurn = s.turn;
      if (rand() < spec.rate) {
        const x = sample(s);
        const hand = evaluate(s, s.current, IMPOSSIBLE_WEIGHTS);
        rows.push({ mover: s.current, row: [seed, x.chapter, +x.progress.toFixed(3), x.sauron, x.extraTurns, ...x.diff, +hand.toFixed(2)] });
      }
    }
    s = applyAction(s, chooseAction(s, s.current === rivalSide ? rival : policy, rand));
  }
  const winners = s.winner.sides;
  for (const { mover, row } of rows) {
    const y = winners.length === 2 ? 0.5 : winners[0] === mover ? 1 : 0;
    console.log(JSON.stringify([...row, y]));
  }
}
