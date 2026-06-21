require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient, TABLES } = require("./config/dynamo");

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
// Public (no-auth) share endpoints exposed under /api/public
app.use("/api/public", shareRoutes);

// Health check
app.get("/api/health", (req, res) =>
  res.json({ status: "ok", timestamp: new Date().toISOString() }),
);

/// ── Requires to add at top of server.js (alongside existing ones) ─────────────
// const os = require("os");
// const { ScanCommand } = require("@aws-sdk/lib-dynamodb");   ← add ScanCommand to existing destructure

// ── Paste this route in server.js before start() ─────────────────────────────
app.get("/api/systeminfo", async (_req, res) => {
  try {
    // ── OS ───────────────────────────────────────────────────────────────────
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const loadAvg = os.loadavg(); // [1m, 5m, 15m]

    // ── Node process ─────────────────────────────────────────────────────────
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage(); // cumulative µs since start

    // ── Upload dir scan ───────────────────────────────────────────────────────
    const uploadDir = process.env.UPLOAD_DIR || "./uploads";
    let uploadDirBytes = 0,
      diskFileCount = 0;
    try {
      fs.readdirSync(uploadDir).forEach((f) => {
        try {
          const s = fs.statSync(path.join(uploadDir, f));
          if (s.isFile()) {
            uploadDirBytes += s.size;
            diskFileCount++;
          }
        } catch (_) {}
      });
    } catch (_) {}

    // ── DynamoDB — parallel scans ─────────────────────────────────────────────
    const dynStart = Date.now();
    const [usersRes, sharesRes, linksRes, filesRes] = await Promise.all([
      docClient.send(
        new ScanCommand({
          TableName: TABLES.USERS,
          Select: "COUNT",
        }),
      ),
      docClient.send(
        new ScanCommand({
          TableName: TABLES.SHARES,
          Select: "COUNT",
        }),
      ),
      docClient.send(
        new ScanCommand({
          TableName: TABLES.LINK_SHARES,
          // need mimeType too for file type breakdown on link shares
          ProjectionExpression: "expiresAt, maxDownloads, downloadCount",
        }),
      ),
      docClient.send(
        new ScanCommand({
          TableName: TABLES.FILES,
          // fetch mimeType as well for type breakdown
          ProjectionExpression: "storageType, #sz, mimeType",
          ExpressionAttributeNames: { "#sz": "size" },
        }),
      ),
    ]);
    const dynLatencyMs = Date.now() - dynStart;

    // ── File stats ────────────────────────────────────────────────────────────
    let inlineCount = 0,
      inlineBytes = 0;
    let dbDiskCount = 0,
      dbDiskBytes = 0;
    const byType = {
      images: 0,
      video: 0,
      audio: 0,
      documents: 0,
      archives: 0,
      text: 0,
      other: 0,
    };

    (filesRes.Items || []).forEach((item) => {
      const mime = (item.mimeType || "").toLowerCase();
      const sz = item.size || 0;

      if (item.storageType === "inline") {
        inlineCount++;
        inlineBytes += sz;
      } else {
        dbDiskCount++;
        dbDiskBytes += sz;
      }

      // File type bucket
      if (mime.startsWith("image/")) byType.images++;
      else if (mime.startsWith("video/")) byType.video++;
      else if (mime.startsWith("audio/")) byType.audio++;
      else if (mime.startsWith("text/")) byType.text++;
      else if (
        [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-powerpoint",
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ].includes(mime)
      )
        byType.documents++;
      else if (
        [
          "application/zip",
          "application/x-rar-compressed",
          "application/x-tar",
          "application/gzip",
          "application/x-7z-compressed",
        ].includes(mime)
      )
        byType.archives++;
      else byType.other++;
    });

    const totalFiles = (filesRes.Items || []).length;
    const totalManagedBytes = inlineBytes + dbDiskBytes;
    const avgFileSizeBytes =
      totalFiles > 0 ? Math.round(totalManagedBytes / totalFiles) : 0;

    // ── Link share stats ──────────────────────────────────────────────────────
    let activeLinks = 0,
      expiredLinks = 0,
      totalDownloads = 0;
    const now = new Date();
    (linksRes.Items || []).forEach((l) => {
      const timeExpired = l.expiresAt && new Date(l.expiresAt) < now;
      const limitHit =
        l.maxDownloads && (l.downloadCount || 0) >= l.maxDownloads;
      if (timeExpired || limitHit) expiredLinks++;
      else activeLinks++;
      totalDownloads += l.downloadCount || 0;
    });

    // ── Network ───────────────────────────────────────────────────────────────
    const nets = os.networkInterfaces();
    const ifaces = [];
    Object.entries(nets).forEach(([name, addrs]) => {
      (addrs || []).forEach((a) => {
        if (a.family === "IPv4" && !a.internal)
          ifaces.push({ name, address: a.address });
      });
    });

    res.json({
      // ── Application config ──────────────────────────────────────────────────
      app: {
        env: process.env.NODE_ENV || "development",
        port: parseInt(process.env.PORT) || 5000,
        storageThresholdBytes:
          parseInt(process.env.LARGE_FILE_THRESHOLD) || 104857600,
        uploadDir,
        awsRegion: process.env.AWS_REGION || "us-east-1",
        tables: {
          users: TABLES.USERS,
          files: TABLES.FILES,
          shares: TABLES.SHARES,
          linkShares: TABLES.LINK_SHARES,
        },
      },
      // ── OS ──────────────────────────────────────────────────────────────────
      os: {
        platform: os.platform(),
        type: os.type(),
        release: os.release(),
        arch: os.arch(),
        hostname: os.hostname(),
        uptime: os.uptime(),
      },
      // ── CPU ─────────────────────────────────────────────────────────────────
      cpu: {
        model: cpus[0]?.model || "Unknown",
        cores: cpus.length,
        speedMHz: cpus[0]?.speed || 0,
        loadAvg1m: parseFloat(loadAvg[0].toFixed(2)),
        loadAvg5m: parseFloat(loadAvg[1].toFixed(2)),
        loadAvg15m: parseFloat(loadAvg[2].toFixed(2)),
      },
      // ── System RAM ───────────────────────────────────────────────────────────
      memory: {
        totalBytes: totalMem,
        usedBytes: usedMem,
        freeBytes: freeMem,
        usedPercent: Math.round((usedMem / totalMem) * 100),
      },
      // ── Node.js process ──────────────────────────────────────────────────────
      process: {
        nodeVersion: process.version,
        pid: process.pid,
        uptimeSec: Math.floor(process.uptime()),
        heapUsedBytes: memUsage.heapUsed,
        heapTotalBytes: memUsage.heapTotal,
        rssBytes: memUsage.rss,
        externalBytes: memUsage.external,
        cpuUserMs: Math.round(cpuUsage.user / 1000), // µs → ms
        cpuSystemMs: Math.round(cpuUsage.system / 1000),
      },
      // ── Server disk ──────────────────────────────────────────────────────────
      disk: {
        uploadDir,
        uploadDirBytes,
        diskFileCount,
      },
      // ── DynamoDB ─────────────────────────────────────────────────────────────
      dynamo: {
        status: "ok",
        latencyMs: dynLatencyMs,
        files: {
          total: totalFiles,
          inlineCount,
          inlineBytes,
          diskCount: dbDiskCount,
          diskBytes: dbDiskBytes,
          totalManagedBytes,
          avgFileSizeBytes,
          byType,
        },
        users: { total: usersRes.Count || 0 },
        emailShares: { total: sharesRes.Count || 0 },
        linkShares: {
          total: (linksRes.Items || []).length,
          active: activeLinks,
          expired: expiredLinks,
          totalDownloads,
        },
      },
      // ── Network ──────────────────────────────────────────────────────────────
      network: { interfaces: ifaces },
    });
  } catch (err) {
    console.error("Systeminfo error:", err);
    // Return partial error info so frontend knows DynamoDB might be the issue
    res.status(500).json({
      error: "Failed to collect system info",
      detail: err.message,
      dynamo: { status: "error" },
    });
  }
});

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
