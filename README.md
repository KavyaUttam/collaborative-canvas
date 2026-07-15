# Collaborative Canvas

Real-time multi-user drawing board built with **TypeScript**, **HTML5 Canvas**, **Express**, and **Socket.io** — Flam SSDE take-home assignment.

## Status (Day 1)

| Feature | Status |
|---------|--------|
| Express server | ✅ |
| Socket.io connected | ✅ |
| Client HTML / CSS served | ✅ |
| Local brush / eraser / clear | ✅ |
| Real-time stroke sync | ⏳ next |
| Cursor indicators | ⏳ |
| Global undo / redo | ⏳ |
| Deployed demo | ⏳ |

## Quick start

```bash
npm install
npm run build
npm start
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | What it does |
|---------|----------------|
| `npm run build` | Compile server (tsc) + bundle client (esbuild) |
| `npm start` | Run the production server from `dist/` |
| `npm run dev` | Build then start |

## Project layout

```
collaborative-canvas/
├── client/          # Browser app (canvas, UI, socket client)
├── server/          # Express + Socket.io + room/state
├── shared/          # Protocol types shared by both sides
├── scripts/         # Build helpers
└── dist/            # Build output (gitignored)
```

## How to test (today)

1. Start the server and open one browser tab.
2. Draw with brush, switch eraser, change color/size, clear.
3. Open a second tab — you should see **Online** count update when the second client connects (drawing is still local-only until sync lands).

## Multi-user drawing (coming next)

Stroke events will stream point-by-point so peers see ink as it is drawn, not only after mouse-up.

## Known limitations

- Drawing is **not** synchronized across clients yet.
- Undo/redo UI not wired.
- No persistence across server restarts.
- Single default room only.

## Time spent

_Track as you go; fill in before submission._

## Docs

See [ARCHITECTURE.md](./ARCHITECTURE.md) for data flow, protocol, and design decisions (grows with each milestone).
