import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import { CARDS, LOCATIONS, TOKENS } from '../engine/data';
import { RACE_NAMES, REGION_NAMES, SIDE_TITLES, TOKEN_TEXT } from '../engine/labels';
import type { Side } from '../engine/types';
import { CardBack, CardFace } from './CardView';
import type { FxApi } from './FxContext';
import type { Effect, Rect } from './fxDirector';
import { Piece, RaceIcon, RegionBanner } from './Icon';
import { SIDE_GLYPH } from './icons';

const ROMAN = ['I', 'II', 'III'];

interface Props {
  fx: FxApi;
  /** Display name for a side (the rival's name online, the AI level…). */
  nameOf: (side: Side) => string;
}

/** Full-screen animations: turn banners and the rival's card/place/token shown big. */
export function FxLayer({ fx, nameOf }: Props) {
  const chapter = fx.display.chapter;
  return (
    <div className="vfx-layer" aria-hidden="true">
      {fx.effects.map((e) => {
        const style = { ['--life' as string]: `${e.life}ms` } as CSSProperties;
        switch (e.fx.t) {
          case 'turn': {
            const side = e.fx.side;
            const Crest = SIDE_GLYPH[side];
            const mine = side === fx.you;
            return (
              <div key={e.id} className={`vfx-banner vfx-banner-${side}`} style={style}>
                <div className="vfx-banner-band">
                  <Crest className="vfx-banner-crest" />
                  <div className="vfx-banner-text">
                    <b>{mine ? 'El teu torn' : `Torn de ${nameOf(side)}`}</b>
                    <small>{e.fx.extra ? 'Torn extra!' : SIDE_TITLES[side]}</small>
                  </div>
                </div>
              </div>
            );
          }
          case 'chapter':
            return (
              <div key={e.id} className="vfx-banner vfx-banner-chapter" style={style}>
                <div className="vfx-banner-band">
                  <span className="vfx-banner-rune">{['ᚠ', 'ᚱ', 'ᛏ'][e.fx.chapter - 1]}</span>
                  <div className="vfx-banner-text">
                    <b>Capítol {ROMAN[e.fx.chapter - 1]}</b>
                    <small>Es reparteix una nova formació de cartes</small>
                  </div>
                </div>
              </div>
            );
          case 'card': case 'free': case 'location': case 'token': case 'burn':
            return e.rival ? <Showcase key={e.id} effect={e} chapter={chapter} style={style} /> : null;
          default:
            return null;
        }
      })}
    </div>
  );
}

type Point = [number, number];

