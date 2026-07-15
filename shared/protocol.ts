/**
 * Shared WebSocket protocol between client and server.
 * Both sides import from here so message shapes never drift.
 */

export interface Point {
  x: number;
  y: number;
}

export type Tool = "brush" | "eraser";

export interface Stroke {
  id: string;
  userId: string;
  tool: Tool;
  color: string;
  width: number;
  points: Point[];
}

export interface UserInfo {
  id: string;
  name: string;
  color: string;
}

/** Client → Server */
export type ClientMessage =
  | { type: "stroke:start"; strokeId: string; tool: Tool; color: string; width: number; point: Point }
  | { type: "stroke:point"; strokeId: string; point: Point }
  | { type: "stroke:end"; strokeId: string }
  | { type: "cursor:move"; point: Point }
  | { type: "canvas:clear" }
  | { type: "history:undo" }
  | { type: "history:redo" };

/** Server → Client */
export type ServerMessage =
  | { type: "room:state"; strokes: Stroke[]; users: UserInfo[]; yourUserId: string }
  | { type: "stroke:start"; userId: string; strokeId: string; tool: Tool; color: string; width: number; point: Point }
  | { type: "stroke:point"; userId: string; strokeId: string; point: Point }
  | { type: "stroke:end"; userId: string; strokeId: string }
  | { type: "cursor:move"; userId: string; point: Point }
  | { type: "canvas:cleared"; userId: string }
  | { type: "history:undone"; userId: string; strokeId: string }
  | { type: "history:redone"; userId: string; stroke: Stroke }
  | { type: "user:joined"; user: UserInfo }
  | { type: "user:left"; userId: string }
  | { type: "error"; message: string };

export const DEFAULT_ROOM_ID = "main";
