import type { CSSProperties } from 'react';
import { CONNECTIONS, REGIONS } from '../engine/data';
import type { GameState, RegionId, Side } from '../engine/types';
import { useEffects, useFx } from './FxContext';
import { Glyph, Piece, RegionBanner } from './Icon';

interface Props {
  state: GameState;
  /** Regions the player may click right now (when a prompt asks for one). */
  clickable: Set<string>;
  onPick: (region: RegionId) => void;
}

// Map coordinate space (region positions in data/map.json are 0..100 x 0..92).
const VB = { x: -6, y: -8, w: 112, h: 108 };

function Mountains({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <path
      className="map-mtn"
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0 6 L3 1 L5 4 L7 0 L10 6 M2.2 2.6 L3 3.4 M6.2 1.4 L7 2.4"
    />
  );
}

function Compass() {
  return (
    <g className="map-compass" transform="translate(4 84)">
      <circle r="5.5" />
      <circle r="3.6" />
      <path d="M0 -7.5 L1.2 0 L0 7.5 L-1.2 0 Z" />
      <path d="M-7.5 0 L0 1.2 L7.5 0 L0 -1.2 Z" />
      <text y="-8.6" textAnchor="middle">N</text>
    </g>
  );
}

function Pieces({ side, units, fortress }: { side: Side; units: number; fortress: boolean }) {
  if (!units && !fortress) return null;
  return (
    <span className={`token-group token-${side}`}>
      {fortress && <Piece side={side} kind="fortress" size={16} />}
      {units > 0 && (
        <span className="token">
          <Piece side={side} kind="unit" size={13} />
          <b>{units}</b>
        </span>
      )}
    </span>
  );
}

const pct = (x: number, y: number) => ({
  left: `${((x - VB.x) / VB.w) * 100}%`,
  top: `${((y - VB.y) / VB.h) * 100}%`,
});

