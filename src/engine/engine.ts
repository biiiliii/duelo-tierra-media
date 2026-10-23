import {
  ADJACENT, BASE_LOCATIONS, CARDS, CHAPTER_CARDS, EXPANSIONS, FORMATIONS, LOCATIONS, MAP_SETUP, PIECES, RACES, REGION_IDS,
  RING_BONUSES, RING_LENGTH, TOKENS, otherSide,
} from './data.js';
import { cardCost, locationCost } from './costs.js';
import { RACE_NAMES, REGION_NAMES, SIDE_NAMES, cardLabel, fromRegion, playedCardLabel, tokenLabel } from './labels.js';
import type {
  Action, Chapter, Expansion, Fx, FxBody, GameState, PlayerState, Prompt, PromptOption, Race, RegionId, RegionState, Side,
  Slot, Step,
} from './types.js';

// ---------- randomness (seeded, stored in state so games are reproducible) ----------

function random(state: GameState): number {
  let t = (state.seed = (state.seed + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function shuffle<T>(state: GameState, items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random(state) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- setup ----------

function newPlayer(side: Side): PlayerState {
  return {
    side,
    coins: side === 'fellowship' ? 3 : 2,
    cards: [],
    locations: [],
    tokens: [],
    ring: 0,
    unitsSupply: PIECES.units,
    fortressSupply: PIECES.fortresses,
    pairsTaken: [],
    usedThreeDifferent: false,
  };
}

/** A new game; `expansions` adds the chosen promo tiles to the key location stack. */
export function newGame(seed: number = Date.now(), expansions: Expansion[] = []): GameState {
  const regions = Object.fromEntries(
    REGION_IDS.map((id) => [id, { units: { fellowship: 0, sauron: 0 }, fortress: null }]),
  ) as Record<RegionId, RegionState>;
  const state: GameState = {
    players: { fellowship: newPlayer('fellowship'), sauron: newPlayer('sauron') },
    regions,
    chapter: 1,
    slots: [],
    discard: [],
    locationDeck: [],
    locationsFaceUp: [],
    alliancePiles: { elves: [], dwarves: [], hobbits: [], men: [], ents: [], wizards: [] },
    current: 'sauron',
    extraTurns: 0,
    queue: [],
    prompt: null,
    winner: null,
    log: [],
    fx: [],
    seed: seed | 0,
    turn: 1,
  };
  for (const side of ['fellowship', 'sauron'] as Side[]) {
    for (const [region, n] of Object.entries(MAP_SETUP[side])) {
      state.regions[region as RegionId].units[side] += n!;
      state.players[side].unitsSupply -= n!;
    }
  }
  for (const race of RACES) {
    state.alliancePiles[race] = shuffle(
      state,
      Object.values(TOKENS).filter((t) => t.race === race).map((t) => t.id),
    );
  }
  const locs = shuffle(state, BASE_LOCATIONS);
  state.locationsFaceUp = locs.slice(0, 3);
  state.locationDeck = locs.slice(3);
  // The promo tiles go into the stack after the first 3 are revealed (and only then, so base games deal as before).
  const promos = EXPANSIONS.filter((e) => expansions.includes(e));
  if (promos.length > 0) {
    state.expansions = promos;
    state.locationDeck = shuffle(state, [...state.locationDeck, ...promos]);
  }
  setupChapter(state, 1);
  log(state, 'Comença la partida' +
    (promos.length > 0 ? ` amb ${promos.map((e) => LOCATIONS[e].name).join(' i ')}` : '') + '. Sauron juga primer.');
  emit(state, { t: 'turn', side: 'sauron', extra: false });
  return state;
}

function setupChapter(state: GameState, chapter: Chapter): void {
  state.chapter = chapter;
  const deck = shuffle(state, CHAPTER_CARDS[chapter]);
  state.discard.push(...deck.slice(0, 3));
  let i = 3;
  const slots: Slot[] = [];
  FORMATIONS[`${chapter}`].forEach((row, r) => {
    for (const x of row.x) {
      slots.push({ id: slots.length, cardId: deck[i++], row: r, x, faceUp: row.faceUp, taken: false });
    }
  });
  state.slots = slots;
  while (state.locationsFaceUp.length < 3 && state.locationDeck.length > 0) {
    state.locationsFaceUp.push(state.locationDeck.shift()!);
  }
  log(state, `— Capítol ${chapter} —`);
  emit(state, { t: 'chapter', chapter });
}

// ---------- queries ----------

export function isAccessible(state: GameState, slot: Slot): boolean {
  if (slot.taken) return false;
  return !state.slots.some(
    (s) => !s.taken && s.row === slot.row + 1 && Math.abs(s.x - slot.x) <= 1,
  );
}

export function raceSymbols(state: GameState, side: Side): Set<string> {
  const races = new Set<string>();
  for (const id of state.players[side].cards) {
    const race = CARDS[id].effect.race;
    if (race) races.add(race);
  }
  if (state.players[side].tokens.includes('hobbits_eagle')) races.add('eagle');
  return races;
}

function greenRaceCounts(state: GameState, side: Side): Record<Race, number> {
  const counts = { elves: 0, dwarves: 0, hobbits: 0, men: 0, ents: 0, wizards: 0 };
  for (const id of state.players[side].cards) {
    const race = CARDS[id].effect.race;
    if (race) counts[race]++;
  }
  return counts;
}

export function presence(state: GameState, side: Side): number {
  return REGION_IDS.filter((id) => {
    const r = state.regions[id];
    return r.fortress === side || r.units[side] > 0;
  }).length;
}

function hasToken(state: GameState, side: Side, token: string): boolean {
  return state.players[side].tokens.includes(token);
}

function coinWord(n: number): string {
  return `${n} ${n === 1 ? 'moneda' : 'monedes'}`;
}

function log(state: GameState, msg: string, join = false): void {
  // "Sauron juga carta Groga." + "Sauron guanya 2 monedes." -> "Sauron juga carta Groga i guanya 2 monedes."
  const actor = `${SIDE_NAMES[state.current]} `;
  if (join && state.log.length > 0 && msg.startsWith(actor)) {
    const last = state.log.length - 1;
    state.log[last] = `${state.log[last].replace(/\.$/, '')} i ${msg.slice(actor.length)}`;
    return;
  }
  state.log.push(msg.charAt(0).toUpperCase() + msg.slice(1));
}

/** Marks the first effect of a card or place so its log line joins the one that played it. */
function joined(steps: Step[]): Step[] {
  if (steps.length > 0) steps[0] = { ...steps[0], join: true };
  return steps;
}

/** Records an event for the UI, described by the log line just written. */
function emit(state: GameState, fx: FxBody): void {
  // Games saved before events existed have no list yet.
  (state.fx ??= []).push({ ...fx, by: state.current, at: state.log.length } as Fx);
}

// ---------- victory ----------

function checkWinner(state: GameState): void {
  if (state.winner) return;
  const order: Side[] = [state.current, otherSide(state.current)];
  for (const side of order) {
    const p = state.players[side];
    if (p.ring >= RING_LENGTH) {
      state.winner = {
        sides: [side],
        reason: side === 'fellowship'
          ? 'Frodo i Sam arriben al volcà i destrueixen l\'Anell Únic.'
          : 'El Nazgûl atrapa Frodo i Sam i s\'apodera de l\'Anell Únic.',
      };
      return;
    }
    if (raceSymbols(state, side).size >= 6) {
      state.winner = { sides: [side], reason: 'Ha aconseguit el suport de 6 races diferents.' };
      return;
    }
    if (presence(state, side) === REGION_IDS.length) {
      state.winner = { sides: [side], reason: 'Ha conquerit la Terra Mitjana (present a les 7 regions).' };
      return;
    }
  }
}

function finalScoring(state: GameState): void {
  const f = presence(state, 'fellowship');
  const s = presence(state, 'sauron');
  const sides: Side[] = f > s ? ['fellowship'] : s > f ? ['sauron'] : ['fellowship', 'sauron'];
  state.winner = {
    sides,
    reason: `Final del capítol 3: Comunitat present a ${f} regions, Sauron a ${s}.` +
      (sides.length === 2 ? ' Empat: victòria compartida.' : ''),
  };
  log(state, state.winner.reason);
}

// ---------- board helpers ----------

function resolveConflict(state: GameState, region: RegionId): void {
  const r = state.regions[region];
  const m = Math.min(r.units.fellowship, r.units.sauron);
  if (m === 0) return;
  r.units.fellowship -= m;
  r.units.sauron -= m;
  state.players.fellowship.unitsSupply += m;
  state.players.sauron.unitsSupply += m;
  log(state, `Conflicte a ${REGION_NAMES[region]}: cada bàndol perd ${m} unitat${m > 1 ? 's' : ''}.`);
  emit(state, { t: 'conflict', region, n: m });
}

function placeUnits(state: GameState, side: Side, region: RegionId, n: number, join = false): void {
  const p = state.players[side];
  const placed = Math.min(n, p.unitsSupply);
  if (placed === 0) {
    log(state, `${SIDE_NAMES[side]} no té unitats a la reserva.`, join);
    return;
  }
  p.unitsSupply -= placed;
  state.regions[region].units[side] += placed;
  log(state, `${SIDE_NAMES[side]} col·loca ${placed} unitat${placed > 1 ? 's' : ''} a ${REGION_NAMES[region]}.`, join);
  emit(state, { t: 'units', side, region, n: placed });
  resolveConflict(state, region);
}

function regionOptions(regions: RegionId[]): PromptOption[] {
  return regions.map((r) => ({ value: r, label: REGION_NAMES[r] }));
}

// ---------- effects ----------

function cardSteps(state: GameState, side: Side, cardId: string, viaChain: boolean): Step[] {
  const card = CARDS[cardId];
  const e = card.effect;
  const steps: Step[] = [];
  if (e.coins) steps.push({ k: 'coins', n: e.coins });
  if (e.ring) steps.push({ k: 'ring', n: e.ring });
  if (e.military) {
    const units = e.military.units + (hasToken(state, side, 'men_red_extra') ? 1 : 0);
    const regions = hasToken(state, side, 'elves_red_any') ? REGION_IDS : e.military.regions;
    steps.push({ k: 'placeUnits', n: units, regions });
  }
  if (e.special) {
    for (const icon of e.special) {
      if (icon === 'arrow') steps.push({ k: 'move', n: 1 });
      else if (icon === 'coin_cross') steps.push({ k: 'oppLoseCoin', n: 1 });
      else steps.push({ k: 'removeEnemyUnit' });
    }
  }
  if (e.race) steps.push({ k: 'checkRaces', race: e.race });
  // Persistent alliance abilities
  if (card.color === 'yellow' && hasToken(state, side, 'elves_yellow_turn')) steps.push({ k: 'extraTurn' });
  if (card.color === 'yellow' && hasToken(state, side, 'men_yellow_ring')) steps.push({ k: 'ring', n: 1 });
  if (card.color === 'blue' && hasToken(state, side, 'hobbits_blue_unit')) {
    steps.push({ k: 'placeUnits', n: 1, regions: REGION_IDS });
  }
  if (card.color === 'green' && hasToken(state, side, 'dwarves_green_move')) steps.push({ k: 'move', n: 2 });
  if (viaChain && hasToken(state, side, 'hobbits_chain_coins')) steps.push({ k: 'coins', n: 3 });
  return steps;
}

function tokenSteps(tokenId: string): Step[] {
  switch (tokenId) {
    case 'ents_turn': return [{ k: 'extraTurn' }];
    case 'ents_remove_fortress': return [{ k: 'removeEnemyFortress' }];
    case 'ents_triple': return [{ k: 'entsTriple', n: 3 }];
    case 'wizards_ring': return [{ k: 'ring', n: 2 }];
    case 'wizards_units': return [{ k: 'wizardUnits' }];
    case 'wizards_discard_play': return [{ k: 'playFromDiscard' }];
    default: return [];
  }
}

function ask(state: GameState, step: Step, message: string, target: Prompt['target'], options: PromptOption[], drawn?: string[]): void {
  state.prompt = { step, message, target, options, drawn };
}

function enemyUnitRegions(state: GameState, side: Side): RegionId[] {
  return REGION_IDS.filter((r) => state.regions[r].units[otherSide(side)] > 0);
}

function ownUnitRegions(state: GameState, side: Side): RegionId[] {
  return REGION_IDS.filter((r) => state.regions[r].units[side] > 0);
}

/** Runs one step. May open a prompt (and then the step resumes in `resolveChoice`). */
function runStep(state: GameState, step: Step): void {
  const side = state.current;
  const me = state.players[side];
  const opp = state.players[otherSide(side)];
  switch (step.k) {
    case 'coins':
      me.coins += step.n;
      log(state, `${SIDE_NAMES[side]} guanya ${coinWord(step.n)}.`, step.join);
      emit(state, { t: 'coins', side, n: step.n });
      return;
    case 'oppLoseCoin': {
      const lost = Math.min(step.n, opp.coins);
      opp.coins -= lost;
      log(state, `${SIDE_NAMES[otherSide(side)]} perd ${coinWord(lost)}.`);
      if (lost > 0) emit(state, { t: 'coins', side: otherSide(side), n: -lost });
      return;
    }
    case 'ring': {
      const from = me.ring;
      const bonuses: Step[] = [];
      for (let i = 0; i < step.n && me.ring < RING_LENGTH; i++) {
        me.ring++;
        const bonus = RING_BONUSES[me.ring];
        if (bonus === 'coin') bonuses.push({ k: 'coins', n: 1 });
        else if (bonus === 'unit') bonuses.push({ k: 'placeUnits', n: 1, regions: REGION_IDS });
        else if (bonus === 'extra_turn') bonuses.push({ k: 'extraTurn' });
        else if (bonus === 'remove_fortress') bonuses.push({ k: 'removeEnemyFortress' });
      }
      log(state, `${SIDE_NAMES[side]} avança a la Missió de l'Anell (${me.ring}/${RING_LENGTH}).`, step.join);
      emit(state, { t: 'ring', side, from, to: me.ring });
      state.queue.unshift(...bonuses);
      return;
    }
    case 'extraTurn':
      state.extraTurns++;
      log(state, `${SIDE_NAMES[side]} jugarà un altre torn.`, step.join);
      emit(state, { t: 'extra', side });
      return;
    case 'placeFortress':
      if (me.fortressSupply > 0) {
        me.fortressSupply--;
        state.regions[step.region].fortress = side;
        // Only places queue a fortress, and their log line already says where it goes.
        emit(state, { t: 'fortress', side, region: step.region });
      }
      return;
    case 'placeUnits':
      if (me.unitsSupply === 0) {
        log(state, `${SIDE_NAMES[side]} no té unitats a la reserva.`, step.join);
        return;
      }
      if (step.regions.length === 1) {
        placeUnits(state, side, step.regions[0], step.n, step.join);
        return;
      }
      ask(state, step, `Tria on col·locar ${step.n} unitat${step.n > 1 ? 's' : ''}.`, 'region', regionOptions(step.regions));
      return;
    case 'move': {
      const from = ownUnitRegions(state, side);
      if (step.n <= 0 || from.length === 0) return;
      ask(state, step, `Moviment (${step.n} restant${step.n > 1 ? 's' : ''}): tria una regió d'origen.`, 'region',
        [...regionOptions(from), { value: 'skip', label: 'Renunciar als moviments' }]);
      return;
    }
    case 'moveTo':
      ask(state, step, `Mou 1 unitat ${fromRegion(step.from)}: tria la regió adjacent.`, 'region',
        regionOptions(ADJACENT[step.from]));
      return;
    case 'removeEnemyUnit': {
      const regions = enemyUnitRegions(state, side);
      if (regions.length === 0) return;
      ask(state, step, 'Tria d\'on retirar 1 unitat enemiga.', 'region', regionOptions(regions));
      return;
    }
    case 'removeEnemyFortress': {
      const regions = REGION_IDS.filter((r) => state.regions[r].fortress === otherSide(side));
      if (regions.length === 0) return;
      ask(state, step, 'Tria quina fortalesa enemiga retirar.', 'region', regionOptions(regions));
      return;
    }
    case 'checkRaces': {
      const counts = greenRaceCounts(state, side);
      const follow: Step[] = [];
      if (counts[step.race] >= 2 && !me.pairsTaken.includes(step.race)) {
        me.pairsTaken.push(step.race);
        follow.push({ k: 'alliance', races: [step.race], perRace: 2, reason: `2 símbols de ${RACE_NAMES[step.race]}` });
      }
      const distinct = RACES.filter((r) => counts[r] > 0);
      if (distinct.length >= 3 && !me.usedThreeDifferent) {
        me.usedThreeDifferent = true;
        follow.push({ k: 'alliance', races: distinct, perRace: 1, reason: '3 símbols de raça diferents' });
      }
      state.queue.unshift(...follow);
      return;
    }
    case 'alliance': {
      const drawn: string[] = [];
      for (const race of step.races) {
        const pile = state.alliancePiles[race];
        for (let i = 0; i < step.perRace && pile.length > 0; i++) drawn.push(pile.pop()!);
      }
      if (drawn.length === 0) return;
      ask(state, step, `Aliança (${step.reason}): tria 1 fitxa.`, 'token',
        drawn.map((t) => ({ value: t, label: tokenLabel(t) })), drawn);
      return;
    }
    case 'allianceAnyRace': {
      const races = RACES.filter((r) => state.alliancePiles[r].length > 0);
      if (races.length === 0) return;
      ask(state, step, 'Puertos Grises: tria la raça de la qual robaràs 2 fitxes.', 'choice',
        races.map((r) => ({ value: r, label: RACE_NAMES[r] })));
      return;
    }
    case 'playFromDiscard': {
      if (state.discard.length === 0) return;
      const unique = [...new Set(state.discard)];
      ask(state, step, 'Tria 1 carta de la pila de descarts per jugar-la gratis.', 'card',
        unique.map((c) => ({ value: c, label: cardLabel(c) })));
      return;
    }
    case 'discardOppGrey': {
      const greys = opp.cards.filter((c) => CARDS[c].color === 'grey');
      if (greys.length === 0) return;
      ask(state, step, 'Tria una carta Grisa del rival per descartar-la.', 'card',
        greys.map((c) => ({ value: c, label: cardLabel(c) })));
      return;
    }
    case 'playVisible': {
      const visible = state.slots.filter((s) => s.faceUp && !s.taken);
      if (visible.length === 0) return;
      ask(state, step, 'La Comarca: tria 1 carta boca amunt per jugar-la gratis, encara que estigui tapada.', 'card',
        visible.map((s) => ({ value: s.cardId, label: cardLabel(s.cardId) })));
      return;
    }
    case 'grondRaze': {
      const regions = REGION_IDS.filter((r) => state.regions[r].fortress === otherSide(side));
      if (regions.length === 0) {
        log(state, `${SIDE_NAMES[side]} no troba cap fortalesa enemiga per a Grond.`, step.join);
        return;
      }
      ask(state, step, 'Grond: tria quina fortalesa enemiga enderrocar.', 'region', regionOptions(regions));
      return;
    }
    case 'grondRetreat': {
      const n = state.regions[step.region].units[otherSide(side)];
      ask(state, step, `Tria cap a on fugen les ${n} unitat${n > 1 ? 's' : ''} enemigues ${fromRegion(step.region)}.`, 'region',
        regionOptions(ADJACENT[step.region]));
      return;
    }
    case 'wizardUnits':
      if (me.unitsSupply === 0) return;
      ask(state, step, 'Mags: com vols col·locar les unitats?', 'choice', [
        { value: 'two', label: '2 unitats en 1 regió' },
        { value: 'split', label: '1 unitat en 2 regions diferents' },
      ]);
      return;
    case 'wizardFirst':
      if (me.unitsSupply === 0) return;
      ask(state, step, 'Tria la primera regió per a 1 unitat.', 'region', regionOptions(REGION_IDS));
      return;
    case 'wizardSecond':
      if (me.unitsSupply === 0) return;
      ask(state, step, 'Tria la segona regió per a 1 unitat.', 'region',
        regionOptions(REGION_IDS.filter((r) => r !== step.exclude)));
      return;
    case 'entsTriple': {
      if (step.n <= 0) return;
      const options: PromptOption[] = [{ value: 'coin', label: 'El rival perd 1 moneda' }];
      if (enemyUnitRegions(state, side).length > 0) options.unshift({ value: 'unit', label: 'Retirar 1 unitat enemiga' });
      if (ownUnitRegions(state, side).length > 0) options.push({ value: 'move', label: 'Fer 1 moviment' });
      ask(state, step, `Ents: tria una acció (${step.n} restant${step.n > 1 ? 's' : ''}).`, 'choice', options);
      return;
    }
  }
}

function playCardFree(state: GameState, side: Side, cardId: string): void {
  state.players[side].cards.push(cardId);
  log(state, `${SIDE_NAMES[side]} juga ${playedCardLabel(cardId)} gratis.`);
  emit(state, { t: 'free', cardId });
  state.queue.unshift(...joined(cardSteps(state, side, cardId, false)));
}

function resolveChoice(state: GameState, prompt: Prompt, value: string): void {
  const side = state.current;
  const step = prompt.step;
  const opp = otherSide(side);
  switch (step.k) {
    case 'placeUnits':
      placeUnits(state, side, value as RegionId, step.n, step.join);
      return;
    case 'move':
      if (value === 'skip') {
        log(state, `${SIDE_NAMES[side]} renuncia als moviments restants.`, step.join);
        return;
      }
      state.queue.unshift({ k: 'moveTo', from: value as RegionId, n: step.n, join: step.join });
      return;
    case 'moveTo': {
      const to = value as RegionId;
      state.regions[step.from].units[side]--;
      state.regions[to].units[side]++;
      log(state, `${SIDE_NAMES[side]} mou 1 unitat ${fromRegion(step.from)} a ${REGION_NAMES[to]}.`, step.join);
      emit(state, { t: 'move', side, from: step.from, to });
      resolveConflict(state, to);
      if (step.n > 1) state.queue.unshift({ k: 'move', n: step.n - 1 });
      return;
    }
    case 'removeEnemyUnit': {
      const r = value as RegionId;
      state.regions[r].units[opp]--;
      state.players[opp].unitsSupply++;
      log(state, `${SIDE_NAMES[side]} retira 1 unitat enemiga ${fromRegion(r, 'de')}.`, step.join);
      emit(state, { t: 'kill', side: opp, region: r });
      return;
    }
    case 'removeEnemyFortress': {
      const r = value as RegionId;
      state.regions[r].fortress = null;
      state.players[opp].fortressSupply++;
      log(state, `${SIDE_NAMES[side]} retira la fortalesa enemiga ${fromRegion(r, 'de')}.`);
      emit(state, { t: 'raze', side: opp, region: r });
      return;
    }
    case 'alliance': {
      const drawn = prompt.drawn ?? [];
      state.players[side].tokens.push(value);
      log(state, `${SIDE_NAMES[side]} s'alia amb els ${RACE_NAMES[TOKENS[value].race]}.`);
      emit(state, { t: 'token', side, token: value });
      // Put the others back on top of their own piles.
      for (const t of drawn) {
        if (t !== value) state.alliancePiles[TOKENS[t].race].push(t);
      }
      state.queue.unshift(...tokenSteps(value));
      return;
    }
    case 'allianceAnyRace':
      state.queue.unshift({ k: 'alliance', races: [value as Race], perRace: 2, reason: 'Puertos Grises' });
      return;
    case 'playFromDiscard': {
      state.discard.splice(state.discard.indexOf(value), 1);
      playCardFree(state, side, value);
      return;
    }
    case 'discardOppGrey': {
      const cards = state.players[opp].cards;
      cards.splice(cards.indexOf(value), 1);
      state.discard.push(value);
      log(state, `${SIDE_NAMES[side]} fa descartar ${cardLabel(value)} al rival.`);
      emit(state, { t: 'burn', side: opp, cardId: value });
      return;
    }
    case 'playVisible': {
      const slot = state.slots.find((s) => s.cardId === value)!;
      slot.taken = true;
      state.players[side].cards.push(value);
      log(state, `${SIDE_NAMES[side]} juga ${playedCardLabel(value)} gratis.`);
      emit(state, { t: 'card', slot: slot.id, mode: 'play', cardId: value });
      state.queue.unshift(...joined(cardSteps(state, side, value, false)));
      return;
    }
    case 'grondRaze': {
      const r = value as RegionId;
      state.regions[r].fortress = null;
      state.players[opp].fortressSupply++;
      log(state, `Grond enderroca la fortalesa enemiga ${fromRegion(r, 'de')}.`);
      emit(state, { t: 'raze', side: opp, region: r });
      const then: Step[] = [{ k: 'placeFortress', region: r }, { k: 'placeUnits', n: 1, regions: [r] }];
      if (state.regions[r].units[opp] > 0) then.unshift({ k: 'grondRetreat', region: r });
      state.queue.unshift(...then);
      return;
    }
    case 'grondRetreat': {
      const to = value as RegionId;
      const n = state.regions[step.region].units[opp];
      state.regions[step.region].units[opp] = 0;
      state.regions[to].units[opp] += n;
      log(state, `${n} unitat${n > 1 ? 's' : ''} de ${SIDE_NAMES[opp]} ${n > 1 ? 'fugen' : 'fuig'} ${fromRegion(step.region, 'de')} cap a ${REGION_NAMES[to]}.`);
      for (let i = 0; i < n; i++) emit(state, { t: 'move', side: opp, from: step.region, to });
      resolveConflict(state, to);
      return;
    }
    case 'wizardUnits':
      state.queue.unshift(value === 'two' ? { k: 'placeUnits', n: 2, regions: REGION_IDS } : { k: 'wizardFirst' });
      return;
    case 'wizardFirst': {
      const r = value as RegionId;
      placeUnits(state, side, r, 1);
      state.queue.unshift({ k: 'wizardSecond', exclude: r });
      return;
    }
    case 'wizardSecond':
      placeUnits(state, side, value as RegionId, 1);
      return;
    case 'entsTriple': {
      const next: Step[] = [];
      if (value === 'unit') next.push({ k: 'removeEnemyUnit' });
      else if (value === 'coin') next.push({ k: 'oppLoseCoin', n: 1 });
      else next.push({ k: 'move', n: 1 });
      next.push({ k: 'entsTriple', n: step.n - 1 });
      state.queue.unshift(...next);
      return;
    }
    default:
      throw new Error(`Step ${step.k} does not take choices`);
  }
}

// ---------- turn flow ----------

function processQueue(state: GameState): void {
  while (!state.winner && !state.prompt && state.queue.length > 0) {
    runStep(state, state.queue.shift()!);
    checkWinner(state);
  }
  if (!state.winner && !state.prompt) endTurn(state);
}

function endTurn(state: GameState): void {
  for (const slot of state.slots) {
    if (!slot.faceUp && isAccessible(state, slot)) {
      slot.faceUp = true;
      emit(state, { t: 'reveal', slot: slot.id });
    }
  }
  if (state.slots.every((s) => s.taken)) {
    if (state.chapter === 3) {
      finalScoring(state);
      return;
    }
    setupChapter(state, (state.chapter + 1) as Chapter);
  }
  if (state.extraTurns > 0) {
    state.extraTurns--;
    emit(state, { t: 'turn', side: state.current, extra: true });
  } else {
    emit(state, { t: 'turn', side: otherSide(state.current), extra: false });
    state.current = otherSide(state.current);
  }
  state.turn++;
}

export class IllegalAction extends Error {}

export function applyAction(prev: GameState, action: Action): GameState {
  if (prev.winner) throw new IllegalAction('La partida ja ha acabat.');
  const state = structuredClone(prev);
  const side = state.current;
  const me = state.players[side];

  if (action.type === 'choose') {
    const prompt = state.prompt;
    if (!prompt) throw new IllegalAction('No hi ha cap decisió pendent.');
    if (!prompt.options.some((o) => o.value === action.value)) throw new IllegalAction('Opció no vàlida.');
    state.prompt = null;
    resolveChoice(state, prompt, action.value);
    checkWinner(state);
    processQueue(state);
    return state;
  }

  if (state.prompt) throw new IllegalAction('Primer cal resoldre la decisió pendent.');

  if (action.type === 'takeCard') {
    const slot = state.slots[action.slot];
    if (!slot || !isAccessible(state, slot)) throw new IllegalAction('Aquesta carta no és accessible.');
    slot.taken = true;
    if (action.mode === 'discard') {
      const coins = state.chapter * (hasToken(state, side, 'men_discard_double') ? 2 : 1);
      state.discard.push(slot.cardId);
      me.coins += coins;
      log(state, `${SIDE_NAMES[side]} descarta una carta i guanya ${coinWord(coins)}.`);
      emit(state, { t: 'card', slot: slot.id, mode: 'discard' });
      emit(state, { t: 'coins', side, n: coins });
    } else {
      const quote = cardCost(state, side, slot.cardId);
      if (!quote.affordable) throw new IllegalAction('No pots pagar aquesta carta.');
      me.coins -= quote.coins;
      me.cards.push(slot.cardId);
      log(state, `${SIDE_NAMES[side]} juga ${playedCardLabel(slot.cardId)}` +
        (quote.viaChain ? ' (cadena)' : quote.coins > 0 ? ` pagant ${coinWord(quote.coins)}` : '') + '.');
      emit(state, { t: 'card', slot: slot.id, mode: 'play', cardId: slot.cardId });
      if (quote.coins > 0) emit(state, { t: 'coins', side, n: -quote.coins });
      state.queue.push(...joined(cardSteps(state, side, slot.cardId, quote.viaChain)));
    }
  } else if (action.type === 'takeLocation') {
    if (!state.locationsFaceUp.includes(action.id)) throw new IllegalAction('Aquest lloc no està disponible.');
    const quote = locationCost(state, side, action.id);
    if (!quote.affordable) throw new IllegalAction('No pots pagar aquest lloc.');
    const loc = LOCATIONS[action.id];
    me.coins -= quote.coins;
    me.locations.push(action.id);
    state.locationsFaceUp = state.locationsFaceUp.filter((id) => id !== action.id);
    log(state, `${SIDE_NAMES[side]} construeix ${loc.name}${loc.region ? ` (${REGION_NAMES[loc.region]})` : ''}` +
      (quote.coins > 0 ? ` pagant ${coinWord(quote.coins)}` : '') + '.');
    emit(state, { t: 'location', id: action.id });
    if (quote.coins > 0) emit(state, { t: 'coins', side, n: -quote.coins });
    if (loc.region) state.queue.push({ k: 'placeFortress', region: loc.region });
    const effects: Step[] = [];
    for (const e of loc.effects) {
      if (e.type === 'place_units') effects.push({ k: 'placeUnits', n: e.n, regions: [e.region] });
      else if (e.type === 'ring') effects.push({ k: 'ring', n: e.n });
      else if (e.type === 'move') effects.push({ k: 'move', n: e.n });
      else if (e.type === 'coins') effects.push({ k: 'coins', n: e.n });
      else if (e.type === 'play_from_discard') effects.push({ k: 'playFromDiscard' });
      else if (e.type === 'discard_opponent_grey') effects.push({ k: 'discardOppGrey' });
      else if (e.type === 'alliance_any_race') effects.push({ k: 'allianceAnyRace' });
      else if (e.type === 'play_visible') effects.push({ k: 'playVisible' });
      else if (e.type === 'grond') effects.push({ k: 'grondRaze' });
    }
    state.queue.push(...joined(effects));
    if (hasToken(state, side, 'dwarves_loc_turn')) state.queue.push({ k: 'extraTurn' });
  }
  processQueue(state);
  return state;
}

/** Every legal action for the player to move (used by the bot, tests and UI hints). */
export function legalActions(state: GameState): Action[] {
  if (state.winner) return [];
  if (state.prompt) return state.prompt.options.map((o) => ({ type: 'choose', value: o.value }));
  const actions: Action[] = [];
  for (const slot of state.slots) {
    if (!isAccessible(state, slot)) continue;
    if (cardCost(state, state.current, slot.cardId).affordable) {
      actions.push({ type: 'takeCard', slot: slot.id, mode: 'play' });
    }
    actions.push({ type: 'takeCard', slot: slot.id, mode: 'discard' });
  }
  for (const id of state.locationsFaceUp) {
    if (locationCost(state, state.current, id).affordable) actions.push({ type: 'takeLocation', id });
  }
  return actions;
}
