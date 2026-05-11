const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Upload directory ────────────────────────────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ── In-memory metadata store (replace with a DB later) ─────────────────────
// Shape: { [fileId]: { id, originalName, storedName, size, mimeType, uploadedAt } }
const fileMetadata = {};

// ── Multer configuration ────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
});

// ── Routes ──────────────────────────────────────────────────────────────────

// POST /api/upload — upload one or more files
app.post("/api/upload", upload.array("files", 20), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "No files provided." });
  }

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

  res.status(201).json({ message: "Upload successful.", files: uploaded });
});

// GET /api/files — list all uploaded files
app.get("/api/files", (_req, res) => {
  const files = Object.values(fileMetadata).sort(
    (a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt),
  );
  res.json({ files });
});

// GET /api/files/:id — get metadata for a single file
app.get("/api/files/:id", (req, res) => {
  const meta = fileMetadata[req.params.id];
  if (!meta) return res.status(404).json({ error: "File not found." });
  res.json(meta);
});

// GET /api/download/:id — download a file
app.get("/api/download/:id", (req, res) => {
  const meta = fileMetadata[req.params.id];
  if (!meta) return res.status(404).json({ error: "File not found." });

  const filePath = path.join(UPLOADS_DIR, meta.storedName);
  if (!fs.existsSync(filePath))
    return res.status(404).json({ error: "File missing from disk." });

  res.download(filePath, meta.originalName);
});

// DELETE /api/files/:id — delete a file
app.delete("/api/files/:id", (req, res) => {
  const meta = fileMetadata[req.params.id];
  if (!meta) return res.status(404).json({ error: "File not found." });

  const filePath = path.join(UPLOADS_DIR, meta.storedName);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  delete fileMetadata[req.params.id];
  res.json({ message: "File deleted." });
});

app.get("/", (req, res) => {
  res.status(200).json("Working");
});
// ── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🗄  File Storage API running on http://localhost:${PORT}`);
});
