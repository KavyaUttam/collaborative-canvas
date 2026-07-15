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

## Local drawing flow (implemented)

```
pointerdown → DrawingEngine.startStroke
pointermove → DrawingEngine.continueStroke  (incremental line segments)
pointerup   → DrawingEngine.finishStroke    (append to stroke list)
```

Incremental painting avoids full-canvas redraws on every mouse move. Full `redraw()` runs on resize (and later after undo).

## WebSocket protocol (skeleton)

Messages use a discriminated `type` field. Current live events:

| Direction | Types in use today |
|-----------|--------------------|
| Server → Client | `room:state`, `user:joined`, `user:left` |
| Client → Server | _(stroke sync not yet)_ |

Planned stroke stream (point-by-point for live ink):

- `stroke:start` / `stroke:point` / `stroke:end`
- `cursor:move`
- `history:undo` / `history:redo`
- `canvas:clear`

See `shared/protocol.ts` for the full TypeScript union.

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
