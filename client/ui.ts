import type { BrushSettings, Tool } from "./types";
import type { UserInfo } from "../shared/protocol";
import { clamp } from "./utils";

export interface UICallbacks {
  onSettingsChange: (settings: BrushSettings) => void;
  onClear: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

/**
 * Toolbar / chrome only. Updates brush settings and presence UI; does not draw.
 */
export class UIController {
  private settings: BrushSettings = {
    tool: "brush",
    color: "#1a1a1a",
    width: 4,
  };

  private readonly callbacks: UICallbacks;
  private statusEl: HTMLElement | null = null;
  private userListEl: HTMLElement | null = null;
  private localUserId: string | null = null;
  private users: UserInfo[] = [];

  constructor(callbacks: UICallbacks) {
    this.callbacks = callbacks;
  }

  mount(root: Document = document): void {
    this.statusEl = root.getElementById("connection-status");
    this.userListEl = root.getElementById("user-list");

    const colorInput = root.getElementById("color-picker") as HTMLInputElement | null;
    const widthInput = root.getElementById("brush-width") as HTMLInputElement | null;
    const widthLabel = root.getElementById("brush-width-label");
    const brushBtn = root.getElementById("tool-brush");
    const eraserBtn = root.getElementById("tool-eraser");
    const clearBtn = root.getElementById("tool-clear");
    const undoBtn = root.getElementById("tool-undo");
    const redoBtn = root.getElementById("tool-redo");

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
    undoBtn?.addEventListener("click", () => this.callbacks.onUndo());
    redoBtn?.addEventListener("click", () => this.callbacks.onRedo());

    this.emitSettings();
  }

  getSettings(): BrushSettings {
    return this.settings;
  }

  setLocalUserId(userId: string): void {
    this.localUserId = userId;
    this.renderUsers();
  }

  setConnectionStatus(connected: boolean): void {
    if (!this.statusEl) {
      return;
    }
    this.statusEl.textContent = connected ? "Connected" : "Disconnected";
    this.statusEl.dataset.state = connected ? "online" : "offline";
  }

  setUsers(users: UserInfo[]): void {
    this.users = users;
    this.renderUsers();
  }

  addUser(user: UserInfo): void {
    if (this.users.some((existing) => existing.id === user.id)) {
      return;
    }
    this.users = [...this.users, user];
    this.renderUsers();
  }

  removeUser(userId: string): void {
    this.users = this.users.filter((user) => user.id !== userId);
    this.renderUsers();
  }

  private renderUsers(): void {
    if (!this.userListEl) {
      return;
    }
    this.userListEl.replaceChildren();

    for (const user of this.users) {
      const li = document.createElement("li");
      li.className = "user-chip";
      if (user.id === this.localUserId) {
        li.classList.add("is-you");
      }

      const dot = document.createElement("span");
      dot.className = "user-chip__dot";
      dot.style.background = user.color;

      const name = document.createElement("span");
      name.className = "user-chip__name";
      name.textContent =
        user.id === this.localUserId ? `${user.name} (you)` : user.name;

      li.append(dot, name);
      this.userListEl.appendChild(li);
    }
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
