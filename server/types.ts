import type { Stroke, UserInfo } from "../shared/protocol";

export interface RoomUser extends UserInfo {
  socketId: string;
}

export interface Room {
  id: string;
  strokes: Stroke[];
  users: Map<string, RoomUser>;
  /** Stack of stroke IDs removed by undo (for redo). */
  redoStack: Stroke[];
}
