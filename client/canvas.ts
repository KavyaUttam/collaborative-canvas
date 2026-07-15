import type { BrushSettings, Point, Stroke, Tool } from "./types";
import { createId } from "./utils";

/**
 * Pure drawing logic over stroke data + a 2D context.
 * No DOM event handling and no networking — only paints and history.
 */
export class DrawingEngine {
  private strokes: Stroke[] = [];
  private currentStroke: Stroke | null = null;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly userId: string;

  constructor(ctx: CanvasRenderingContext2D, userId: string) {
    this.ctx = ctx;
    this.userId = userId;
  }

  getStrokes(): readonly Stroke[] {
    return this.strokes;
  }

  startStroke(point: Point, settings: BrushSettings): Stroke {
    const stroke: Stroke = {
      id: createId("stroke"),
      userId: this.userId,
      tool: settings.tool,
      color: settings.color,
      width: settings.width,
      points: [point],
    };
    this.currentStroke = stroke;
    this.paintSegment(stroke, point, point);
    return stroke;
  }

  continueStroke(point: Point): void {
    const stroke = this.currentStroke;
    if (!stroke) {
      return;
    }
    const prev = stroke.points[stroke.points.length - 1];
    stroke.points.push(point);
    this.paintSegment(stroke, prev, point);
  }

  finishStroke(): Stroke | null {
    const stroke = this.currentStroke;
    if (!stroke) {
      return null;
    }
    this.currentStroke = null;
    this.strokes.push(stroke);
    return stroke;
  }

  clear(): void {
    this.strokes = [];
    this.currentStroke = null;
    this.clearCanvas();
  }

  /** Full redraw from stroke list (used after undo/resize). */
  redraw(): void {
    this.clearCanvas();
    for (const stroke of this.strokes) {
      this.paintStroke(stroke);
    }
    if (this.currentStroke) {
      this.paintStroke(this.currentStroke);
    }
  }

  private clearCanvas(): void {
    const { canvas } = this.ctx;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
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
 * Translates pointer events into DrawingEngine calls.
 * Isolated so networking can later mirror the same engine API remotely.
 */
export class CanvasController {
  private readonly canvas: HTMLCanvasElement;
  private readonly engine: DrawingEngine;
  private readonly getSettings: () => BrushSettings;
  private drawing = false;

  constructor(
    canvas: HTMLCanvasElement,
    engine: DrawingEngine,
    getSettings: () => BrushSettings
  ) {
    this.canvas = canvas;
    this.engine = engine;
    this.getSettings = getSettings;
  }

  attach(): void {
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointercancel", this.onPointerUp);
    this.canvas.addEventListener("pointerleave", this.onPointerUp);
  }

  detach(): void {
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerUp);
    this.canvas.removeEventListener("pointerleave", this.onPointerUp);
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) {
      return;
    }
    this.drawing = true;
    this.canvas.setPointerCapture(event.pointerId);
    this.engine.startStroke(this.toCanvasPoint(event), this.getSettings());
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.drawing) {
      return;
    }
    this.engine.continueStroke(this.toCanvasPoint(event));
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (!this.drawing) {
      return;
    }
    this.drawing = false;
    if (this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }
    this.engine.finishStroke();
  };

  private toCanvasPoint(event: PointerEvent): Point {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }
}

export function resizeCanvasToDisplaySize(canvas: HTMLCanvasElement): boolean {
  const dpr = window.devicePixelRatio || 1;
  const width = Math.floor(canvas.clientWidth * dpr);
  const height = Math.floor(canvas.clientHeight * dpr);
  if (canvas.width === width && canvas.height === height) {
    return false;
  }
  canvas.width = width;
  canvas.height = height;
  return true;
}

export type { Tool };
