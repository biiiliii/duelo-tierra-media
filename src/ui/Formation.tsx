import { cardCost } from '../engine/costs';
import { activeForced, isAccessible } from '../engine/engine';
import { cardLabel } from '../engine/labels';
import type { GameState, Side } from '../engine/types';
import { CardBack, CardFace, costHave } from './CardView';
import { Glyph } from './Icon';
import { useEffects } from './FxContext';

const CARD_W = 76;
const GAP = 6;
const ROW_STEP = 56;
const CARD_H = 106;

interface Props {
  state: GameState;
  selected: number | null;
  onSelect: (slot: number) => void;
  /** Plays a card at once on double click (when the player may play it); missing when switched off. */
  onPlay?: (slot: number) => void;
  disabled: boolean;
  /** Whose owned symbols to mark on the card costs. */
  viewer: Side;
}

export function Formation({ state, selected, onSelect, onPlay, disabled, viewer }: Props) {
  const forced = activeForced(state);
  const playable = (slot: number) => Boolean(onPlay) && !disabled && state.slots[slot].faceUp &&
    (!forced || (forced.slot.id === slot && !forced.discardOnly)) &&
    cardCost(state, state.current, state.slots[slot].cardId).affordable;
  const rows = Math.max(...state.slots.map((s) => s.row)) + 1;
  const half = (CARD_W + GAP) / 2;
  const width = 12 * half;
  const height = (rows - 1) * ROW_STEP + CARD_H;
  const left = state.slots.filter((s) => !s.taken).length;
  const revealed = new Set(useEffects('reveal').map((e) => e.fx.slot));
  return (
    <div className="formation-wrap">
      <div className="formation" style={{ width, height }}>
        {state.slots.map((slot) => {
          if (slot.taken) return null;
          const accessible = isAccessible(state, slot);
          const style = { left: (slot.x + 5) * half, top: slot.row * ROW_STEP, zIndex: slot.row + 1 };
          const face = slot.faceUp
            ? <CardFace cardId={slot.cardId} have={costHave(state, viewer, slot.cardId)} />
            : <CardBack chapter={state.chapter} />;
          const flip = revealed.has(slot.id) ? ' vfx-reveal' : '';
          const forced = state.forced?.cardId === slot.cardId;
          const extras = (
            <>
              {slot.power && <span className="slot-power" title="Fitxa de Poder: la guanya qui reveli la carta"><Glyph name="power" size={20} /></span>}
              {forced && <span className="slot-forced" title="El rival l'ha de prendre">!</span>}
            </>
          );
          if (!accessible) {
            return <div key={slot.id} className={`slot slot-covered${flip}`} style={style} data-fx={`slot-${slot.id}`}>{face}{extras}</div>;
          }
          return (
            <button
              key={slot.id}
              type="button"
              className={`slot slot-open${selected === slot.id ? ' slot-selected' : ''}${flip}`}
              data-fx={`slot-${slot.id}`}
              style={style}
              disabled={disabled}
              onClick={() => onSelect(slot.id)}
              onDoubleClick={() => playable(slot.id) && onPlay!(slot.id)}
              aria-label={slot.faceUp ? cardLabel(slot.cardId) : 'Carta boca avall'}
              aria-pressed={selected === slot.id}
            >
              {face}{extras}
            </button>
          );
        })}
      </div>
      <p className="formation-count">
        {left === 0 ? 'Capítol acabat' : `Queden ${left} cartes al capítol ${state.chapter}`}
      </p>
    </div>
  );
}
