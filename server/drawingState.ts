import type { Point, Stroke, Tool } from "../shared/protocol";

/**
 * Authoritative canvas state for a single room.
 * Stores strokes (vector data), not pixels — enables sync and global undo later.
 */
export class DrawingState {
  private strokes: Stroke[] = [];
  private activeStrokes = new Map<string, Stroke>();
  private redoStack: Stroke[] = [];

  getStrokes(): Stroke[] {
    return [...this.strokes];
  }

  getRedoStack(): Stroke[] {
    return [...this.redoStack];
  }

  startStroke(
    strokeId: string,
    userId: string,
    tool: Tool,
    color: string,
    width: number,
    point: Point
  ): Stroke {
    const stroke: Stroke = {
      id: strokeId,
      userId,
      tool,
      color,
      width,
      points: [point],
    };
    this.activeStrokes.set(strokeId, stroke);
    // New stroke invalidates redo history (standard undo semantics).
    this.redoStack = [];
    return stroke;
  }

  addPoint(strokeId: string, point: Point): boolean {
    const stroke = this.activeStrokes.get(strokeId);
    if (!stroke) {
      return false;
    }
    stroke.points.push(point);
    return true;
  }

  endStroke(strokeId: string): Stroke | null {
    const stroke = this.activeStrokes.get(strokeId);
    if (!stroke) {
      return null;
    }
    this.activeStrokes.delete(strokeId);
    this.strokes.push(stroke);
    return stroke;
  }

  clear(): void {
    this.strokes = [];
    this.activeStrokes.clear();
    this.redoStack = [];
  }

  /**
   * Global undo removes the most recent completed stroke (any user).
   * Returns the removed stroke, or null if nothing to undo.
   */
  undo(): Stroke | null {
    const stroke = this.strokes.pop();
    if (!stroke) {
      return null;
    }
    this.redoStack.push(stroke);
    return stroke;
  }

  redo(): Stroke | null {
    const stroke = this.redoStack.pop();
    if (!stroke) {
      return null;
    }
    this.strokes.push(stroke);
    return stroke;
  }
}
