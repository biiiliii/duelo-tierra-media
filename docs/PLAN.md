# Pla: versió web de *Duelo por la Tierra Media*

## Objectiu del MVP
Partida completa **2 jugadors al mateix ordinador** (hot-seat) amb **totes les regles** del reglament i la hoja de ayuda:
3 capítols, 69 cartes, 7 llocs clau, 18 fitxes d'aliança, mapa de 7 regions, marcador de l'Anell i les 3 victòries immediates + final per regions.
Fora del MVP: IA, joc en línia, art original de les cartes (es dibuixen amb icones).

## Stack
- **Vite + React + TypeScript** (app estàtica, sense backend).
- **Vitest** per al motor de joc.
- Les dades viuen a `data/*.json` i el codi les importa directament.

## Arquitectura
```
data/                 cartes (cap. 1–3), símbols, llocs, fitxes, mapa, marcador, formacions
src/engine/           motor pur, sense React: (estat, acció) -> estat
  types.ts            tipus de l'estat i de les accions
  data.ts             carrega JSON + taules estàtiques
  setup.ts            preparació de la partida i de cada capítol
  costs.ts            càlcul de cost (habilitats, flexibles, comodí, cadenes, monedes)
  engine.ts           reducer + cua d'efectes + decisions pendents + victòries
  *.test.ts           tests
src/ui/               components React (mapa, marcador, piràmide, llocs, panells, decisions, registre)
```

### Motor: cua d'efectes amb decisions
Cada carta/lloc/fitxa/bonificació es tradueix a una **llista de passos** (`coins`, `ring`, `placeUnits`, `move`, `removeEnemyUnit`, `extraTurn`…).
El motor els resol en ordre; si un pas necessita una tria del jugador (regió, fitxa, carta del descart…), s'atura amb un `prompt`
i la UI envia `choose`. Després de **cada pas** es comproven les victòries immediates.

Accions: `takeCard(slot, play|discard)`, `takeLocation(id)`, `choose(opció)`.

## Regles clau (resum per implementar)
- **Preparació**: Comunitat 3 monedes, Sauron 2. 2 unitats de la Comunitat a Arnor, 2 de Sauron a Mordor. 15 unitats + 7 fortaleses per bàndol. 3 llocs clau boca amunt. Comença Sauron.
- **Capítol**: es barregen 23 cartes, 3 van boca avall al descart, 20 a la formació (cap. 1 piràmide 2-3-4-5-6, cap. 2 invertida 6-5-4-3-2, cap. 3 2-3-4-2-4-3-2; files alternes boca amunt/avall). Una carta és accessible si cap carta de la fila següent la cobreix. En acabar el torn es giren les que han quedat accessibles.
- **Torn**: (A) agafar una carta accessible i jugar-la (pagant) o descartar-la (+1/2/3 monedes segons el capítol); o (B) agafar un lloc clau (cost + 1 moneda per fortalesa pròpia al tauler), posar-hi una fortalesa i aplicar l'efecte. El lloc no es reposa fins al canvi de capítol.
- **Costos**: monedes + habilitats. Cada habilitat que falta = 1 moneda. Una carta amb `/` dona una sola habilitat a escollir. Si tens el símbol de cadena requerit, la carta és gratuïta.
- **Efectes**: groc = monedes; blau = avançar l'Anell; verd = símbol de raça (aliances); vermell = N unitats en una de 2 regions; lila = moviments / el rival perd 1 moneda / retirar 1 unitat enemiga.
- **Conflicte**: quan entres en una regió amb unitats enemigues, se'n retiren de parelles fins que un bàndol es queda sense. Les fortaleses no provoquen conflicte.
- **Anell**: progrés relatiu 0→14 per a cada bàndol. Bonificacions a 3 (+1 moneda), 6 (+1 unitat on vulguis), 9 (torn extra), 12 (retirar una fortalesa enemiga). A 14: guanya la Comunitat (volcà) / guanya Sauron (atrapa Frodo).
- **Aliances**: 2 símbols iguals → robes 2 fitxes d'aquella raça i en tries 1. Un cop per partida, amb 3 símbols diferents → 1 fitxa de cada una d'aquestes 3 races i en tries 1.
- **Victòria**: Anell, o 6 símbols de raça diferents (l'Àguila compta), o presència a les 7 regions. Al final del cap. 3 guanya qui és present a més regions (empat = victòria compartida).

## Passos
1. Dades: noms reals de regions i habilitats a `symbols.json`; nous `key_locations.json`, `alliance_tokens.json`, `map.json`, `ring_track.json`, `formations.json`.
2. Projecte Vite + React + TS + Vitest.
3. Motor + tests (costos, formació/accessibilitat, conflicte, Anell, aliances, victòries, canvi de capítol).
4. UI jugable hot-seat.
5. Verificació: tests + simulació de partides aleatòries fins al final + prova al navegador.
