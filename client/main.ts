import {
  CanvasController,
  DrawingEngine,
  resizeCanvasToDisplaySize,
} from "./canvas";
import { CursorOverlay } from "./cursors";
import { UIController } from "./ui";
import { SocketClient } from "./websocket";
import type { ServerMessage, Stroke } from "../shared/protocol";
import type { BrushSettings } from "./types";

/**
 * Application entry: wire Canvas ↔ Engine ↔ Socket for live sync,
 * presence, cursors, and server-authoritative undo/redo.
 */
function main(): void {
  const canvas = document.getElementById("drawing-canvas") as HTMLCanvasElement | null;
  const overlayRoot = document.getElementById("cursor-overlay");
  if (!canvas || !overlayRoot) {
    throw new Error("Missing #drawing-canvas or #cursor-overlay");
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2D canvas context unavailable");
  }

  let brushSettings: BrushSettings = {
    tool: "brush",
    color: "#1a1a1a",
    width: 4,
  };

  const engine = new DrawingEngine(ctx, "local");
  const cursors = new CursorOverlay(overlayRoot);

  let socket!: SocketClient;

  const ui = new UIController({
    onSettingsChange: (settings) => {
      brushSettings = settings;
    },
    onClear: () => {
      socket.send({ type: "canvas:clear" });
    },
    onUndo: () => {
      socket.send({ type: "history:undo" });
    },
    onRedo: () => {
      socket.send({ type: "history:redo" });
    },
  });

  socket = new SocketClient((message) => {
    applyServerMessage(message, { ui, engine, cursors });
  });

  const controller = new CanvasController(canvas, engine, () => brushSettings, {
    onStrokeStart: (stroke) => {
      socket.send({
        type: "stroke:start",
        strokeId: stroke.id,
        tool: stroke.tool,
        color: stroke.color,
        width: stroke.width,
        point: stroke.points[0],
      });
    },
    onStrokePoint: (strokeId, point) => {
      socket.send({
        type: "stroke:point",
        strokeId,
        point,
      });
    },
    onStrokeEnd: (strokeId) => {
      socket.send({
        type: "stroke:end",
        strokeId,
      });
    },
    onCursorMove: (point) => {
      socket.send({
        type: "cursor:move",
        point,
      });
    },
  });

  function fitCanvas(): void {
    const resized = resizeCanvasToDisplaySize(canvas, ctx);
    if (resized) {
      engine.redraw();
    }
  }

  ui.mount();
  controller.attach();
  cursors.start();
  fitCanvas();
  window.addEventListener("resize", fitCanvas);

  socket.connect();
  ui.setConnectionStatus(false);

  const poll = window.setInterval(() => {
    const connected = socket.isConnected();
    ui.setConnectionStatus(connected);
    if (connected) {
      window.clearInterval(poll);
    }
  }, 200);
}

type AppParts = {
  ui: UIController;
  engine: DrawingEngine;
  cursors: CursorOverlay;
};

function applyServerMessage(message: ServerMessage, app: AppParts): void {
  const { ui, engine, cursors } = app;

  switch (message.type) {
    case "room:state":
      ui.setConnectionStatus(true);
      ui.setLocalUserId(message.yourUserId);
      ui.setUsers(message.users);
      cursors.setLocalUserId(message.yourUserId);
      cursors.setUsers(message.users);
      engine.setUserId(message.yourUserId);
      engine.loadCompleted(message.strokes);
      break;

    case "user:joined":
      ui.addUser(message.user);
      cursors.addUser(message.user);
      break;

    case "user:left":
      ui.removeUser(message.userId);
      cursors.removeUser(message.userId);
      break;

    case "stroke:start": {
      const stroke: Stroke = {
        id: message.strokeId,
        userId: message.userId,
        tool: message.tool,
        color: message.color,
        width: message.width,
        points: [message.point],
      };
      engine.startRemoteStroke(stroke);
      break;
    }

    case "stroke:point":
      engine.continueRemoteStroke(message.strokeId, message.point);
      break;

    case "stroke:end":
      engine.finishRemoteStroke(message.strokeId);
      break;

    case "cursor:move":
      cursors.updateCursor(message.userId, message.point);
      break;

    case "history:undone":
      engine.removeCompletedStroke(message.strokeId);
      break;

    case "history:redone":
      engine.appendCompletedStroke(message.stroke);
      break;

    case "canvas:cleared":
      engine.clear();
      break;

    case "error":
      console.warn("[ws]", message.message);
      break;

    default:
      break;
  }
}

main();
