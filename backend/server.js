const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { v4: uuidv4 } = require("uuid");
const multer = require("multer");
const crypto = require("crypto");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// ── Config ──────────────────────────────────────────────────────────────────
const AUTH_PASSWORD = process.env.VAULT_PASSWORD || "changeme123";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(express.json());

// ── Upload directory ────────────────────────────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ── Metadata cache (JSON file on disk) ──────────────────────────────────────
const META_FILE = path.join(__dirname, "metadata.json");

function loadMetadata() {
  try {
    if (fs.existsSync(META_FILE))
      return JSON.parse(fs.readFileSync(META_FILE, "utf8"));
  } catch (e) {
    console.warn("Could not read metadata.json:", e.message);
  }
  return {};
}

function saveMetadata() {
  try {
    fs.writeFileSync(META_FILE, JSON.stringify(fileMetadata, null, 2));
  } catch (e) {
    console.error("Failed to persist metadata:", e.message);
  }
}

const fileMetadata = loadMetadata();

// Purge orphaned metadata on startup
Object.keys(fileMetadata).forEach((id) => {
  if (!fs.existsSync(path.join(UPLOADS_DIR, fileMetadata[id].storedName))) {
    delete fileMetadata[id];
  }
});
saveMetadata();

// ── Session store ────────────────────────────────────────────────────────────
const sessions = {};

function createSession() {
  const token = crypto.randomBytes(32).toString("hex");
  sessions[token] = { createdAt: Date.now() };
  return token;
}

function isValidSession(token) {
  if (!token || !sessions[token]) return false;
  if (Date.now() - sessions[token].createdAt > SESSION_TTL_MS) {
    delete sessions[token];
    return false;
  }
  return true;
}

// ── Auth middleware ──────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const header = req.headers["authorization"] || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (isValidSession(token)) return next();
  res.status(401).json({ error: "Unauthorized." });
}

// ── Public auth routes ───────────────────────────────────────────────────────
app.post("/api/login", (req, res) => {
  if (!req.body.password || req.body.password !== AUTH_PASSWORD)
    return res.status(401).json({ error: "Wrong password." });
  res.json({ token: createSession() });
});

app.post("/api/logout", (req, res) => {
  const header = req.headers["authorization"] || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (token) delete sessions[token];
  res.json({ message: "Logged out." });
});

app.get("/api/me", (req, res) => {
  const header = req.headers["authorization"] || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  res.json({ authenticated: isValidSession(token) });
});

// ── System info route ────────────────────────────────────────────────────────
app.get("/api/system", requireAuth, (_req, res) => {
  // ── OS details ──
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  // ── Uploads folder size ──
  let uploadBytes = 0;
  try {
    fs.readdirSync(UPLOADS_DIR).forEach((f) => {
      try {
        const s = fs.statSync(path.join(UPLOADS_DIR, f));
        if (s.isFile()) uploadBytes += s.size;
      } catch (_) {}
    });
  } catch (_) {}

  // ── Network interfaces (IPv4 only, skip loopback) ──
  const nets = os.networkInterfaces();
  const ifaces = [];
  Object.entries(nets).forEach(([name, addrs]) => {
    (addrs || []).forEach((a) => {
      if (a.family === "IPv4" && !a.internal)
        ifaces.push({ name, address: a.address });
    });
  });

  res.json({
    os: {
      platform: os.platform(), // win32, linux, darwin …
      release: os.release(),
      arch: os.arch(),
      hostname: os.hostname(),
      uptime: os.uptime(), // seconds
      type: os.type(),
    },
    cpu: {
      model: cpus[0]?.model || "Unknown",
      cores: cpus.length,
      speedMHz: cpus[0]?.speed || 0,
    },
    memory: {
      totalBytes: totalMem,
      usedBytes: usedMem,
      freeBytes: freeMem,
      usedPercent: Math.round((usedMem / totalMem) * 100),
    },
    storage: {
      uploadDirBytes: uploadBytes,
      fileCount: Object.keys(fileMetadata).length,
    },
    network: { interfaces: ifaces },
    node: process.version,
    pid: process.pid,
  });
});

// ── Multer ───────────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

// ── Protected file routes ─────────────────────────────────────────────────────
app.post("/api/upload", requireAuth, upload.array("files", 20), (req, res) => {
  if (!req.files?.length)
    return res.status(400).json({ error: "No files provided." });

  const uploaded = req.files.map((f) => {
    const id = path.basename(f.filename, path.extname(f.filename));
    const meta = {
      id,
      originalName: f.originalname,
      storedName: f.filename,
      size: f.size,
      mimeType: f.mimetype,
      uploadedAt: new Date().toISOString(),
    };
    fileMetadata[id] = meta;
    return meta;
  });
  saveMetadata();
  res.status(201).json({ message: "Upload successful.", files: uploaded });
});

app.get("/api/files", requireAuth, (_req, res) => {
  const files = Object.values(fileMetadata).sort(
    (a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt),
  );
  res.json({ files });
});

app.get("/api/files/:id", requireAuth, (req, res) => {
  const meta = fileMetadata[req.params.id];
  if (!meta) return res.status(404).json({ error: "File not found." });
  res.json(meta);
});

app.get("/api/download/:id", requireAuth, (req, res) => {
  const meta = fileMetadata[req.params.id];
  if (!meta) return res.status(404).json({ error: "File not found." });
  const filePath = path.join(UPLOADS_DIR, meta.storedName);
  if (!fs.existsSync(filePath))
    return res.status(404).json({ error: "File missing from disk." });
  res.download(filePath, meta.originalName);
});

app.delete("/api/files/:id", requireAuth, (req, res) => {
  const meta = fileMetadata[req.params.id];
  if (!meta) return res.status(404).json({ error: "File not found." });
  const filePath = path.join(UPLOADS_DIR, meta.storedName);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  delete fileMetadata[req.params.id];
  saveMetadata();
  res.json({ message: "File deleted." });
});

app.get("/", (req, res) => {
  res.status(200).json("My Vault API");
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🗄  Vault API  →  http://localhost:${PORT}`);
  console.log(`🔑  Password  →  ${AUTH_PASSWORD}`);
});
