# Collaborative Canvas

Real-time multi-user drawing board built with **TypeScript**, **HTML5 Canvas**, **Express**, and **Socket.io** — Flam SSDE take-home assignment.

## Status

| Feature | Status |
|---------|--------|
| Express server | ✅ |
| Socket.io connected | ✅ |
| Local brush / eraser / clear | ✅ |
| Real-time stroke sync | ✅ |
| Cursor indicators | ✅ |
| Online users panel | ✅ |
| Global undo / redo | ✅ |
| Deployed demo | ⏳ final |

## Quick start

```bash
npm install
npm run build
npm start
```

Open [http://localhost:3000](http://localhost:3000).

## How to test

1. Open two browser windows to the same URL.
2. Draw in either — ink streams live in the other.
3. Move the pointer — remote cursors appear with names.
4. Check the **Online** sidebar for stable user colors.
5. Click **Undo** / **Redo** — every client applies the same authoritative history change.
6. **Clear** wipes the shared canvas for everyone.

## Known limitations

- Different window sizes can misalign relative stroke positions (CSS-pixel coords on a full-bleed canvas).
- No persistence across server restarts.
- Single default room only.
- Cursor updates are throttled (~20Hz).

## Time spent

_Track as you go; fill in before submission._

## Docs

See [ARCHITECTURE.md](./ARCHITECTURE.md) for data flow, protocol, undo strategy, and performance decisions.
