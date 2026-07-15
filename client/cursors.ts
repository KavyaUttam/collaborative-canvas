import type { Point, UserInfo } from "../shared/protocol";

const CURSOR_STALE_MS = 4000;

/**
 * Remote cursor indicators as HTML over the stage — never painted on the drawing canvas.
 */
export class CursorOverlay {
  private readonly root: HTMLElement;
  private readonly cursors = new Map<string, HTMLElement>();
  private readonly lastSeen = new Map<string, number>();
  private users = new Map<string, UserInfo>();
  private localUserId: string | null = null;
  private pruneTimer: number | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  start(): void {
    if (this.pruneTimer !== null) {
      return;
    }
    this.pruneTimer = window.setInterval(() => this.pruneStale(), 1000);
  }

  stop(): void {
    if (this.pruneTimer !== null) {
      window.clearInterval(this.pruneTimer);
      this.pruneTimer = null;
    }
  }

  setLocalUserId(userId: string): void {
    this.localUserId = userId;
    this.removeCursor(userId);
  }

  setUsers(users: UserInfo[]): void {
    this.users = new Map(users.map((user) => [user.id, user]));
    for (const userId of this.cursors.keys()) {
      if (!this.users.has(userId)) {
        this.removeCursor(userId);
      }
    }
  }

  addUser(user: UserInfo): void {
    this.users.set(user.id, user);
  }

  removeUser(userId: string): void {
    this.users.delete(userId);
    this.removeCursor(userId);
  }

  updateCursor(userId: string, point: Point): void {
    if (userId === this.localUserId) {
      return;
    }

    const user = this.users.get(userId);
    let el = this.cursors.get(userId);
    if (!el) {
      el = document.createElement("div");
      el.className = "remote-cursor";
      el.innerHTML = `
        <span class="remote-cursor__pointer" aria-hidden="true"></span>
        <span class="remote-cursor__label"></span>
      `;
      this.root.appendChild(el);
      this.cursors.set(userId, el);
    }

    const label = el.querySelector(".remote-cursor__label");
    if (label) {
      label.textContent = user?.name ?? "User";
    }
    el.style.setProperty("--cursor-color", user?.color ?? "#457B9D");
    el.style.transform = `translate(${point.x}px, ${point.y}px)`;
    this.lastSeen.set(userId, Date.now());
  }

  private removeCursor(userId: string): void {
    const el = this.cursors.get(userId);
    if (el) {
      el.remove();
      this.cursors.delete(userId);
    }
    this.lastSeen.delete(userId);
  }

  private pruneStale(): void {
    const now = Date.now();
    for (const [userId, seen] of this.lastSeen) {
      if (now - seen > CURSOR_STALE_MS) {
        this.removeCursor(userId);
      }
    }
  }
}
