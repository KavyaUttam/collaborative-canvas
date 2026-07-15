# Architecture

Living document for the Flam collaborative canvas assignment. Updated as features land.

## High-level stack

```
Browser (Canvas + DOM)  ←→  Socket.io  ←→  Express / Node
         │                                      │
    DrawingEngine                          DrawingState
    (stroke list)                          (authoritative)
```

## Separation of concerns

| Module | Responsibility |
|--------|----------------|
| `client/canvas.ts` | Local drawing only (`DrawingEngine` + pointer → strokes) |
| `client/websocket.ts` | Connect / send / receive messages |
| `client/ui.ts` | Toolbar controls |
| `client/main.ts` | Composition root |
| `server/drawingState.ts` | Authoritative stroke list + undo stacks |
| `server/rooms.ts` | Room membership + user colors |
| `server/socketHandlers.ts` | Socket event wiring |
| `shared/protocol.ts` | Message + stroke shapes (single source of truth) |

## Data model

We store **strokes**, not pixels:

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

Why: redraw, sync, and global undo/redo become operations on a list instead of framebuffer snapshots.

## Local + remote drawing flow (implemented)

```
pointerdown → DrawingEngine.startLocalStroke → emit stroke:start
pointermove → DrawingEngine.continueLocalStroke → emit stroke:point
             (+ throttled cursor:move)
pointerup   → DrawingEngine.finishLocalStroke → emit stroke:end

peers:
  stroke:*     → DrawingEngine remote path (incremental paint)
  cursor:move  → HTML overlay indicators (never on drawing canvas)
  history:*    → remove/append stroke then redraw / paint
```

Incremental painting avoids full-canvas redraws on every mouse move / inbound point. Full `redraw()` runs on resize, undo, and after loading `room:state`.

Coordinates are **CSS pixels**; the canvas backing store uses `devicePixelRatio` via `ctx.setTransform`, so retina screens stay sharp without breaking cross-device sync.

## WebSocket protocol (live)

Messages use a discriminated `type` field.

| Direction | Types |
|-----------|--------|
| Client → Server | `stroke:start/point/end`, `cursor:move`, `history:undo/redo`, `canvas:clear` |
| Server → Client | `room:state`, `stroke:*`, `cursor:move`, `history:undone/redone`, `canvas:cleared`, `user:*`, `error` |

Broadcast rules:

- **Live ink / cursors:** peers only (`socket.to(room)`) — sender already applied locally.
- **History mutate (undo/redo/clear):** entire room (`io.to(room)`) **after** the server updates authoritative state — every client converges on the same history.

Server pipeline:

```
Receive → Validate → Mutate DrawingState (if needed) → Broadcast
```

## Undo / redo strategy (implemented)

- Two stacks on the server: completed stroke history + redo stack.
- **Undo:** pop last completed stroke (any user) → push redo → broadcast `history:undone { strokeId }`.
- **Redo:** pop redo → push history → broadcast `history:redone { stroke }`.
- A new stroke clears the redo stack (standard editor semantics).
- Clients never invent undo optimistically — they wait for the server event, then remove/replay strokes (vector redraw, not bitmap snapshots).

## Conflict resolution

Simultaneous drawing is append-only; visual overlaps use painter’s order. Concurrent undos are serialized by the Node event loop on the authoritative `DrawingState`, so clients never disagree about which stroke left the history.

## Performance decisions

| Choice | Rationale |
|--------|-----------|
| Stroke vectors, not image blobs | Smaller sync payloads; enables undo |
| Incremental `lineTo` while drawing | Smooth ink without full redraw each move |
| Pointer Events API | One path for mouse + touch (bonus mobile) |
| Shared `protocol.ts` | Prevents client/server schema drift |
| esbuild for client bundle | Fast build, no React/framework |

## Scaling notes (interview talking point)

For ~thousands of users: shard by room, throttle `cursor:move`, batch `stroke:point` on a short rAF/interval window, consider binary encoding (MessagePack) for point arrays, and keep one authoritative state service per room rather than client prediction of other users’ ink.
