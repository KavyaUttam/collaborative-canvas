import type { BrushSettings, Tool } from "./types";
import { clamp } from "./utils";

export interface UICallbacks {
  onSettingsChange: (settings: BrushSettings) => void;
  onClear: () => void;
}

/**
 * Toolbar / chrome only. Updates brush settings; does not draw.
 */
export class UIController {
  private settings: BrushSettings = {
    tool: "brush",
    color: "#1a1a1a",
    width: 4,
  };

  private readonly callbacks: UICallbacks;
  private statusEl: HTMLElement | null = null;
  private userCountEl: HTMLElement | null = null;

  constructor(callbacks: UICallbacks) {
    this.callbacks = callbacks;
  }

  mount(root: Document = document): void {
    this.statusEl = root.getElementById("connection-status");
    this.userCountEl = root.getElementById("user-count");

    const colorInput = root.getElementById("color-picker") as HTMLInputElement | null;
    const widthInput = root.getElementById("brush-width") as HTMLInputElement | null;
    const widthLabel = root.getElementById("brush-width-label");
    const brushBtn = root.getElementById("tool-brush");
    const eraserBtn = root.getElementById("tool-eraser");
    const clearBtn = root.getElementById("tool-clear");

    colorInput?.addEventListener("input", () => {
      if (!colorInput.value) {
        return;
      }
      this.settings = { ...this.settings, color: colorInput.value };
      this.emitSettings();
    });

    widthInput?.addEventListener("input", () => {
      const width = clamp(Number(widthInput.value) || 1, 1, 40);
      this.settings = { ...this.settings, width };
      if (widthLabel) {
        widthLabel.textContent = `${width}px`;
      }
      this.emitSettings();
    });

    brushBtn?.addEventListener("click", () => this.setTool("brush", brushBtn, eraserBtn));
    eraserBtn?.addEventListener("click", () => this.setTool("eraser", brushBtn, eraserBtn));
    clearBtn?.addEventListener("click", () => this.callbacks.onClear());

    this.emitSettings();
  }

  getSettings(): BrushSettings {
    return this.settings;
  }

  setConnectionStatus(connected: boolean): void {
    if (!this.statusEl) {
      return;
    }
    this.statusEl.textContent = connected ? "Connected" : "Disconnected";
    this.statusEl.dataset.state = connected ? "online" : "offline";
  }

  setOnlineUserCount(count: number): void {
    if (!this.userCountEl) {
      return;
    }
    this.userCountEl.textContent = String(count);
  }

  private setTool(
    tool: Tool,
    brushBtn: HTMLElement | null,
    eraserBtn: HTMLElement | null
  ): void {
    this.settings = { ...this.settings, tool };
    brushBtn?.classList.toggle("is-active", tool === "brush");
    eraserBtn?.classList.toggle("is-active", tool === "eraser");
    this.emitSettings();
  }

  private emitSettings(): void {
    this.callbacks.onSettingsChange(this.settings);
  }
}
