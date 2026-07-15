import path from "path";
import http from "http";
import express from "express";
import { Server as SocketIOServer } from "socket.io";
import { RoomManager } from "./rooms";
import { registerSocketHandlers } from "./socketHandlers";

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, "../public");

function createApp(): express.Application {
  const app = express();

  app.use(express.static(PUBLIC_DIR));

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  // SPA-style fallback: serve index for unknown routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "index.html"));
  });

  return app;
}

function start(): void {
  const app = createApp();
  const httpServer = http.createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: { origin: "*" },
  });

  const rooms = new RoomManager();
  registerSocketHandlers(io, rooms);

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Collaborative canvas listening on http://0.0.0.0:${PORT}`);
  });
}

start();