/** What just happened on the map: units landing, marches, battles, fortresses rising and falling. */
function MapEffects({ pos }: { pos: Record<RegionId, [number, number]> }) {
  const effects = useEffects('units', 'move', 'conflict', 'kill', 'fortress', 'raze');
  if (effects.length === 0) return null;
  const at = (r: RegionId, life: number): CSSProperties => ({ ...pct(...pos[r]), ['--life' as string]: `${life}ms` });
  const moves = effects.filter((e) => e.fx.t === 'move');
  return (
    <>
      {moves.length > 0 && (
        <svg viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`} className="vfx-map-svg" aria-hidden="true" preserveAspectRatio="none">
          {effects.map((e) => e.fx.t === 'move' && (
            <line
              key={e.id}
              className={`vfx-trail vfx-trail-${e.fx.side}`}
              pathLength={1}
              x1={pos[e.fx.from][0]} y1={pos[e.fx.from][1]} x2={pos[e.fx.to][0]} y2={pos[e.fx.to][1]}
              style={{ ['--life' as string]: `${e.life}ms` }}
            />
          ))}
        </svg>
      )}
      {effects.map((e) => {
        const f = e.fx;
        switch (f.t) {
          case 'units':
            return (
              <div key={e.id} className={`vfx-at vfx-units vfx-side-${f.side}`} style={at(f.region, e.life)} aria-hidden="true">
                <span className="vfx-wave" />
                {Array.from({ length: Math.min(f.n, 4) }, (_, i) => (
                  <span key={i} className="vfx-drop" style={{ ['--i' as string]: i, ['--n' as string]: Math.min(f.n, 4) }}>
                    <Piece side={f.side} kind="unit" size={22} />
                  </span>
                ))}
                <b className="vfx-tag">+{f.n}</b>
              </div>
            );
          case 'move': {
            const [x0, y0] = pos[f.from];
            const [x1, y1] = pos[f.to];
            const a = pct(x0, y0);
            const b = pct(x1, y1);
            return (
              <div
                key={e.id}
                className={`vfx-glide vfx-side-${f.side}`}
                style={{ ['--x0' as string]: a.left, ['--y0' as string]: a.top, ['--x1' as string]: b.left, ['--y1' as string]: b.top, ['--life' as string]: `${e.life}ms` }}
                aria-hidden="true"
              >
                <Piece side={f.side} kind="unit" size={24} />
              </div>
            );
          }
          case 'conflict':
            return (
              <div key={e.id} className="vfx-at vfx-clash" style={at(f.region, e.life)} aria-hidden="true">
                <span className="vfx-sparks">{Array.from({ length: 10 }, (_, i) => <i key={i} style={{ ['--a' as string]: `${i * 36}deg` }} />)}</span>
                <Glyph name="swords" size={40} className="vfx-swords" />
                <b className="vfx-tag vfx-tag-left vfx-side-fellowship">−{f.n}</b>
                <b className="vfx-tag vfx-tag-right vfx-side-sauron">−{f.n}</b>
              </div>
            );
          case 'kill':
            return (
              <div key={e.id} className={`vfx-at vfx-kill vfx-side-${f.side}`} style={at(f.region, e.life)} aria-hidden="true">
                <span className="vfx-victim"><Piece side={f.side} kind="unit" size={24} /></span>
                <Glyph name="cross" size={30} className="vfx-cross" />
                <b className="vfx-tag">−1</b>
              </div>
            );
          case 'fortress':
            return (
              <div key={e.id} className={`vfx-at vfx-rise vfx-side-${f.side}`} style={at(f.region, e.life)} aria-hidden="true">
                <span className="vfx-dust" />
                <span className="vfx-tower"><Piece side={f.side} kind="fortress" size={38} /></span>
              </div>
            );
          case 'raze':
            return (
              <div key={e.id} className={`vfx-at vfx-fall vfx-side-${f.side}`} style={at(f.region, e.life)} aria-hidden="true">
                <span className="vfx-dust" />
                <span className="vfx-tower"><Piece side={f.side} kind="fortress" size={38} /></span>
              </div>
            );
          default:
            return null;
        }
      })}
    </>
  );
}

export function MapView({ state, clickable, onPick }: Props) {
  const pos = Object.fromEntries(REGIONS.map((r) => [r.id, r.pos])) as Record<RegionId, [number, number]>;
  const marks = useFx()?.marks ?? {};
  const hits = new Set(useEffects('conflict', 'kill').map((e) => e.fx.region));
  return (
    <section className="map" aria-label="Mapa de la Terra Mitjana">
      <svg viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`} className="map-art" aria-hidden="true" preserveAspectRatio="none">
        {/* western sea and coastline */}
        <path className="map-sea" d="M-6 -8 L12 -8 C8 6 15 16 9 26 C3 36 13 44 6 56 C0 66 10 76 4 90 L4 100 L-6 100 Z" />
        <path className="map-coast" d="M12 -8 C8 6 15 16 9 26 C3 36 13 44 6 56 C0 66 10 76 4 90 L4 100" />
        <path className="map-coast faint" d="M14.5 -8 C10.5 6 17.5 16 11.5 26 C5.5 36 15.5 44 8.5 56 C2.5 66 12.5 76 6.5 90 L6.5 100" />
        {/* Misty Mountains, White Mountains, Ash Mountains */}
        {[[50, 6], [52, 14], [49, 22], [51, 30]].map(([x, y]) => <Mountains key={`m${x}${y}`} x={x} y={y} s={0.8} />)}
        {[[40, 62], [48, 64], [56, 63]].map(([x, y]) => <Mountains key={`w${x}${y}`} x={x} y={y} s={0.75} />)}
        {[[72, 62], [80, 61], [90, 64], [94, 72]].map(([x, y]) => <Mountains key={`a${x}${y}`} x={x} y={y} s={0.75} />)}
        {/* Mirkwood */}
        <g className="map-forest">
          {[[86, 30], [90, 34], [94, 29], [88, 39], [95, 37]].map(([x, y]) => (
            <path key={`f${x}${y}`} d={`M${x} ${y} l2 -4 l2 4 z`} />
          ))}
        </g>
        {/* Anduin */}
        <path className="map-river" d="M74 -6 C72 10 68 22 70 34 C72 46 64 56 62 68 C60 78 56 86 50 100" />
        {/* roads between regions */}
        {CONNECTIONS.map(([a, b]) => (
          <line key={a + b} className="map-road" x1={pos[a][0]} y1={pos[a][1]} x2={pos[b][0]} y2={pos[b][1]} />
        ))}
        <Compass />
      </svg>

      {REGIONS.map((r) => {
        const rs = state.regions[r.id];
        const canPick = clickable.has(r.id);
        const empty = !rs.units.fellowship && !rs.units.sauron && !rs.fortress;
        return (
          <button
            key={r.id}
            type="button"
            className={`region${canPick ? ' region-pick' : ''}${marks[r.id] ? ` region-mark region-mark-${marks[r.id]}` : ''}${hits.has(r.id) ? ' vfx-shake' : ''}`}
            style={pct(r.pos[0], r.pos[1])}
            disabled={!canPick}
            onClick={() => onPick(r.id)}
            aria-label={`${r.name}: Comunitat ${rs.units.fellowship} unitats, Sauron ${rs.units.sauron} unitats`}
          >
            <RegionBanner region={r.id} size={20} />
            <span className="region-plate">
              <span className="region-name">{r.name}</span>
              <span className="region-pieces">
                {empty && <span className="region-empty">buida</span>}
                <Pieces side="fellowship" units={rs.units.fellowship} fortress={rs.fortress === 'fellowship'} />
                <Pieces side="sauron" units={rs.units.sauron} fortress={rs.fortress === 'sauron'} />
              </span>
            </span>
          </button>
        );
      })}
      <MapEffects pos={pos} />
    </section>
  );
}