/** A card (or place, or alliance token) that lifts off, spins in 3D to the middle of the screen and flies away. */
function Showcase({ effect, chapter, style }: { effect: Effect; chapter: number; style: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const e = effect.fx;
  const kind = e.t === 'card' ? (e.mode === 'discard' ? 'discard' : 'play') : e.t;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const centre = (r?: Rect): Point | null => (r ? [r.x + r.w / 2 - vw / 2, r.y + r.h / 2 - vh / 2] : null);
    // A target off screen (e.g. the rival's panel on a phone): fly towards the nearest edge.
    const clamp = ([x, y]: Point): Point => [
      Math.max(-vw / 2 + 24, Math.min(vw / 2 - 24, x)),
      Math.max(-vh / 2 + 24, Math.min(vh / 2 - 24, y)),
    ];
    const big = Math.min(2.3, (vh * 0.48) / h, (vw * 0.62) / w);
    const from = centre(effect.from) ?? [0, vh * 0.42];
    const s0 = effect.from ? Math.max(0.25, Math.min(1.2, effect.from.w / w)) : 0.35;
    const to = clamp(centre(effect.to) ?? [0, -vh * 0.6]);
    const tf = ([x, y]: Point, s: number, rx = 0, ry = 0, rz = 0) =>
      `translate(-50%, -50%) perspective(1100px) translate3d(${x}px, ${y}px, 0) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${s})`;
    const lift: Point = [from[0], from[1] - 26];
    let frames: Keyframe[];
    if (kind === 'discard' || kind === 'burn') {
      // Shown, then it burns away.
      frames = [
        { offset: 0, transform: tf(from, s0), opacity: 1, filter: 'none' },
        { offset: 0.12, transform: tf(lift, s0 * 1.12, -18), opacity: 1 },
        { offset: 0.38, transform: tf([0, 0], big * 0.9, 0, 360), opacity: 1, filter: 'none' },
        { offset: 0.6, transform: tf([0, 0], big * 0.9, 0, 360, kind === 'burn' ? 3 : 0), filter: 'none' },
        { offset: 0.66, transform: tf([0, 0], big * 0.92, 0, 360, kind === 'burn' ? -3 : 0), filter: 'brightness(1.4) sepia(0.6)' },
        { offset: 1, transform: tf([0, -30], big * 1.2, 0, 360), opacity: 0, filter: 'brightness(2.6) sepia(1) blur(6px)' },
      ];
    } else if (kind === 'token') {
      frames = [
        { offset: 0, transform: tf([0, 0], 0.2, 0, -180), opacity: 0 },
        { offset: 0.3, transform: tf([0, 0], big, 0, 360), opacity: 1 },
        { offset: 0.72, transform: tf([0, 0], big, 0, 360), opacity: 1 },
        { offset: 1, transform: tf(to, 0.25, 0, 360, -8), opacity: 0.2 },
      ];
    } else {
      // Played card, free card or place: lift, spin to the centre, hold, fly to its new owner.
      const spin = kind === 'location' ? [360, 0] : [0, 360];
      frames = [
        { offset: 0, transform: tf(from, s0, 0, kind === 'free' ? 180 : 0), opacity: kind === 'free' ? 0 : 1 },
        { offset: 0.1, transform: tf(lift, s0 * 1.12, -20, kind === 'free' ? 220 : 0), opacity: 1 },
        { offset: 0.32, transform: tf([0, 0], big, spin[0], spin[1]), opacity: 1 },
        { offset: 0.78, transform: tf([0, 0], big, spin[0], spin[1]), opacity: 1 },
        { offset: 1, transform: tf(to, 0.22, spin[0], spin[1], -10), opacity: 0.25 },
      ];
    }
    const anim = el.animate(frames, { duration: effect.life, easing: 'cubic-bezier(0.33, 0.7, 0.25, 1)', fill: 'forwards' });
    return () => anim.cancel();
  }, [effect, kind]);

  let face;
  if (e.t === 'location') {
    const loc = LOCATIONS[e.id];
    face = (
      <div className="vfx-place">
        <RegionBanner region={loc.region} size={30} />
        <b>{loc.name}</b>
        <span><Piece side={e.by} kind="fortress" size={16} /> Fortalesa a {REGION_NAMES[loc.region]}</span>
      </div>
    );
  } else if (e.t === 'token') {
    const token = TOKENS[e.token];
    face = (
      <div className={`vfx-token plaque-${token.kind}`}>
        <span className="vfx-token-shield"><RaceIcon race={token.race} size={30} /></span>
        <b>Aliança: {RACE_NAMES[token.race]}</b>
        <span>{TOKEN_TEXT[e.token]}</span>
      </div>
    );
  } else {
    const id = effect.cardId;
    face = (
      <div className="vfx-card3d">
        <div className="vfx-face">{id && CARDS[id] ? <CardFace cardId={id} size="lg" /> : <CardBack chapter={chapter} />}</div>
        <div className="vfx-face vfx-back"><CardBack chapter={chapter} /></div>
      </div>
    );
  }

  return (
    <>
      <div className="vfx-dim" style={style} />
      <div ref={ref} className={`vfx-show vfx-show-${kind} vfx-by-${e.by}`}>{face}</div>
      <p className={`vfx-show-label vfx-label-${e.by}`} style={style}>{effect.text}</p>
    </>
  );
}
