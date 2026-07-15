import type { Server, Socket } from "socket.io";
import { DEFAULT_ROOM_ID } from "../shared/protocol";
import type { RoomManager } from "./rooms";

/**
 * Registers Socket.io event handlers.
 * Drawing sync handlers will plug in here next; for now we only handle join/leave.
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

    socket.on("disconnect", () => {
      const left = rooms.removeUser(roomId, socket.id);
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
