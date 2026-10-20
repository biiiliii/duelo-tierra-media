/**
 * Rebuilds a game from the text copied with the log's "Copia" button (it holds a DUELO1 code) and prints it move by
 * move with the hidden information: the cards in the formation and how the board stood.
 * Run: vite-node scripts/replay.ts partida.txt [--at N]   (N: show the full position after move N)
 */
import { readFileSync } from 'node:fs';
import { CARDS } from '../src/engine/data';
import { cardLabel } from '../src/engine/labels';
import { decodeRecord, encodeAction, replay } from '../src/engine/replay';
import type { GameState } from '../src/engine/types';

const args = process.argv.slice(2);
const atFlag = args.indexOf('--at');
const at = atFlag >= 0 ? Number(args[atFlag + 1]) : null;
const file = args.find((a, i) => !a.startsWith('--') && (atFlag < 0 || i !== atFlag + 1));
const record = decodeRecord(readFileSync(file ?? 0, 'utf8'));
const states = replay(record);

function position(s: GameState): string {
  const regions = Object.entries(s.regions)
    .map(([id, r]) => `${id}: C${r.units.fellowship} S${r.units.sauron}${r.fortress ? ` fort=${r.fortress}` : ''}`).join(' | ');
  const players = (['fellowship', 'sauron'] as const).map((side) => {
    const p = s.players[side];
    return `${side}: ${p.coins} monedes, anell ${p.ring}, fitxes [${p.tokens.join(', ')}], cartes ${p.cards.length}`;
  }).join('\n  ');
  const slots = s.slots.filter((x) => !x.taken)
    .map((x) => `#${x.id}${x.faceUp ? '' : '(tapada)'} ${cardLabel(x.cardId)} ${CARDS[x.cardId].id}`).join('\n    ');
  return `  ${regions}\n  ${players}\n  llocs: ${s.locationsFaceUp.join(', ')}\n  formació:\n    ${slots}`;
}

console.log(`Llavor ${record.seed}, IA ${record.level ?? '-'}, humà ${record.you ?? '-'}, desfés ${record.undos ?? '-'}, versió ${record.version ?? '-'}`);
console.log(`${record.actions.length} jugades. ${states.at(-1)!.winner?.reason ?? 'Partida sense acabar.'}\n`);
if (at !== null) {
  console.log(`Després de la jugada ${at} (torn ${states[at].turn}, juga ${states[at].current}):\n${position(states[at])}`);
} else {
  record.actions.forEach((a, i) => {
    const before = states[i];
    const who = record.you ? (before.current === record.you ? 'humà' : 'IA') : before.current;
    const lines = states[i + 1].log.slice(before.log.length);
    console.log(`${String(i + 1).padStart(3)}. [${who}] ${encodeAction(a).padEnd(22)} ${lines.join(' / ')}`);
  });
}
