import { CONNECTIONS, REGIONS } from '../engine/data';
import type { GameState, RegionId, Side } from '../engine/types';
import { Piece, RegionBanner } from './Icon';

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

export function MapView({ state, clickable, onPick }: Props) {
  const pos = Object.fromEntries(REGIONS.map((r) => [r.id, r.pos])) as Record<RegionId, [number, number]>;
  const pct = (x: number, y: number) => ({
    left: `${((x - VB.x) / VB.w) * 100}%`,
    top: `${((y - VB.y) / VB.h) * 100}%`,
  });
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
            className={`region${canPick ? ' region-pick' : ''}`}
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
    </section>
  );
}
