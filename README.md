# Collaborative Canvas

Real-time multi-user drawing board for the **Flam SSDE** assignment — **TypeScript**, **HTML5 Canvas**, **Express**, and **Socket.io**. No frontend frameworks and no canvas libraries.

**Live demo:** (https://collaborative-canvas-21lj.onrender.com/) 

**Repository:** https://github.com/KavyaUttam/collaborative-canvas

## Features

- Real-time collaborative drawing
- Live stroke streaming (ink appears while peers draw)
- Brush & eraser
- Adjustable stroke width
- Color picker
- Live cursor sharing (HTML overlay, not on the drawing canvas)
- Online users panel with stable assigned colors
- Global undo / redo (server-authoritative history)
- Shared clear for the whole room

## Quick start

```bash
npm install
npm run build
npm start
```

Open [http://localhost:3000](http://localhost:3000).

Requires **Node.js 18+**.

## How to test with multiple users

1. Open the app in **2–3 browser windows** (or Chrome + Firefox).
2. Draw in one window — peers should see strokes **while** you move, not only on mouse-up.
3. Move the pointer — colored remote cursors with names should track smoothly.
4. Confirm the **Online** sidebar lists each user with a stable color.
5. Use **Undo** / **Redo** — every window should apply the same history change.
6. **Clear** should wipe the canvas for everyone.
7. Refresh one tab — it should rejoin, receive `room:state`, and keep drawing with others.
8. Close a tab — that user should disappear from the sidebar.

### Edge cases worth checking

- Undo / redo when stacks are empty (should no-op)
- Draw while another user undoes
- Spam undo / clear
- Resize the window mid-session
- Different colors and brush widths across users

## Architecture highlights

- **Stroke-based model** — vector point lists, not bitmaps or image blobs
- **Shared TypeScript protocol** (`shared/protocol.ts`) — one contract for client and server
- **Incremental rendering** — paint only the newest segment on each move/point
- **Server-authoritative history** — undo/redo/clear mutate server state first, then broadcast
- **Peer-only broadcast for drawing/cursors** — sender already applied locally
- **Full stroke replay only for history ops / resize / late join**
- **Separation of concerns** — drawing engine vs networking vs UI vs rooms

See [ARCHITECTURE.md](./ARCHITECTURE.md) for data flow, protocol details, and trade-offs.

## Project layout

```
collaborative-canvas/
├── client/     # Canvas engine, UI, cursors, socket client
├── server/     # Express + Socket.io + authoritative DrawingState
├── shared/     # Protocol types shared by both sides
├── scripts/    # Build helpers
└── dist/       # Build output
```

## Scripts

| Command | What it does |
|---------|----------------|
| `npm run build` | Compile server (`tsc`) + bundle client (`esbuild`) |
| `npm start` | Run production server from `dist/` |
| `npm run dev` | Build then start |

## Deployment (Render)

This app is a **single Web Service**: Express serves the static client and hosts Socket.io on the same origin (no CORS headaches).

1. Push to GitHub (already at `KavyaUttam/collaborative-canvas`).
2. Create a Render **Web Service** from that repo.
3. Settings:
   - **Build:** `npm install && npm run build`
   - **Start:** `npm start`
   - **Node:** 18+ (or 20)
4. After deploy, open the public URL in two windows and re-run the multi-user checks above.

A `render.yaml` Blueprint is included for one-click setup.

## Known limitations

- Different window sizes can misalign relative stroke positions (CSS-pixel coords on a full-bleed canvas).
- No persistence across server restarts (in-memory room state).
- Single default room only.
- Cursor updates are throttled (~20Hz) by design.
- Free Render instances may cold-start after idle.

## Future improvements

- Room-based collaboration (multiple isolated canvases)
- Stronger mobile / touch polish
- Persistent sessions (DB or Redis-backed stroke log)
- Stroke compression / point batching under heavy load
- Pressure-sensitive drawing (PointerEvent pressure)
- Lightweight authentication / named profiles
- CRDT or OT experimentation for richer conflict models at scale

## Time spent

| Area | Hours |
|------|------:|
| Architecture & planning | 3 |
| Canvas & drawing engine | 5 |
| Socket.io integration | 4 |
| Synchronization & history | 5 |
| Testing & bug fixing | 3 |
| Documentation & deployment | 2 |
| **Total** | **~22** |

## Docs

- [ARCHITECTURE.md](./ARCHITECTURE.md) — data flow, protocol, undo strategy, performance
