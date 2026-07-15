# Collaborative Canvas

Real-time multi-user drawing board built with **TypeScript**, **HTML5 Canvas**, **Express**, and **Socket.io** — Flam SSDE take-home assignment.

## Status (Day 2)

| Feature | Status |
|---------|--------|
| Express server | ✅ |
| Socket.io connected | ✅ |
| Client HTML / CSS served | ✅ |
| Local brush / eraser / clear | ✅ |
| Real-time stroke sync | ✅ |
| Cursor indicators | ⏳ next |
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

## How to test multi-user drawing

1. `npm run build && npm start`
2. Open [http://localhost:3000](http://localhost:3000) in two browser windows (or two browsers).
3. Draw in one window — ink should appear **live** in the other while you move the pointer.
4. Draw in both windows at once — strokes should not interfere.

Late joiners receive completed strokes via `room:state` and then stream live events.

## Known limitations

- Clear is still local-only (not synced yet).
- Undo/redo UI not wired.
- No cursor position indicators yet.
- No persistence across server restarts.
- Single default room only.
- Different window sizes can misalign relative stroke positions (CSS-pixel coords, full-bleed canvas).

## Time spent

_Track as you go; fill in before submission._

## Docs

See [ARCHITECTURE.md](./ARCHITECTURE.md) for data flow, protocol, and design decisions (grows with each milestone).
