// Sums the per-shard result files given as arguments and prints the totals with win rates (draws count half).
import { readFileSync } from 'node:fs';

const totals = {};
for (const file of process.argv.slice(2)) {
  for (const [id, r] of Object.entries(JSON.parse(readFileSync(file, 'utf8')))) {
    const t = (totals[id] ??= { wins: 0, draws: 0, games: 0, lost: {} });
    t.wins += r.wins; t.draws += r.draws; t.games += r.games;
    for (const [k, n] of Object.entries(r.lost ?? {})) t.lost[k] = (t.lost[k] ?? 0) + n;
  }
}
for (const t of Object.values(totals)) t.score = +((t.wins + t.draws / 2) / t.games).toFixed(4);
console.log(JSON.stringify(totals, null, 2));
