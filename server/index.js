import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { Server } from 'socket.io';

import { closeRedisConnections } from './config/redis.js';
import { authMiddleware } from './auth/authMiddleware.js';
import authRoutes from './routes/authRoutes.js';
import checkboxRoutes from './routes/checkboxRoutes.js';
import { initializeSocket } from './socket/socketHandler.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 7000;

async function main() {
  const app = express();
  const server = http.createServer(app);

  // ── Socket.io setup ──
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:7000',
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // ── Express middleware ──
  app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:7000',
    credentials: true,
  }));
  app.use(express.json());
  app.use(cookieParser());
  app.use(authMiddleware);

  // ── Static files ──
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // ── Routes ──
  app.use('/auth', authRoutes);
  app.use('/api', checkboxRoutes);

  // ── Fallback: serve index.html for SPA ──
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  });

  // ── Initialize WebSocket handlers ──
  initializeSocket(io);

  // ── Start server ──
  // Bind to 0.0.0.0 so the server is reachable inside Docker / cloud containers
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n╔══════════════════════════════════════════╗`);
    console.log(`║  🔲 Million Checkboxes Server            ║`);
    console.log(`║  🌐 http://0.0.0.0:${PORT}                 ║`);
    console.log(`║  📡 WebSocket ready                      ║`);
    console.log(`║  🔴 Redis connected                      ║`);
    console.log(`║  🌍 ENV: ${process.env.NODE_ENV || 'development'}                  ║`);
    console.log(`╚══════════════════════════════════════════╝\n`);
  });

  // ── Graceful shutdown ──
  const shutdown = async (signal) => {
    console.log(`\n[Server] ${signal} received. Shutting down...`);
    io.close();
    server.close();
    await closeRedisConnections();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[Server] Fatal error:', err);
  process.exit(1);
});
