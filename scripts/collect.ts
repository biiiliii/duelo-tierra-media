/**
 * Collects positions for fitting the learned evaluation. Plays self-play games and prints one JSON line per sampled
 * position: [game, chapter, progress, sauron, extraTurns, ...feature diffs, hand-made evaluation, result], all from the
 * point of view of the player to move; result is 1 if it went on to win, 0.5 for a draw, 0 for a loss.
 * Run: SPEC=spec.json SHARD=0 SHARDS=80 vite-node scripts/collect.ts > rows.jsonl
 *
 * Spec: { policy: { base, ...overrides }, firstSeed, games, rate } where `rate` is the chance of keeping a turn's start.
 */
import { readFileSync } from 'node:fs';
import { LEVELS, SPARRING, chooseAction, evaluate, HAND_WEIGHTS, type AiLevel, type LevelConfig } from '../src/engine/ai';
import { applyAction, newGame } from '../src/engine/engine';
import { sample } from '../src/engine/features';
import type { Side } from '../src/engine/types';

type Named = AiLevel | 'sparring';
type Override = Partial<Omit<LevelConfig, 'weights'>> & { weights?: Partial<LevelConfig['weights']>; base: Named };
interface Spec { policy: Override; firstSeed: number; games: number; rate: number }

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
const from = NAMED[spec.policy.base];
const policy: LevelConfig = { ...from, ...spec.policy, weights: { ...from.weights, ...spec.policy.weights } };

for (let g = shard; g < spec.games; g += shards) {
  const seed = spec.firstSeed + g;
  const rand = seeded(seed * 7 + 1);
  let s = newGame(seed);
  const rows: { mover: Side; row: number[] }[] = [];
  let lastTurn = -1;
  while (!s.winner) {
    if (s.turn !== lastTurn && !s.prompt) {
      lastTurn = s.turn;
      if (rand() < spec.rate) {
        const x = sample(s);
        const hand = evaluate(s, s.current, HAND_WEIGHTS);
        rows.push({ mover: s.current, row: [seed, x.chapter, +x.progress.toFixed(3), x.sauron, x.extraTurns, ...x.diff, +hand.toFixed(2)] });
      }
    }
    s = applyAction(s, chooseAction(s, policy, rand));
  }
  const winners = s.winner.sides;
  for (const { mover, row } of rows) {
    const y = winners.length === 2 ? 0.5 : winners[0] === mover ? 1 : 0;
    console.log(JSON.stringify([...row, y]));
  }
}
