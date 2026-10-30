import { ALLIES } from '../engine/data';
import { SIDE_TITLES } from '../engine/labels';
import type { Side } from '../engine/types';
import { Glyph } from './Icon';
import { SIDE_GLYPH } from './icons';

/** Where an Ally card is: still hidden, revealed (arrival used) or retired (retreat used). */
export type AllyStatus = 'hand' | 'shown' | 'gone';

interface Props {
  id: string;
  status: AllyStatus;
  /** Calls the arrival / retreat effect; only given while the player may call it now. */
  onArrive?: () => void;
  onRetreat?: () => void;
}

function Cost({ n }: { n: number }) {
  return (
    <span className="ally-cost" title={`${n} fitxa${n > 1 ? 'es' : ''} de Poder`}>
      {Array.from({ length: n }, (_, i) => <Glyph key={i} name="power" size={13} />)}
    </span>
  );
}

function Half({ kind, text, done, onCall }: { kind: 'arrive' | 'retreat'; text: string; done: boolean; onCall?: () => void }) {
  const title = kind === 'arrive' ? 'Arribada' : 'Retirada';
  const body = (
    <>
      <span className="ally-half-head">
        <b>{title}</b>
        {done ? <span className="ally-done">feta</span> : <Cost n={kind === 'arrive' ? 1 : 2} />}
      </span>
      <span className="ally-half-text">{text}</span>
      {onCall && <span className="ally-half-call">{kind === 'arrive' ? 'Crida-la' : 'Retira-la'}</span>}
    </>
  );
  const cls = `ally-half ally-half-${kind}${done ? ' ally-half-done' : ''}`;
  return onCall
    ? <button type="button" className={`${cls} ally-half-live`} onClick={onCall}>{body}</button>
    : <div className={cls}>{body}</div>;
}

/** An Ally card face up: its name and both effects, the arrival above the retreat. */
export function AllyCard({ id, status, onArrive, onRetreat }: Props) {
  const ally = ALLIES[id];
  const Crest = SIDE_GLYPH[ally.side];
  return (
    <article className={`ally-card ally-card-${ally.side} ally-card-${status}`} aria-label={`Aliat ${ally.name}`}>
      <header className="ally-card-art">
        <Crest className="ally-card-crest" aria-hidden="true" />
        <h4>{ally.name}</h4>
        {status === 'hand' && <span className="ally-tag">A la mà</span>}
        {status === 'gone' && <span className="ally-tag ally-tag-gone">Retirat</span>}
      </header>
      <Half kind="arrive" text={ally.arrive} done={status !== 'hand'} onCall={onArrive} />
      <Half kind="retreat" text={ally.retreat} done={status === 'gone'} onCall={onRetreat} />
    </article>
  );
}

/** A rival's Ally not yet played: only its back. */
export function AllyBack({ side }: { side: Side }) {
  const Crest = SIDE_GLYPH[side];
  return (
    <div className={`ally-card ally-back ally-card-${side}`} aria-label={`Aliat ocult de ${SIDE_TITLES[side]}`}>
      <span className="ally-back-seal"><Crest aria-hidden="true" /></span>
      <span className="ally-back-label">Aliat ocult</span>
    </div>
  );
}
