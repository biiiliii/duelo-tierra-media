import { isAccessible } from '../engine/engine';
import { cardLabel } from '../engine/labels';
import type { GameState, Side } from '../engine/types';
import { CardBack, CardFace, costHave } from './CardView';

const CARD_W = 76;
const GAP = 6;
const ROW_STEP = 56;
const CARD_H = 106;

interface Props {
  state: GameState;
  selected: number | null;
  onSelect: (slot: number) => void;
  disabled: boolean;
  /** Whose owned symbols to mark on the card costs. */
  viewer: Side;
}

export function Formation({ state, selected, onSelect, disabled, viewer }: Props) {
  const rows = Math.max(...state.slots.map((s) => s.row)) + 1;
  const half = (CARD_W + GAP) / 2;
  const width = 12 * half;
  const height = (rows - 1) * ROW_STEP + CARD_H;
  const left = state.slots.filter((s) => !s.taken).length;
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
          if (!accessible) {
            return <div key={slot.id} className="slot slot-covered" style={style}>{face}</div>;
          }
          return (
            <button
              key={slot.id}
              type="button"
              className={`slot slot-open${selected === slot.id ? ' slot-selected' : ''}`}
              style={style}
              disabled={disabled}
              onClick={() => onSelect(slot.id)}
              aria-label={slot.faceUp ? cardLabel(slot.cardId) : 'Carta boca avall'}
              aria-pressed={selected === slot.id}
            >
              {face}
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
