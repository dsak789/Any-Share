require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");

const { initializeTables } = require("./config/dynamo");
const authRoutes = require("./routes/auth");
const fileRoutes = require("./routes/files");
const shareRoutes = require("./routes/shares");

const app = express();
const PORT = process.env.PORT || 9999;

// Ensure upload directory exists
const uploadDir = process.env.UPLOAD_DIR || "./uploads";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.FRONTEND_URL.split(",") || [
      "https://anyshare.dsak.in",
      "https://anyshare789.vercel.app",
    ],
    credentials: true,
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: "Too many requests, please try again later" },
});
const authLimiter = rateLimit({
  windowMs: 7 * 60 * 1000,
  max: 3,
  message: { error: "Too many auth attempts, please try again later" },
});

app.use("/api/", apiLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

// ── Routes ──────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/shares", shareRoutes);

// Health check
app.get("/api/health", (req, res) =>
  res.json({ status: "ok", timestamp: new Date().toISOString() }),
);

// ── Start ────────────────────────────────────────────────────────────────────
async function start() {
  try {
    await initializeTables();
    app.listen(PORT, () => {
      console.log(`🚀 FileVault server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
}

start();
