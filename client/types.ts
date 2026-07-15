export type { Point, Stroke, Tool, UserInfo } from "../shared/protocol";

export interface BrushSettings {
  tool: "brush" | "eraser";
  color: string;
  width: number;
}
