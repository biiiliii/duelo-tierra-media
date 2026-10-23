import { useState, type FormEvent } from 'react';
import type { AiLevel } from '../engine/ai';
import type { Expansion, Side } from '../engine/types';
import type { SeatChoice } from '../net/protocol';
import { AI_LEVEL_NAMES } from './AiGame';
import { createRoom, loadExpansions, loadName, saveExpansions, saveName } from '../net/client';
import { LocationBanner } from './Icon';
import './lobby.css';

interface Props {
  onEnterRoom: (code: string) => void;
  onLocal: (expansions: Expansion[]) => void;
  onAi: (level: AiLevel, side: Side, expansions: Expansion[]) => void;
}

const PROMOS: { value: Expansion; label: string; hint: string }[] = [
  { value: 'shire', label: 'La Comarca', hint: 'Juga gratis una carta boca amunt, encara que estigui tapada.' },
  { value: 'grond', label: 'Grond', hint: 'Enderroca una fortalesa enemiga i posa-hi la teva.' },
];

const SIDES: { value: SeatChoice; label: string; hint: string }[] = [
  { value: 'fellowship', label: 'Comunitat de l\'Anell', hint: 'Destrueix l\'Anell i defensa les races lliures.' },
  { value: 'sauron', label: 'Sauron', hint: 'Atrapa Frodo i Sam i conquereix la Terra Mitjana.' },
  { value: 'random', label: 'A l\'atzar', hint: 'Que decideixi el destí.' },
];

const AI_LEVELS: { value: AiLevel; hint: string }[] = [
  { value: 'easy', hint: 'Per aprendre a jugar.' },
  { value: 'normal', hint: 'Un rival raonable.' },
  { value: 'hard', hint: 'No perdona.' },
  { value: 'impossible', hint: 'Preveu la teva resposta abans de jugar. Guanya el Difícil 4 de cada 5 cops.' },
  { value: 'apocalypse', hint: 'Ha jugat 100.000 partides contra si mateixa i ja no li queden amics. Fa plorar l\'Impossible 5 de cada 6 cops. Ves-hi amb un mocador.' },
];

export function Lobby({ onEnterRoom, onLocal, onAi }: Props) {
  const [name, setName] = useState(loadName);
  const [side, setSide] = useState<SeatChoice>('random');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiLevel, setAiLevel] = useState<AiLevel>('normal');
  const [aiSide, setAiSide] = useState<SeatChoice>('fellowship');
  const [expansions, setExpansions] = useState<Expansion[]>(loadExpansions);

  const togglePromo = (e: Expansion) => {
    const next = PROMOS.map((p) => p.value).filter((v) => (v === e) !== expansions.includes(v));
    setExpansions(next);
    saveExpansions(next);
  };

  const startAi = (e: FormEvent) => {
    e.preventDefault();
    const side: Side = aiSide === 'random' ? (Math.random() < 0.5 ? 'fellowship' : 'sauron') : aiSide;
    onAi(aiLevel, side, expansions);
  };

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    saveName(name);
    try {
      const result = await createRoom(side, name, expansions);
      onEnterRoom(result.code);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  const join = (e: FormEvent) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (c.length !== 5) {
      setError('El codi de la sala té 5 caràcters.');
      return;
    }
    saveName(name);
    onEnterRoom(c);
  };

  return (
    <div className="lobby">
      <header className="lobby-hero">
        <h1>Duelo por la Tierra Media</h1>
        <p>Un duel per a dos jugadors: la Comunitat contra Sauron, en tres capítols.</p>
      </header>

      <div className="lobby-grid">
        <div className="lobby-side">
          <form className="lobby-card" onSubmit={create}>
            <h2>Crea una sala</h2>
            <label className="field">
              <span>El teu nom</span>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="Com et diuen?" />
            </label>
            <fieldset className="side-pick">
              <legend>Amb quin bàndol jugues?</legend>
              {SIDES.map((s) => (
                <label key={s.value} className={`side-option side-option-${s.value}${side === s.value ? ' checked' : ''}`}>
                  <input type="radio" name="side" value={s.value} checked={side === s.value} onChange={() => setSide(s.value)} />
                  <b>{s.label}</b>
                  <span>{s.hint}</span>
                </label>
              ))}
            </fieldset>
            <button type="submit" className="lobby-primary" disabled={busy}>
              {busy ? 'Creant la sala…' : 'Crea la sala i convida un amic'}
            </button>
          </form>

          <section className="lobby-card promo-pick" aria-label="Expansió">
            <h2>Expansió</h2>
            <p>Fitxes de Lloc clau opcionals: es barregen amb la resta després de girar les 3 primeres. Valen per a les partides noves que creïs (sala, IA o local).</p>
            <div className="promo-row">
              {PROMOS.map((p) => {
                const on = expansions.includes(p.value);
                return (
                  <label key={p.value} className={`promo-option${on ? ' checked' : ''}`}>
                    <input type="checkbox" checked={on} onChange={() => togglePromo(p.value)} />
                    <LocationBanner id={p.value} size={26} />
                    <span><b>{p.label}</b><small>{p.hint}</small></span>
                    <span className="promo-switch" aria-hidden="true">{on ? 'Sí' : 'No'}</span>
                  </label>
                );
              })}
            </div>
          </section>
        </div>

        <div className="lobby-side">
          <form className="lobby-card" onSubmit={join}>
            <h2>Uneix-te a una sala</h2>
            <label className="field">
              <span>Codi de la sala</span>
              <input
                className="code-input"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={5}
                placeholder="ABCDE"
                autoCapitalize="characters"
                spellCheck={false}
              />
            </label>
            <button type="submit">Entra a la sala</button>
          </form>

          <form className="lobby-card" onSubmit={startAi}>
            <h2>Juga contra la IA</h2>
            <fieldset className="seg-pick">
              <legend>Dificultat</legend>
              <div className="seg seg-levels">
                {AI_LEVELS.map((l) => (
                  <label key={l.value} className={aiLevel === l.value ? 'checked' : undefined} title={l.hint}>
                    <input type="radio" name="ai-level" value={l.value} checked={aiLevel === l.value} onChange={() => setAiLevel(l.value)} />
                    {AI_LEVEL_NAMES[l.value]}
                  </label>
                ))}
              </div>
              <p className="seg-hint">{AI_LEVELS.find((l) => l.value === aiLevel)!.hint}</p>
            </fieldset>
            <fieldset className="seg-pick">
              <legend>El teu bàndol</legend>
              <div className="seg">
                {SIDES.map((s) => (
                  <label key={s.value} className={`seg-${s.value}${aiSide === s.value ? ' checked' : ''}`}>
                    <input type="radio" name="ai-side" value={s.value} checked={aiSide === s.value} onChange={() => setAiSide(s.value)} />
                    {s.value === 'fellowship' ? 'Comunitat' : s.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <button type="submit" className="lobby-primary">Comença la partida</button>
          </form>

          <div className="lobby-card lobby-local">
            <h2>Al mateix ordinador</h2>
            <p>Dos jugadors, una pantalla. Sense connexió.</p>
            <button type="button" onClick={() => onLocal(expansions)}>Juga en local</button>
          </div>
        </div>
      </div>

      {error && <p className="lobby-error" role="alert">{error}</p>}
    </div>
  );
}
