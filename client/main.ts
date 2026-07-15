import {
  CanvasController,
  DrawingEngine,
  resizeCanvasToDisplaySize,
} from "./canvas";
import { UIController } from "./ui";
import { SocketClient } from "./websocket";
import type { ServerMessage, Stroke } from "../shared/protocol";
import type { BrushSettings } from "./types";

/**
 * Application entry: wire Canvas ↔ Engine ↔ Socket for live stroke sync.
 */
function main(): void {
  const canvas = document.getElementById("drawing-canvas") as HTMLCanvasElement | null;
  if (!canvas) {
    throw new Error("Missing #drawing-canvas element");
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
  let onlineCount = 0;

  const engine = new DrawingEngine(ctx, "local");

  const ui = new UIController({
    onSettingsChange: (settings) => {
      brushSettings = settings;
    },
    onClear: () => {
      engine.clear();
    },
  });

  const socket = new SocketClient((message) => {
    onlineCount = applyServerMessage(message, ui, engine, onlineCount, (id) => {
      engine.setUserId(id);
    });
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
  });

  function fitCanvas(): void {
    const resized = resizeCanvasToDisplaySize(canvas, ctx);
    if (resized) {
      engine.redraw();
    }
  }

  ui.mount();
  controller.attach();
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

function applyServerMessage(
  message: ServerMessage,
  ui: UIController,
  engine: DrawingEngine,
  onlineCount: number,
  onIdentity: (userId: string) => void
): number {
  switch (message.type) {
    case "room:state":
      ui.setConnectionStatus(true);
      ui.setOnlineUserCount(message.users.length);
      onIdentity(message.yourUserId);
      engine.loadCompleted(message.strokes);
      return message.users.length;

    case "user:joined": {
      const next = onlineCount + 1;
      ui.setOnlineUserCount(next);
      return next;
    }

    case "user:left": {
      const next = Math.max(0, onlineCount - 1);
      ui.setOnlineUserCount(next);
      return next;
    }

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
      return onlineCount;
    }

    case "stroke:point":
      engine.continueRemoteStroke(message.strokeId, message.point);
      return onlineCount;

    case "stroke:end":
      engine.finishRemoteStroke(message.strokeId);
      return onlineCount;

    case "error":
      console.warn("[ws]", message.message);
      return onlineCount;

    default:
      return onlineCount;
  }
}

main();
