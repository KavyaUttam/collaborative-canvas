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
pointerup   → DrawingEngine.finishLocalStroke → emit stroke:end

peers:
  stroke:start → DrawingEngine.startRemoteStroke   (incremental paint)
  stroke:point → DrawingEngine.continueRemoteStroke
  stroke:end   → DrawingEngine.finishRemoteStroke  (move into completed list)
```

Incremental painting avoids full-canvas redraws on every mouse move / inbound point. Full `redraw()` runs on resize and after loading `room:state`.

Coordinates are **CSS pixels**; the canvas backing store uses `devicePixelRatio` via `ctx.setTransform`, so retina screens stay sharp without breaking cross-device sync.

## WebSocket protocol (live)

Messages use a discriminated `type` field.

| Direction | Types in use |
|-----------|----------------|
| Client → Server | `stroke:start`, `stroke:point`, `stroke:end` |
| Server → Client | `room:state`, `stroke:*`, `user:joined`, `user:left`, `error` |

Broadcast rule: peers only (`socket.to(room)`), never echo back to the sender (they already painted locally).

Server pipeline:

```
Receive → Validate (shape, ownership, finite points) → Persist active/completed → Broadcast
```

Planned next:

- `cursor:move`
- `history:undo` / `history:redo`
- `canvas:clear`

## Undo / redo strategy (planned)

- **Server-authoritative** operation log on the completed-stroke list.
- Undo pops the latest stroke (any user), broadcasts `history:undone`, clients remove that stroke and redraw.
- Redo pushes from a redo stack; a new stroke clears redo (standard editor semantics).
- Conflict rule: last completed operation wins; simultaneous undos are serialized by the server.

## Conflict resolution (planned)

Simultaneous drawing in overlapping areas does not conflict at the data layer: strokes are append-only. Visual overlaps are expected painter’s-algorithm order (earlier strokes underneath). Eraser strokes are separate entries with `destination-out` composite.

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
