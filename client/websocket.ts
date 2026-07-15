import type { ServerMessage } from "../shared/protocol";
import { io, type Socket } from "socket.io-client";

export type MessageHandler = (message: ServerMessage) => void;

/**
 * Networking boundary. Knows nothing about canvas drawing.
 * Today: connect + receive room state / presence.
 * Next: emit stroke events for real-time sync.
 */
export class SocketClient {
  private socket: Socket | null = null;
  private readonly onMessage: MessageHandler;

  constructor(onMessage: MessageHandler) {
    this.onMessage = onMessage;
  }

  connect(url?: string): void {
    if (this.socket?.connected) {
      return;
    }

    this.socket = io(url ?? window.location.origin, {
      transports: ["websocket", "polling"],
      autoConnect: true,
    });

    this.socket.on("connect", () => {
      console.log("[ws] connected", this.socket?.id);
    });

    this.socket.on("disconnect", (reason) => {
      console.log("[ws] disconnected", reason);
    });

    this.socket.on("connect_error", (err) => {
      console.error("[ws] connection error", err.message);
    });

    this.socket.on("message", (payload: unknown) => {
      if (!isServerMessage(payload)) {
        console.warn("[ws] ignored unknown message", payload);
        return;
      }
      this.onMessage(payload);
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  isConnected(): boolean {
    return Boolean(this.socket?.connected);
  }
}

function isServerMessage(value: unknown): value is ServerMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof (value as { type: unknown }).type === "string"
  );
}
