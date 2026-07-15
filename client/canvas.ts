import type { BrushSettings, Point, Stroke, Tool } from "./types";
import { createId } from "./utils";

export type StrokeSyncHooks = {
  onStrokeStart: (stroke: Stroke) => void;
  onStrokePoint: (strokeId: string, point: Point) => void;
  onStrokeEnd: (strokeId: string) => void;
  onCursorMove?: (point: Point) => void;
};

/**
 * Pure drawing logic over stroke data + a 2D context.
 * No DOM event handling and no networking — only paints and history.
 * Supports one local in-progress stroke plus many concurrent remote strokes.
 */
export class DrawingEngine {
  private completed: Stroke[] = [];
  private active = new Map<string, Stroke>();
  private localActiveId: string | null = null;
  private readonly ctx: CanvasRenderingContext2D;
  private userId: string;

  constructor(ctx: CanvasRenderingContext2D, userId: string) {
    this.ctx = ctx;
    this.userId = userId;
  }

  setUserId(userId: string): void {
    this.userId = userId;
  }

  getUserId(): string {
    return this.userId;
  }

  getLocalActiveId(): string | null {
    return this.localActiveId;
  }

  getCompletedStrokes(): readonly Stroke[] {
    return this.completed;
  }

  /** Replace canvas contents from a server snapshot (late join / reconnect). */
  loadCompleted(strokes: Stroke[]): void {
    this.completed = strokes.map((stroke) => cloneStroke(stroke));
    this.active.clear();
    this.localActiveId = null;
    this.redraw();
  }

  startLocalStroke(point: Point, settings: BrushSettings): Stroke {
    if (this.localActiveId) {
      this.finishStroke(this.localActiveId);
    }

    const stroke: Stroke = {
      id: createId("stroke"),
      userId: this.userId,
      tool: settings.tool,
      color: settings.color,
      width: settings.width,
      points: [point],
    };
    this.localActiveId = stroke.id;
    this.active.set(stroke.id, stroke);
    this.paintSegment(stroke, point, point);
    return stroke;
  }

  continueLocalStroke(point: Point): void {
    if (!this.localActiveId) {
      return;
    }
    this.appendPoint(this.localActiveId, point);
  }

  finishLocalStroke(): Stroke | null {
    if (!this.localActiveId) {
      return null;
    }
    return this.finishStroke(this.localActiveId);
  }

  startRemoteStroke(stroke: Stroke): void {
    if (stroke.userId === this.userId) {
      return;
    }
    if (this.active.has(stroke.id) || this.completed.some((s) => s.id === stroke.id)) {
      return;
    }

    const remote = cloneStroke(stroke);
    this.active.set(remote.id, remote);
    const first = remote.points[0];
    if (first) {
      this.paintSegment(remote, first, first);
    }
  }

  continueRemoteStroke(strokeId: string, point: Point): void {
    const stroke = this.active.get(strokeId);
    if (!stroke || stroke.userId === this.userId) {
      return;
    }
    this.appendPoint(strokeId, point);
  }

  finishRemoteStroke(strokeId: string): void {
    const stroke = this.active.get(strokeId);
    if (!stroke || stroke.userId === this.userId) {
      return;
    }
    this.finishStroke(strokeId);
  }

  clear(): void {
    this.completed = [];
    this.active.clear();
    this.localActiveId = null;
    this.clearCanvas();
  }

  /** Apply authoritative undo: drop completed stroke by id, then replay. */
  removeCompletedStroke(strokeId: string): boolean {
    const index = this.completed.findIndex((stroke) => stroke.id === strokeId);
    if (index === -1) {
      return false;
    }
    this.completed.splice(index, 1);
    this.redraw();
    return true;
  }

  /** Apply authoritative redo: append stroke and paint it. */
  appendCompletedStroke(stroke: Stroke): void {
    if (this.completed.some((existing) => existing.id === stroke.id)) {
      return;
    }
    const cloned = cloneStroke(stroke);
    this.completed.push(cloned);
    this.paintStroke(cloned);
  }

  /** Full redraw from stroke list (used after undo/resize). */
  redraw(): void {
    this.clearCanvas();
    for (const stroke of this.completed) {
      this.paintStroke(stroke);
    }
    for (const stroke of this.active.values()) {
      this.paintStroke(stroke);
    }
  }

