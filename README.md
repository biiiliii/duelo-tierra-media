# Duelo por la Tierra Media — versió web

Versió digital del joc de taula per a 2 jugadors: **en línia amb sales**, al mateix ordinador o **contra la IA** (fàcil, normal, difícil, impossible o apocalipsi).

Publicat a **https://duelo-tierra-media.vercel.app** — crea una sala, comparteix l'enllaç i juga.

Opcionalment s'hi poden afegir les fitxes promocionals **La Comarca** i **Grond** (casella *Expansió* de l'inici): es barregen amb la pila de llocs clau després de girar els 3 primers.

```bash
npm install
npm run dev      # http://localhost:5173 (mode local i contra la IA)
vercel dev       # http://localhost:3000 (amb les sales en línia; cal `vercel env pull`)
npm test         # tests del motor (inclou 200 partides aleatòries)
npm run build    # app estàtica a dist/
```

- `data/` — cartes dels 3 capítols, llocs clau (i les fitxes promocionals a `expansion_locations.json`), fitxes d'aliança, mapa, marcador de l'Anell i formacions (extrets de les fotos, el reglament i la hoja de ayuda).
- `src/engine/` — motor de regles pur (sense React). `applyAction(estat, acció)` retorna l'estat nou.
- `src/engine/ai.ts` — la IA: simula cada torn complet que pot jugar i puntua el resultat. No fa trampes: abans de buscar barreja tot el que no veu (cartes tapades, descarts, piles). Els nivells canvien els pesos, el soroll i el nombre de mostres; Difícil guanya ~70% contra Normal i Normal ~90% contra Fàcil. Impossible també preveu la resposta del rival (guanya el Difícil ~80%). Apocalipsi busca igual però valora les posicions amb un model après de partides IA contra IA (`src/engine/features.ts`, `data/ai_model.json`): guanya el Difícil ~95% i l'Impossible ~84%.
- `scripts/` — joc automàtic per afinar la IA a GitHub Actions (workflow `AI self-play`): `selfplay.ts` compara configuracions, `collect.ts` recull posicions i `fit.ts` ajusta el model. `replay.ts` reconstrueix una partida (cartes tapades incloses) a partir del text copiat amb el botó **Copia** del Registre, que porta un codi `DUELO1` amb la llavor i totes les jugades.
- `src/net/` — sales en línia: `rooms.ts` (lògica, el servidor aplica el motor i valida cada jugada), `redisStore.ts` (Upstash Redis), `client.ts` (consulta periòdica des del navegador).
- `api/room.ts` — funció de Vercel (`GET` per consultar canvis, `POST` per crear/unir-se/jugar/revenja).
- `src/ui/` — interfície React.
- `docs/PLAN.md` — pla i resum de les regles implementades.
