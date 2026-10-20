import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { SIDE_NAMES } from '../engine/labels';
import type { Action, GameState, RegionId, Side } from '../engine/types';
import { ActionBar } from './ActionBar';
import { Formation } from './Formation';
import { FxLayer } from './FxLayer';
import { FxProvider, useFxDirector } from './FxContext';
import type { Speed } from './fxDirector';
import { Locations } from './Locations';
import { MapView } from './MapView';
import { PlayerPanel } from './PlayerPanel';
import { RingTrack } from './RingTrack';
import { TurnSummary } from './TurnSummary';
import { ICON_CREDIT } from './icons';
import './fx.css';

interface Props {
  state: GameState;
  /** False while it's the rival's turn online (or while a move is being sent). */
  canAct: boolean;
  /** Your side online; null for hot-seat or spectators. */
  you: Side | null;
  onAction: (action: Action) => void;
  /** Extra controls/info rendered in the top bar. */
  topbar?: ReactNode;
  /** Shown above the action bar (e.g. "waiting for the rival"). */
  notice?: ReactNode;
  error?: string | null;
  credit?: string;
  /** Display name for a side (online player names). */
  waitingName?: (side: Side) => string;
  /** Text copied by the log's copy button; the plain log when not given. */
  copyLog?: () => string;
}

/** Puts text on the clipboard, falling back to a hidden text area where the Clipboard API is missing. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

const SPEED_LABEL: Record<Speed, string> = { normal: 'Normals', fast: 'Ràpides', off: 'Cap' };
const NEXT_SPEED: Record<Speed, Speed> = { normal: 'fast', fast: 'off', off: 'normal' };

export function GameScreen({ state: real, canAct: realCanAct, you, onAction, topbar, notice, error, credit = ICON_CREDIT, waitingName, copyLog }: Props) {
  // While the rival's turn is replayed, the board shows the replay and nobody can act until it ends.
  const fx = useFxDirector(real, you);
  const state = fx.display;
  const canAct = realCanAct && !fx.playing;
  const nameOf = (side: Side) => waitingName?.(side) ?? SIDE_NAMES[side];
  const [selected, setSelected] = useState<number | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null);
  const logRef = useRef<HTMLOListElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // A selection is only meaningful for the state it was made in.
  useEffect(() => setSelected(null), [state]);

  useEffect(() => {
    const list = logRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [state.log.length, logOpen]);

  useEffect(() => {
    setCopied(null);
    if (!logOpen) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLogOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [logOpen]);

  const clickableRegions = useMemo(
    () => new Set(canAct && state.prompt?.target === 'region' ? state.prompt.options.map((o) => o.value) : []),
    [state.prompt, canAct],
  );
  const busy = !canAct || Boolean(state.prompt || state.winner);
  const panelOrder: Side[] = you === 'fellowship' ? ['sauron', 'fellowship'] : you === 'sauron' ? ['fellowship', 'sauron'] : ['sauron', 'fellowship'];

  return (
    <FxProvider value={fx}>
    <div className={`app turn-${state.current}`}>
      <header className="topbar">
        <h1>Duelo por la Tierra Media</h1>
        <p className="topbar-status">Capítol {state.chapter} de 3, torn {state.turn}</p>
        <div className="topbar-actions">
          {topbar}
          <button type="button" onClick={() => fx.setSpeed(NEXT_SPEED[fx.speed])} title="Canvia la velocitat de les animacions">
            Animacions: {SPEED_LABEL[fx.speed]}
          </button>
          <button type="button" onClick={() => setLogOpen(true)} aria-expanded={logOpen}>Registre</button>
        </div>
      </header>

      <RingTrack state={state} />

      <main className="layout">
        <aside className="col-board">
          <MapView state={state} clickable={clickableRegions} onPick={(r: RegionId) => onAction({ type: 'choose', value: r })} />
          <Locations state={state} disabled={busy} viewer={you} onTake={(id) => onAction({ type: 'takeLocation', id })} />
        </aside>

        <section className="col-center">
          {notice}
          <ActionBar
            state={state}
            selected={canAct ? selected : null}
            onPlay={() => selected !== null && onAction({ type: 'takeCard', slot: selected, mode: 'play' })}
            onDiscard={() => selected !== null && onAction({ type: 'takeCard', slot: selected, mode: 'discard' })}
            onChoose={(value) => canAct && onAction({ type: 'choose', value })}
            waitingFor={!canAct && !state.winner ? nameOf(state.current) : null}
          />
          {error && <p className="error" role="alert">{error}</p>}
          <TurnSummary state={state} fx={fx} nameOf={nameOf} onOpenLog={() => setLogOpen(true)} />
          <div className="table">
            <Formation state={state} selected={selected} onSelect={setSelected} disabled={busy} viewer={you ?? state.current} />
          </div>
        </section>

        <aside className="col-players">
          {panelOrder.map((side) => <PlayerPanel key={side} state={state} side={side} />)}
        </aside>
      </main>

      {logOpen && (
        <div className="drawer-backdrop" onClick={() => setLogOpen(false)}>
          <aside className="drawer log" role="dialog" aria-modal="true" aria-label="Registre de jugades" onClick={(e) => e.stopPropagation()}>
            <header className="drawer-head">
              <h2>Registre</h2>
              <div className="drawer-actions">
                <button
                  type="button"
                  onClick={() => copyText(copyLog?.() ?? real.log.join('\n')).then((ok) => setCopied(ok ? 'ok' : 'fail'))}
                  onBlur={() => setCopied(null)}
                >
                  {copied === 'ok' ? 'Copiat!' : copied === 'fail' ? 'No s\'ha pogut copiar' : 'Copia'}
                </button>
                <button type="button" ref={closeRef} onClick={() => setLogOpen(false)}>Tanca</button>
              </div>
            </header>
            <ol ref={logRef}>
              {state.log.map((line, i) => <li key={i}>{line}</li>)}
            </ol>
          </aside>
        </div>
      )}
      {credit && <footer className="credit">{credit}</footer>}
      <FxLayer fx={fx} nameOf={nameOf} />
    </div>
    </FxProvider>
  );
}
