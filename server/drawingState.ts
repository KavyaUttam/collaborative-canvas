import type { Point, Stroke, Tool } from "../shared/protocol";

function isFinitePoint(point: Point): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

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

  getActiveStrokes(): Stroke[] {
    return Array.from(this.activeStrokes.values()).map((stroke) => ({
      ...stroke,
      points: stroke.points.map((point) => ({ ...point })),
    }));
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
  ): Stroke | null {
    if (!strokeId || this.activeStrokes.has(strokeId)) {
      return null;
    }
    if (!isFinitePoint(point) || width < 1 || width > 64) {
      return null;
    }
    if (tool !== "brush" && tool !== "eraser") {
      return null;
    }

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

  addPoint(strokeId: string, userId: string, point: Point): boolean {
    const stroke = this.activeStrokes.get(strokeId);
    if (!stroke || stroke.userId !== userId || !isFinitePoint(point)) {
      return false;
    }
    stroke.points.push(point);
    return true;
  }

  endStroke(strokeId: string, userId: string): Stroke | null {
    const stroke = this.activeStrokes.get(strokeId);
    if (!stroke || stroke.userId !== userId) {
      return null;
    }
    this.activeStrokes.delete(strokeId);
    this.strokes.push(stroke);
    return stroke;
  }

  /** Commit in-progress strokes when a user disconnects mid-draw. */
  endActiveForUser(userId: string): Stroke[] {
    const ended: Stroke[] = [];
    for (const [strokeId, stroke] of this.activeStrokes) {
      if (stroke.userId !== userId) {
        continue;
      }
      this.activeStrokes.delete(strokeId);
      this.strokes.push(stroke);
      ended.push(stroke);
    }
    return ended;
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
