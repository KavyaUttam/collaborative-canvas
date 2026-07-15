import { DrawingState } from "./drawingState";
import type { Room, RoomUser } from "./types";
import type { UserInfo } from "../shared/protocol";

const USER_COLORS = [
  "#E63946",
  "#2A9D8F",
  "#E9C46A",
  "#457B9D",
  "#F4A261",
  "#6D597A",
  "#264653",
  "#D62828",
];

/**
 * Manages isolated drawing rooms. Today we use a single default room;
 * the map structure is ready for multi-room bonus later.
 */
export class RoomManager {
  private rooms = new Map<string, Room>();
  private drawingByRoom = new Map<string, DrawingState>();
  private colorIndex = 0;
  private userNumber = 1;

  getOrCreate(roomId: string): { room: Room; drawing: DrawingState } {
    let room = this.rooms.get(roomId);
    let drawing = this.drawingByRoom.get(roomId);

    if (!room || !drawing) {
      room = {
        id: roomId,
        strokes: [],
        users: new Map(),
        redoStack: [],
      };
      drawing = new DrawingState();
      this.rooms.set(roomId, room);
      this.drawingByRoom.set(roomId, drawing);
    }

    return { room, drawing };
  }

  addUser(roomId: string, socketId: string, preferredName?: string): RoomUser {
    const { room } = this.getOrCreate(roomId);
    const color = USER_COLORS[this.colorIndex % USER_COLORS.length];
    this.colorIndex += 1;

    const user: RoomUser = {
      id: socketId,
      socketId,
      name: preferredName ?? `User ${this.userNumber}`,
      color,
    };
    this.userNumber += 1;
    room.users.set(socketId, user);
    return user;
  }

  removeUser(roomId: string, socketId: string): UserInfo | null {
    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }
    const user = room.users.get(socketId);
    if (!user) {
      return null;
    }
    room.users.delete(socketId);
    return { id: user.id, name: user.name, color: user.color };
  }

  listUsers(roomId: string): UserInfo[] {
    const room = this.rooms.get(roomId);
    if (!room) {
      return [];
    }
    return Array.from(room.users.values()).map(({ id, name, color }) => ({
      id,
      name,
      color,
    }));
  }

  getDrawing(roomId: string): DrawingState | null {
    return this.drawingByRoom.get(roomId) ?? null;
  }
}
