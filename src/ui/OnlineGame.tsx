import { useEffect, useState, type FormEvent } from 'react';
import { SIDE_TITLES } from '../engine/labels';
import { joinRoom, loadName, loadSeat, saveName, useLiveRoom } from '../net/client';
import { GameScreen } from './GameScreen';
import './lobby.css';

interface Props {
  code: string;
  onExit: () => void;
}

/** Entry point for /?sala=CODE: join (if needed), then play live. */
export function OnlineGame({ code, onExit }: Props) {
  const [seat, setSeat] = useState(() => loadSeat(code));
  const [spectating, setSpectating] = useState(false);

  if (!seat && !spectating) {
    return <JoinGate code={code} onJoined={() => setSeat(loadSeat(code))} onSpectate={() => setSpectating(true)} onExit={onExit} />;
  }
  return <LiveGame code={code} token={seat?.token ?? null} onExit={onExit} />;
}

function JoinGate({ code, onJoined, onSpectate, onExit }: { code: string; onJoined: () => void; onSpectate: () => void; onExit: () => void }) {
  const [name, setName] = useState(loadName);
  const [error, setError] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    saveName(name);
    try {
      await joinRoom(code, name);
      onJoined();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setFull(err instanceof Error && /plena/.test(err.message));
      setBusy(false);
    }
  };

  return (
    <div className="lobby">
      <header className="lobby-hero">
        <h1>Duelo por la Tierra Media</h1>
        <p>T'han convidat a la sala <b className="room-code">{code}</b>.</p>
      </header>
      <form className="lobby-card lobby-narrow" onSubmit={submit}>
        <h2>Entra a la partida</h2>
        <label className="field">
          <span>El teu nom</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="Com et diuen?" autoFocus />
        </label>
        <button type="submit" className="lobby-primary" disabled={busy}>{busy ? 'Entrant…' : 'Seu a la taula'}</button>
        {error && <p className="lobby-error" role="alert">{error}</p>}
        {full && <button type="button" onClick={onSpectate}>Mira la partida com a espectador</button>}
        <button type="button" className="link-button" onClick={onExit}>Torna a l'inici</button>
      </form>
    </div>
  );
}

function LiveGame({ code, token, onExit }: { code: string; token: string | null; onExit: () => void }) {
  const live = useLiveRoom(code, token);
  const [copied, setCopied] = useState(false);
  const room = live.room;

  // Let the player know in the tab title when it's their move.
  useEffect(() => {
    const seated = room?.seats.fellowship.taken && room?.seats.sauron.taken;
    const myTurn = seated && room?.you && room.state.current === room.you && !room.state.winner;
    document.title = myTurn ? '⚑ Et toca jugar · Duelo' : 'Duelo por la Tierra Media';
    return () => { document.title = 'Duelo por la Tierra Media'; };
  }, [room]);

  if (live.missing) {
    return (
      <div className="lobby">
        <div className="lobby-card lobby-narrow">
          <h2>Aquesta sala no existeix</h2>
          <p>Potser el codi és incorrecte o la sala ha caducat (duren 7 dies des de l'última jugada).</p>
          <button type="button" className="lobby-primary" onClick={onExit}>Torna a l'inici</button>
        </div>
      </div>
    );
  }
  if (!room) return <div className="lobby"><p className="lobby-loading">Connectant amb la sala {code}…</p></div>;

  const link = `${window.location.origin}${window.location.pathname}?sala=${room.code}`;
  const bothSeated = room.seats.fellowship.taken && room.seats.sauron.taken;
  const canAct = Boolean(room.you) && bothSeated && room.state.current === room.you;
  const nameOf = (s: 'fellowship' | 'sauron') => room.seats[s].name ?? SIDE_TITLES[s];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copia aquest enllaç:', link);
    }
  };

  const notice = !bothSeated ? (
    <div className="notice notice-invite">
      <p><b>Esperant el rival.</b> Comparteix aquest enllaç o el codi <b className="room-code">{room.code}</b>.</p>
      <div className="invite-row">
        <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Enllaç de la sala" />
        <button type="button" onClick={copy}>{copied ? 'Copiat' : 'Copia l\'enllaç'}</button>
      </div>
    </div>
  ) : room.state.winner && room.you ? (
    <div className="notice">
      <p>Partida acabada. Voleu jugar-ne una altra a la mateixa sala?</p>
      <button type="button" onClick={live.rematch}>Juga la revenja</button>
    </div>
  ) : null;

  return (
    <GameScreen
      state={room.state}
      canAct={canAct}
      you={room.you}
      onAction={live.act}
      waitingName={(side) => (bothSeated ? nameOf(side) : 'el teu rival')}
      notice={notice}
      error={live.error}
      topbar={
        <>
          <span className="room-chip" title="Codi de la sala">Sala <b>{room.code}</b></span>
          <span className="vs">
            <span className="vs-fellowship">{nameOf('fellowship')}</span> contra <span className="vs-sauron">{nameOf('sauron')}</span>
            {room.you ? `, tu ets ${room.you === 'fellowship' ? 'la Comunitat' : 'Sauron'}` : ', mires com a espectador'}
          </span>
          <button type="button" onClick={copy}>{copied ? 'Copiat' : 'Convida'}</button>
          <button type="button" onClick={onExit}>Surt</button>
        </>
      }
    />
  );
}
