/**
 * Fits the learned evaluation on positions from scripts/collect.ts: one logistic regression per chapter, checked on
 * held-out games against the hand-made evaluation. Prints the report to stderr and the model (LearnedModel) to stdout.
 * Run: vite-node scripts/fit.ts rows-*.jsonl.gz > model.json
 */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { SIDE_FEATURES } from '../src/engine/features';

const N_FEAT = SIDE_FEATURES.length;
const L2 = Number(process.env.L2 ?? 1);

interface Row { game: number; chapter: number; x: number[]; hand: number; y: number }

function load(files: string[]): Row[] {
  const rows: Row[] = [];
  for (const f of files) {
    const raw = readFileSync(f);
    const text = f.endsWith('.gz') ? gunzipSync(raw).toString('utf8') : raw.toString('utf8');
    for (const line of text.split('\n')) {
      if (!line) continue;
      const r: number[] = JSON.parse(line);
      const [game, chapter, progress, sauron, extra] = r;
      const diff = r.slice(5, 5 + N_FEAT);
      rows.push({
        game, chapter, hand: r[5 + N_FEAT], y: r[6 + N_FEAT],
        x: [1, sauron, extra, ...diff, ...diff.map((d) => d * progress)],
      });
    }
  }
  return rows;
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);

/** Solves A x = b (A symmetric positive definite) by Gaussian elimination. */
function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
    x[r] = s / M[r][r];
  }
  return x;
}

/** Logistic regression with soft labels by Newton's method; the bias is not penalised. */
function fit(xs: number[][], ys: number[]): number[] {
  const d = xs[0].length;
  let w = new Array(d).fill(0);
  for (let it = 0; it < 12; it++) {
    const g = w.map((v, i) => (i === 0 ? 0 : L2 * v));
    const H = Array.from({ length: d }, (_, i) => Array.from({ length: d }, (_, j) => (i === j && i > 0 ? L2 : 0)));
    xs.forEach((x, n) => {
      const p = sigmoid(dot(w, x));
      const r = p - ys[n];
      const s = Math.max(p * (1 - p), 1e-6);
      for (let i = 0; i < d; i++) {
        if (x[i] === 0) continue;
        g[i] += r * x[i];
        const sx = s * x[i];
        for (let j = 0; j < d; j++) if (x[j] !== 0) H[i][j] += sx * x[j];
      }
    });
    const step = solve(H, g);
    w = w.map((v, i) => v - step[i]);
    if (Math.max(...step.map(Math.abs)) < 1e-6) break;
  }
  return w;
}

function logLoss(ws: (x: number[]) => number, xs: number[][], ys: number[]): { loss: number; acc: number } {
  let loss = 0;
  let right = 0;
  let decided = 0;
  xs.forEach((x, n) => {
    const p = Math.min(1 - 1e-9, Math.max(1e-9, sigmoid(ws(x))));
    loss -= ys[n] * Math.log(p) + (1 - ys[n]) * Math.log(1 - p);
    if (ys[n] !== 0.5) { decided++; if ((p > 0.5) === (ys[n] === 1)) right++; }
  });
  return { loss: loss / xs.length, acc: right / decided };
}

const rows = load(process.argv.slice(2));
const isVal = (r: Row) => r.game % 5 === 0;
const chapters: number[][] = [];
for (const chapter of [1, 2, 3]) {
  const train = rows.filter((r) => r.chapter === chapter && !isVal(r));
  const val = rows.filter((r) => r.chapter === chapter && isVal(r));
  const w = fit(train.map((r) => r.x), train.map((r) => r.y));
  // The hand-made evaluation, given its best scale, as the bar to beat.
  const hw = fit(train.map((r) => [1, r.hand / 100]), train.map((r) => r.y));
  const learned = logLoss((x) => dot(w, x), val.map((r) => r.x), val.map((r) => r.y));
  const hand = logLoss((x) => dot(hw, x), val.map((r) => [1, r.hand / 100]), val.map((r) => r.y));
  console.error(`chapter ${chapter}: ${train.length} train / ${val.length} held out` +
    ` | learned loss ${learned.loss.toFixed(4)} acc ${(learned.acc * 100).toFixed(1)}%` +
    ` | hand-made loss ${hand.loss.toFixed(4)} acc ${(hand.acc * 100).toFixed(1)}%`);
  const names = ['bias', 'sauron', 'extraTurns', ...SIDE_FEATURES, ...SIDE_FEATURES.map((f) => `${f}*progress`)];
  console.error('  ' + names.map((n, i) => `${n} ${w[i].toFixed(3)}`).join(', '));
  chapters.push(w.map((v) => +v.toFixed(4)));
}
console.log(JSON.stringify({ chapters }));
