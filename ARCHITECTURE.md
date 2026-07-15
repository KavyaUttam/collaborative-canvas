# Architecture

Design notes for the Flam collaborative canvas assignment.

## High-level stack

```
Browser (Canvas + DOM)  ←→  Socket.io  ←→  Express / Node
         │                                      │
    DrawingEngine                          DrawingState
    (local stroke list)                    (authoritative)
```

Single process serves both:

- static client assets (`index.html`, CSS, bundled JS)
- Socket.io on the same HTTP server (same origin)

## Data flow

```
Mouse / pointer
        │
        ▼
CanvasController
        │
        ├─► DrawingEngine  (paint locally, keep stroke list)
        │
        └─► Socket.io client  (stroke:start / point / end, cursor:move)
                    │
                    ▼
              Express server
                    │
                    ▼
              DrawingState / RoomManager
                    │
        ┌───────────┴───────────┐
        │                       │
   peers only              whole room
 (live ink/cursors)     (undo/redo/clear)
        │                       │
        ▼                       ▼
 remote DrawingEngine      remove / append / clear
        │                       │
        ▼                       ▼
     Canvas                 Canvas (replay when needed)
```

Cursors never touch the drawing canvas — they render on an HTML overlay so ink and presence stay independent.

## Separation of concerns

| Module | Responsibility |
|--------|----------------|
| `client/canvas.ts` | DrawingEngine + pointer → strokes (no networking) |
| `client/cursors.ts` | Remote cursor HTML overlay |
| `client/websocket.ts` | Connect / send / receive |
| `client/ui.ts` | Toolbar + online user list |
| `client/main.ts` | Composition root |
| `server/drawingState.ts` | Authoritative stroke history + redo stack |
| `server/rooms.ts` | Membership + stable user colors/names |
| `server/socketHandlers.ts` | Validate → mutate → broadcast |
| `shared/protocol.ts` | Single TypeScript message/stroke contract |

## Why vector strokes?

We store strokes, not pixels:

```ts
interface Stroke {
  id: string;
  userId: string;
  tool: "brush" | "eraser";
  color: string;
  width: number;
  points: { x: number; y: number }[];
}
```

| Benefit | Why it matters |
|---------|----------------|
| Bandwidth efficient | Point deltas beat PNG/blob frames |
| Deterministic replay | Same stroke list → same canvas |
| Enables global undo/redo | Pop/push strokes instead of framebuffer snapshots |
| Handles resize | Redraw vectors after DPR/layout changes |
| No image serialization | Avoids expensive encode/decode on the hot path |

## Why doesn't the server render?

The server’s job is **synchronization and authoritative history**. Rendering stays on clients so the Node process stays lightweight and scales with rooms/users rather than GPU/work per peer.

## WebSocket protocol

Discriminated `type` unions in `shared/protocol.ts`.

| Direction | Types |
|-----------|--------|
| Client → Server | `stroke:start/point/end`, `cursor:move`, `history:undo/redo`, `canvas:clear` |
| Server → Client | `room:state`, `stroke:*`, `cursor:move`, `history:undone/redone`, `canvas:cleared`, `user:*`, `error` |

### Broadcast rules

- **Live ink / cursors:** `socket.to(room)` (peers only). Sender already painted/applied locally.
- **History mutate (undo/redo/clear):** update `DrawingState` first, then `io.to(room)` to **everyone**. All clients converge on the same history.

### Live ink stream

```
mousedown → stroke:start
mousemove → stroke:point   (one point per message)
mouseup   → stroke:end
```

Peers see ink while it is drawn — not after the stroke finishes.

## Why server-authoritative undo?

```
Client requests undo
        ↓
Server pops history → pushes redo stack
        ↓
Broadcast history:undone { strokeId }
        ↓
Every client removes that stroke and redraws
```

If each client undid optimistically, concurrent undos would diverge. Serializing mutations on the server keeps a single source of truth.

Redo mirrors the inverse path (`history:redone` carries the full stroke). A new stroke clears the redo stack (standard editor semantics).

## Conflict resolution

- Simultaneous drawing is **append-only** — no locking per region.
- Visual overlaps use painter’s order (earlier strokes underneath).
- Eraser strokes are normal vector entries with `destination-out` compositing.
- Concurrent undos/redos are ordered by the Node event loop on one `DrawingState`.

## Performance decisions

| Choice | Rationale |
|--------|-----------|
| Incremental `lineTo` while drawing | Avoids O(n) full replay on every mousemove |
| Full replay only for history / resize / late join | Expensive work stays rare |
| Cursor throttle (~20Hz) | Presence does not need stroke-level fidelity |
| CSS pixels + `devicePixelRatio` transform | Sharp retina drawing without breaking sync |
| Shared `protocol.ts` | Prevents client/server schema drift |
| Separate cursor overlay | Drawing canvas stays pure ink |
| esbuild client bundle | Fast vanilla TS build, no React/Vue |

## Scaling notes (interview talking point)

For ~thousands of concurrent users: shard by room, keep cursors throttled, batch `stroke:point` on a short window, consider binary encoding (MessagePack) for point arrays, and keep one authoritative state service per room rather than client-predicting other users’ ink.
