# FRC ELO App

Next.js Mockups für den **1. Flunky Reifen Club** – Phase 0 aus dem Umsetzungsplan.

## Mockup-Routen

| Seite | Route |
|-------|-------|
| Home / Leaderboard | `/` |
| Spielerprofil | `/spieler/[id]` (z. B. `/spieler/p1`) |
| Live-Spieltag | `/live` |
| Spielbericht | `/spiel/[id]` (z. B. `/spiel/m1`) |

Nur Dummy-Daten, kein Backend / Auth / Persistenz.

## Start

```bash
npm install
npm run dev
```

Auf dem Ionos VPS
```bash
git clone https://github.com/Seyda92/frc-elo.git
cd frc-elo
npm install
npm run build
npm run start   # Port 3000
´´´
Öffne [http://localhost:3000](http://localhost:3000).
