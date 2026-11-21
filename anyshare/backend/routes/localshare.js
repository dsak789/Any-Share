/**
 * routes/localshare.js
 * REST endpoints for local-share session management.
 * Socket.io signaling is wired in server.js.
 */

const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

// ── In-memory stores (fine for MVP; move to DynamoDB later) ──────────────────
// sessionId → { hostSocketId, guestSocketId, fileName, fileSize, createdAt, done }
const sessions = new Map();

// IP → transfer count  (anonymous limit)
const anonTransfers = new Map();
const ANON_LIMIT = 3;

// Clean up sessions older than 30 min
setInterval(
  () => {
    const cutoff = Date.now() - 30 * 60 * 1000;
    for (const [id, s] of sessions) {
      if (s.createdAt < cutoff) sessions.delete(id);
    }
  },
  5 * 60 * 1000,
);

// ── Helpers ───────────────────────────────────────────────────────────────────
function getIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
    req.socket.remoteAddress ||
    "unknown"
  );
}

// ── POST /api/localshare/session  (create session) ───────────────────────────
// Called by the SENDER before showing QR code.
router.post("/session", (req, res) => {
  const ip = getIp(req);
  const isAuthed = !!req.user; // set by optional auth below

  if (!isAuthed) {
    const count = anonTransfers.get(ip) || 0;
    if (count >= ANON_LIMIT) {
      return res.status(429).json({
        error: `Anonymous users can only do ${ANON_LIMIT} local transfers. Sign in for unlimited sharing.`,
        limit: ANON_LIMIT,
        used: count,
      });
    }
  }

  const { fileName, fileSize } = req.body;
  if (!fileName) return res.status(400).json({ error: "fileName required" });

  const sessionId = uuidv4();
  sessions.set(sessionId, {
    hostSocketId: null,
    guestSocketId: null,
    fileName,
    fileSize: fileSize || 0,
    ownerId: req.user?.userId || null,
    createdAt: Date.now(),
    done: false,
  });

  res.json({ sessionId });
});

// ── GET /api/localshare/session/:id  (receiver fetches file info) ─────────────
router.get("/session/:id", (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session)
    return res.status(404).json({ error: "Session not found or expired" });
  if (session.done)
    return res.status(410).json({ error: "Transfer already completed" });

  res.json({
    fileName: session.fileName,
    fileSize: session.fileSize,
  });
});

// ── POST /api/localshare/session/:id/complete  (mark done, increment counter) ─
router.post("/session/:id/complete", (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found" });

  session.done = true;

  // Increment anon counter only for anon sessions
  if (!session.ownerId) {
    // We don't have the original IP stored — use current requester's IP
    // (host calls complete, so this is the sender's IP — good enough)
    const ip = getIp(req);
    const count = anonTransfers.get(ip) || 0;
    anonTransfers.set(ip, count + 1);
  }

  res.json({ ok: true });
});

// ── GET /api/localshare/limit  (check remaining transfers for anon) ───────────
router.get("/limit", (req, res) => {
  const ip = getIp(req);
  const used = anonTransfers.get(ip) || 0;
  res.json({
    used,
    limit: ANON_LIMIT,
    remaining: Math.max(0, ANON_LIMIT - used),
  });
});

module.exports = { router, sessions };
