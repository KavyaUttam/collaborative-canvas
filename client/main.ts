import {
  CanvasController,
  DrawingEngine,
  resizeCanvasToDisplaySize,
} from "./canvas";
import { UIController } from "./ui";
import { SocketClient } from "./websocket";
import { createId } from "./utils";
import type { ServerMessage } from "../shared/protocol";
import type { BrushSettings } from "./types";

/**
 * Application entry: wire Canvas → Engine, UI → settings, Socket → presence.
 * Drawing remains local until stroke events are synced in a later step.
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

  const localUserId = createId("user");
  let brushSettings: BrushSettings = {
    tool: "brush",
    color: "#1a1a1a",
    width: 4,
  };
  let onlineCount = 0;

  const engine = new DrawingEngine(ctx, localUserId);
  const controller = new CanvasController(canvas, engine, () => brushSettings);

  const ui = new UIController({
    onSettingsChange: (settings) => {
      brushSettings = settings;
    },
    onClear: () => {
      engine.clear();
    },
  });

  const socket = new SocketClient((message) => {
    onlineCount = applyServerMessage(message, ui, onlineCount);
  });

  function fitCanvas(): void {
    const resized = resizeCanvasToDisplaySize(canvas);
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

  // Reflect connection shortly after connect attempt (socket.io is async).
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
  onlineCount: number
): number {
  switch (message.type) {
    case "room:state":
      ui.setConnectionStatus(true);
      ui.setOnlineUserCount(message.users.length);
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
    default:
      return onlineCount;
  }
}

main();
