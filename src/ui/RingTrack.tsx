import { useEffect, useRef } from 'react';
import { RING_BONUSES, RING_LENGTH } from '../engine/data';
import type { GameState, Side } from '../engine/types';
import { Coin, Glyph, Piece } from './Icon';

const BONUS_TEXT: Record<string, string> = {
  coin: '+1 moneda',
  unit: '+1 unitat on vulguis',
  extra_turn: 'Torn extra',
  remove_fortress: 'Retira una fortalesa enemiga',
};

function BonusIcon({ bonus, side }: { bonus: string; side: Side }) {
  if (bonus === 'coin') return <Coin n={1} size={15} />;
  if (bonus === 'unit') return <Piece side={side} kind="unit" size={13} />;
  if (bonus === 'extra_turn') return <Glyph name="extraTurn" size={13} />;
  return (
    <span className="bonus-x">
      <Glyph name="fortress" size={13} />
      <Glyph name="cross" size={11} className="fx-x" />
    </span>
  );
}

/**
 * The quest as on the physical board, on a single row: Frodo's path runs to Mount Doom and the Nazgûl's rail
 * (overlaid on it, ending on Frodo's space) slides along with Frodo. When the hobbits move, the
 * whole rail — and the Nazgûl on it — moves too; only Sauron's own advances close the gap.
 */
export function RingTrack({ state }: { state: GameState }) {
  const f = state.players.fellowship.ring;
  const s = state.players.sauron.ring;
  const total = RING_LENGTH * 2 + 1; // absolute spaces 0..28
  const at = (pos: number) => `${((pos + 0.5) / total) * 100}%`;
  const frodoPos = RING_LENGTH + f;
  const nazgulPos = f + s;
  const gap = RING_LENGTH - s;
  const railLeft = `${(f / total) * 100}%`;
  const railWidth = `${((RING_LENGTH + 1) / total) * 100}%`;
  const inRail = (rel: number) => `${((rel + 0.5) / (RING_LENGTH + 1)) * 100}%`;

  // On narrow screens the track scrolls: keep the chase (Nazgûl → Frodo) centred in view.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    const mid = ((nazgulPos + frodoPos + 1) / 2 / total) * el.scrollWidth;
    el.scrollTo({ left: mid - el.clientWidth / 2, behavior: 'smooth' });
  }, [nazgulPos, frodoPos, total]);

  return (
    <section className="chase" aria-label="Missió de l'Anell">
      <header className="chase-head">
        <h2>Missió de l'Anell</h2>
        <p className="chase-stats">
          <span className="chase-stat chase-stat-fellowship">
            <Glyph name="frodo" size={16} /> Frodo i Sam: <b>{RING_LENGTH - f}</b> caselles fins al volcà
          </span>
          <span className="chase-stat chase-stat-sauron">
            <Glyph name="nazgul" size={16} /> El Nazgûl: a <b>{gap}</b> caselles d'atrapar-los
          </span>
        </p>
      </header>

      <div className="chase-scroll" ref={scrollRef}>
        <div className="chase-track" style={{ ['--spaces' as string]: total }}>
          {/* Frodo's path, fixed on the board. Spaces under the Nazgûl's rail are drawn by the rail. */}
          {Array.from({ length: total }, (_, pos) => {
            if (pos >= f && pos < frodoPos) return null;
            const rel = pos - RING_LENGTH;
            const bonus = rel > 0 ? RING_BONUSES[rel] : undefined;
            const goal = pos === total - 1;
            return (
              <span
                key={pos}
                className={`space path-space${rel >= 0 && rel < f ? ' passed' : ''}${bonus ? ' bonus' : ''}${goal ? ' goal' : ''}${rel < 0 ? ' behind' : ''}`}
                style={{ left: at(pos) }}
                title={bonus ? `Comunitat: ${BONUS_TEXT[bonus]}` : goal ? 'El volcà: guanya la Comunitat' : undefined}
              >
                {goal ? <Glyph name="volcano" size={16} /> : bonus && rel > f ? <BonusIcon bonus={bonus} side="fellowship" /> : null}
              </span>
            );
          })}

          {/* Nazgûl rail, overlaid on the path: it starts where the Nazgûl set off and ends on Frodo. */}
          <div className="chase-rail" style={{ left: railLeft, width: railWidth }}>
            {Array.from({ length: RING_LENGTH }, (_, rel) => {
              const bonus = RING_BONUSES[rel];
              return (
                <span
                  key={rel}
                  className={`space rail-space${rel < s ? ' passed' : ' ahead'}${bonus ? ' bonus' : ''}`}
                  style={{ left: inRail(rel) }}
                  title={bonus ? `Sauron: ${BONUS_TEXT[bonus]}` : undefined}
                >
                  {bonus && rel > s ? <BonusIcon bonus={bonus} side="sauron" /> : null}
                </span>
              );
            })}
            <span className="chase-token token-nazgul" style={{ left: inRail(s) }} aria-label={`El Nazgûl, a ${gap} caselles`}>
              <Glyph name="nazgul" size={22} />
            </span>
          </div>

          <span className="chase-token token-frodo" style={{ left: at(frodoPos) }} aria-label={`Frodo i Sam, a ${RING_LENGTH - f} caselles del volcà`}>
            <Glyph name="frodo" size={22} />
          </span>
        </div>
      </div>
    </section>
  );
}