  private appendPoint(strokeId: string, point: Point): void {
    const stroke = this.active.get(strokeId);
    if (!stroke) {
      return;
    }
    const prev = stroke.points[stroke.points.length - 1];
    stroke.points.push(point);
    this.paintSegment(stroke, prev, point);
  }

  private finishStroke(strokeId: string): Stroke | null {
    const stroke = this.active.get(strokeId);
    if (!stroke) {
      return null;
    }
    this.active.delete(strokeId);
    if (this.localActiveId === strokeId) {
      this.localActiveId = null;
    }
    this.completed.push(stroke);
    return stroke;
  }

  private clearCanvas(): void {
    const { canvas } = this.ctx;
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.ctx.restore();
  }

  private paintStroke(stroke: Stroke): void {
    const points = stroke.points;
    if (points.length === 0) {
      return;
    }
    if (points.length === 1) {
      this.paintSegment(stroke, points[0], points[0]);
      return;
    }
    for (let i = 1; i < points.length; i += 1) {
      this.paintSegment(stroke, points[i - 1], points[i]);
    }
  }

  private paintSegment(stroke: Stroke, from: Point, to: Point): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = stroke.width;
    ctx.strokeStyle = stroke.color;

    if (stroke.tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
      ctx.globalCompositeOperation = "source-over";
    }

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * Translates pointer events into DrawingEngine calls and optional network hooks.
 */
export class CanvasController {
  private readonly canvas: HTMLCanvasElement;
  private readonly engine: DrawingEngine;
  private readonly getSettings: () => BrushSettings;
  private readonly hooks: StrokeSyncHooks | null;
  private drawing = false;
  private lastCursorSentAt = 0;

  constructor(
    canvas: HTMLCanvasElement,
    engine: DrawingEngine,
    getSettings: () => BrushSettings,
    hooks: StrokeSyncHooks | null = null
  ) {
    this.canvas = canvas;
    this.engine = engine;
    this.getSettings = getSettings;
    this.hooks = hooks;
  }

  attach(): void {
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointercancel", this.onPointerUp);
    this.canvas.addEventListener("pointerleave", this.onPointerLeave);
  }

  detach(): void {
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerUp);
    this.canvas.removeEventListener("pointerleave", this.onPointerLeave);
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) {
      return;
    }
    this.drawing = true;
    this.canvas.setPointerCapture(event.pointerId);
    const point = this.toCanvasPoint(event);
    const stroke = this.engine.startLocalStroke(point, this.getSettings());
    this.hooks?.onStrokeStart(stroke);
    this.emitCursor(point, true);
  };

  private onPointerMove = (event: PointerEvent): void => {
    const point = this.toCanvasPoint(event);
    this.emitCursor(point, false);

    if (!this.drawing) {
      return;
    }
    const strokeId = this.engine.getLocalActiveId();
    if (!strokeId) {
      return;
    }
    this.engine.continueLocalStroke(point);
    this.hooks?.onStrokePoint(strokeId, point);
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (!this.drawing) {
      return;
    }
    this.drawing = false;
    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }
    const strokeId = this.engine.getLocalActiveId();
    this.engine.finishLocalStroke();
    if (strokeId) {
      this.hooks?.onStrokeEnd(strokeId);
    }
  };

  private onPointerLeave = (): void => {
    // Keep last remote cursor; local presence stop is optional for Day 3.
  };

  private emitCursor(point: Point, force: boolean): void {
    const now = performance.now();
    // ~20Hz cap — cursors don't need stroke-level fidelity.
    if (!force && now - this.lastCursorSentAt < 50) {
      return;
    }
    this.lastCursorSentAt = now;
    this.hooks?.onCursorMove?.(point);
  }

  /** CSS-pixel coords so synced strokes match across devicePixelRatio differences. */
  private toCanvasPoint(event: PointerEvent): Point {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }
}

export function resizeCanvasToDisplaySize(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D
): boolean {
  const dpr = window.devicePixelRatio || 1;
  const width = Math.floor(canvas.clientWidth * dpr);
  const height = Math.floor(canvas.clientHeight * dpr);
  if (canvas.width === width && canvas.height === height) {
    return false;
  }
  canvas.width = width;
  canvas.height = height;
  // Keep drawing API in CSS pixels; backing store stays sharp on retina.
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return true;
}

function cloneStroke(stroke: Stroke): Stroke {
  return {
    ...stroke,
    points: stroke.points.map((point) => ({ ...point })),
  };
}

export type { Tool };
