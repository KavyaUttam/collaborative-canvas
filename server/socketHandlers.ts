import type { Server, Socket } from "socket.io";
import {
  DEFAULT_ROOM_ID,
  type ClientMessage,
  type Point,
  type Tool,
} from "../shared/protocol";
import type { RoomManager } from "./rooms";

/**
 * Registers Socket.io event handlers.
 * Server does not draw — it validates, stores, and broadcasts.
 * Undo/redo/clear mutate authoritative history first, then notify the whole room.
 */
export function registerSocketHandlers(io: Server, rooms: RoomManager): void {
  io.on("connection", (socket: Socket) => {
    const roomId = DEFAULT_ROOM_ID;
    const user = rooms.addUser(roomId, socket.id);
    const { drawing } = rooms.getOrCreate(roomId);

    socket.join(roomId);

    socket.emit("message", {
      type: "room:state",
      strokes: drawing.getStrokes(),
      users: rooms.listUsers(roomId),
      yourUserId: user.id,
    });

    socket.to(roomId).emit("message", {
      type: "user:joined",
      user: { id: user.id, name: user.name, color: user.color },
    });

    console.log(`[socket] ${user.name} connected (${socket.id})`);

    socket.on("message", (payload: unknown) => {
      if (!isClientMessage(payload)) {
        socket.emit("message", { type: "error", message: "Invalid message shape" });
        return;
      }
      handleClientMessage(io, socket, roomId, user.id, rooms, payload);
    });

    socket.on("disconnect", () => {
      const left = rooms.removeUser(roomId, socket.id);
      const state = rooms.getDrawing(roomId);
      if (state) {
        const ended = state.endActiveForUser(socket.id);
        for (const stroke of ended) {
          socket.to(roomId).emit("message", {
            type: "stroke:end",
            userId: stroke.userId,
            strokeId: stroke.id,
          });
        }
      }
      if (left) {
        socket.to(roomId).emit("message", {
          type: "user:left",
          userId: left.id,
        });
        console.log(`[socket] ${left.name} disconnected (${socket.id})`);
      }
    });
  });
}

function handleClientMessage(
  io: Server,
  socket: Socket,
  roomId: string,
  userId: string,
  rooms: RoomManager,
  message: ClientMessage
): void {
  const drawing = rooms.getDrawing(roomId);
  if (!drawing) {
    return;
  }

  switch (message.type) {
    case "stroke:start": {
      const stroke = drawing.startStroke(
        message.strokeId,
        userId,
        message.tool,
        message.color,
        message.width,
        message.point
      );
      if (!stroke) {
        socket.emit("message", { type: "error", message: "Rejected stroke:start" });
        return;
      }
      socket.to(roomId).emit("message", {
        type: "stroke:start",
        userId,
        strokeId: stroke.id,
        tool: stroke.tool,
        color: stroke.color,
        width: stroke.width,
        point: stroke.points[0],
      });
      break;
    }
    case "stroke:point": {
      const ok = drawing.addPoint(message.strokeId, userId, message.point);
      if (!ok) {
        return;
      }
      socket.to(roomId).emit("message", {
        type: "stroke:point",
        userId,
        strokeId: message.strokeId,
        point: message.point,
      });
      break;
    }
    case "stroke:end": {
      const stroke = drawing.endStroke(message.strokeId, userId);
      if (!stroke) {
        return;
      }
      socket.to(roomId).emit("message", {
        type: "stroke:end",
        userId,
        strokeId: stroke.id,
      });
      break;
    }
    case "cursor:move": {
      if (!isFinitePoint(message.point)) {
        return;
      }
      socket.to(roomId).emit("message", {
        type: "cursor:move",
        userId,
        point: message.point,
      });
      break;
    }
    case "history:undo": {
      const stroke = drawing.undo();
      if (!stroke) {
        return;
      }
      // Whole room (including requester) applies the same authoritative result.
      io.to(roomId).emit("message", {
        type: "history:undone",
        userId,
        strokeId: stroke.id,
      });
      break;
    }
    case "history:redo": {
      const stroke = drawing.redo();
      if (!stroke) {
        return;
      }
      io.to(roomId).emit("message", {
        type: "history:redone",
        userId,
        stroke,
      });
      break;
    }
    case "canvas:clear": {
      drawing.clear();
      io.to(roomId).emit("message", {
        type: "canvas:cleared",
        userId,
      });
      break;
    }
    default:
      break;
  }
}

function isFinitePoint(point: Point): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function isClientMessage(value: unknown): value is ClientMessage {
  if (typeof value !== "object" || value === null || !("type" in value)) {
    return false;
  }
  const msg = value as { type: unknown };
  if (typeof msg.type !== "string") {
    return false;
  }

  switch (msg.type) {
    case "stroke:start":
      return (
        hasString(value, "strokeId") &&
        hasTool(value, "tool") &&
        hasString(value, "color") &&
        hasNumber(value, "width") &&
        hasPoint(value, "point")
      );
    case "stroke:point":
      return hasString(value, "strokeId") && hasPoint(value, "point");
    case "stroke:end":
      return hasString(value, "strokeId");
    case "cursor:move":
      return hasPoint(value, "point");
    case "canvas:clear":
    case "history:undo":
    case "history:redo":
      return true;
    default:
      return false;
  }
}

function hasString(value: object, key: string): boolean {
  return key in value && typeof (value as Record<string, unknown>)[key] === "string";
}

function hasNumber(value: object, key: string): boolean {
  return key in value && typeof (value as Record<string, unknown>)[key] === "number";
}

function hasTool(value: object, key: string): value is { tool: Tool } {
  const tool = (value as Record<string, unknown>)[key];
  return tool === "brush" || tool === "eraser";
}

function hasPoint(value: object, key: string): value is { [k: string]: Point } {
  const point = (value as Record<string, unknown>)[key];
  return (
    typeof point === "object" &&
    point !== null &&
    typeof (point as Point).x === "number" &&
    typeof (point as Point).y === "number"
  );
}
