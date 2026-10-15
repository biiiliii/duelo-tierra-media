# Duelo por la Tierra Media — versió web

Versió digital del joc de taula per a 2 jugadors: **en línia amb sales**, al mateix ordinador o **contra la IA** (fàcil, normal o difícil).

Publicat a **https://duelo-tierra-media.vercel.app** — crea una sala, comparteix l'enllaç i juga.

```bash
npm install
npm run dev      # http://localhost:5173 (mode local i contra la IA)
vercel dev       # http://localhost:3000 (amb les sales en línia; cal `vercel env pull`)
npm test         # tests del motor (inclou 200 partides aleatòries)
npm run build    # app estàtica a dist/
```

- `data/` — cartes dels 3 capítols, llocs clau, fitxes d'aliança, mapa, marcador de l'Anell i formacions (extrets de les fotos, el reglament i la hoja de ayuda).
- `src/engine/` — motor de regles pur (sense React). `applyAction(estat, acció)` retorna l'estat nou.
- `src/engine/ai.ts` — la IA: simula cada torn complet que pot jugar i puntua el resultat. No fa trampes: abans de buscar barreja tot el que no veu (cartes tapades, descarts, piles). Els nivells canvien els pesos, el soroll i el nombre de mostres; Difícil guanya ~70% contra Normal i Normal ~90% contra Fàcil.
- `src/net/` — sales en línia: `rooms.ts` (lògica, el servidor aplica el motor i valida cada jugada), `redisStore.ts` (Upstash Redis), `client.ts` (consulta periòdica des del navegador).
- `api/room.ts` — funció de Vercel (`GET` per consultar canvis, `POST` per crear/unir-se/jugar/revenja).
- `src/ui/` — interfície React.
- `docs/PLAN.md` — pla i resum de les regles implementades.
