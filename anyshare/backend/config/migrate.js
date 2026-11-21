/**
 * migrate.js — Import AWS DynamoDB CSV exports → DynamoDB Local
 *
 * Usage:
 *   node migrate.js
 *
 * CSV files expected in ./uploads/ (relative to this script):
 *   dev_as_users.csv
 *   dev_as_files.csv
 *   dev_as_shares.csv
 *   as_link_shares.csv
 *
 * Env vars (optional, same as your .env):
 *   DYNAMO_ENDPOINT         default: http://localhost:8000
 *   AWS_REGION              default: us-east-1
 *   DYNAMO_USERS_TABLE      default: filevault_users
 *   DYNAMO_FILES_TABLE      default: filevault_files
 *   DYNAMO_SHARES_TABLE     default: filevault_shares
 *   DYNAMO_LINK_SHARES_TABLE default: filevault_link_shares
 */

require("dotenv").config();
const path = require("path");
const fs   = require("fs");
const { parse } = require("csv-parse/sync");
const {
  DynamoDBClient,
  ListTablesCommand,
} = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
} = require("@aws-sdk/lib-dynamodb");

// ── Config ────────────────────────────────────────────────────────────────────
const ENDPOINT = process.env.DYNAMO_ENDPOINT || "http://localhost:8000";
const REGION   = process.env.AWS_REGION      || "us-east-1";
const TABLES   = {
  USERS:       process.env.DYNAMO_USERS_TABLE       || "as_users",
  FILES:       process.env.DYNAMO_FILES_TABLE       || "as_files",
  SHARES:      process.env.DYNAMO_SHARES_TABLE      || "as_shares",
  LINK_SHARES: process.env.DYNAMO_LINK_SHARES_TABLE || "as_link_shares",
};

const CSV_DIR = path.join(__dirname, "backup");

// ── DynamoDB client (local) ───────────────────────────────────────────────────
const raw = new DynamoDBClient({
  endpoint:    ENDPOINT,
  region:      REGION,
  credentials: { accessKeyId: "local", secretAccessKey: "local" },
});
const docClient = DynamoDBDocumentClient.from(raw, {
  marshallOptions:   { removeUndefinedValues: true, convertEmptyValues: true },
  unmarshallOptions: { wrapNumbers: false },
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const toNum  = (v) => { if (v === "" || v == null) return undefined; const n = Number(v); return isNaN(n) ? undefined : n; };
const toBool = (v) => v === "true" || v === "1" || v === true;
const toStr  = (v) => (v === "" || v == null ? undefined : String(v));

function readCsv(filename) {
  const filepath = path.join(CSV_DIR, filename);
  if (!fs.existsSync(filepath)) {
    console.warn(`  ⚠️  File not found — skipping: ${filepath}`);
    return [];
  }
  const raw = fs.readFileSync(filepath, "utf8");
  return parse(raw, { columns: true, skip_empty_lines: true, trim: true });
}

async function importTable(tableName, rows, transformer, label) {
  console.log(`\n📥  ${label} → ${tableName} (${rows.length} rows)`);
  let ok = 0, fail = 0;
  for (const row of rows) {
    const item = transformer(row);
    try {
      await docClient.send(new PutCommand({ TableName: tableName, Item: item }));
      ok++;
      if (ok % 50 === 0) process.stdout.write(`  ✓ ${ok}/${rows.length}\r`);
    } catch (err) {
      fail++;
      console.error(`  ✗ Failed row:`, JSON.stringify(item).slice(0, 120), "\n   ", err.message);
    }
  }
  console.log(`  Done: ${ok} written, ${fail} failed`);
}

// ── Row transformers ──────────────────────────────────────────────────────────
function transformUser(r) {
  return {
    userId:       r.userId,
    email:        r.email,
    name:         r.name,
    passwordHash: r.passwordHash,
    createdAt:    r.createdAt,
  };
}

function transformFile(r) {
  return {
    fileId:       r.fileId,
    ownerId:      r.ownerId,
    ownerName:    r.ownerName,
    originalName: r.originalName,
    mimeType:     r.mimeType,
    size:         toNum(r.size),
    uploadedAt:   r.uploadedAt,
    isLarge:      toBool(r.isLarge),
    storageType:  r.storageType,
    content:      toStr(r.content),      // undefined if empty (inline base64)
    storagePath:  toStr(r.storagePath),  // undefined if empty (disk path)
  };
}

function transformShare(r) {
  return {
    fileId:      r.fileId,
    granteeId:   r.granteeId,
    pin:         toStr(r.pin),
    fileMimeType: r.fileMimeType,
    fileName:    r.fileName,
    fileSize:    toNum(r.fileSize),
    grantedAt:   r.grantedAt,
    granteeEmail: r.granteeEmail,
    granteeName:  r.granteeName,
    grantorEmail: r.grantorEmail,
    grantorId:    r.grantorId,
    grantorName:  r.grantorName,
  };
}

function transformLinkShare(r) {
  return {
    linkId:        r.linkId,
    fileId:        r.fileId,
    ownerId:       r.ownerId,
    ownerName:     r.ownerName,
    ownerEmail:    r.ownerEmail,
    fileName:      r.fileName,
    fileMimeType:  r.fileMimeType,
    fileSize:      toNum(r.fileSize),
    pin:           toStr(r.pin),
    createdAt:     r.createdAt,
    expiresAt:     toStr(r.expiresAt),         // undefined if no expiry
    maxDownloads:  toNum(r.maxDownloads),       // undefined if no limit
    downloadCount: toNum(r.downloadCount) || 0,
  };
}

// ── Connectivity check ────────────────────────────────────────────────────────
async function checkConnection() {
  console.log(`\n🔌  Connecting to DynamoDB Local at ${ENDPOINT} …`);
  try {
    const res = await raw.send(new ListTablesCommand({}));
    console.log(`  ✅  Connected. Tables found: [${res.TableNames.join(", ") || "none yet"}]`);

    // Warn if expected tables are missing
    const missing = Object.values(TABLES).filter((t) => !res.TableNames.includes(t));
    if (missing.length) {
      console.error(
        `\n  ❌  Missing tables: ${missing.join(", ")}\n` +
        `      Start your backend once first so it auto-creates them:\n` +
        `        cd anyshare/backend && node server.js\n` +
        `      Then Ctrl-C and run this script again.\n`
      );
      process.exit(1);
    }
  } catch (err) {
    if (err.code === "ECONNREFUSED" || err.message?.includes("ECONNREFUSED")) {
      console.error(
        `\n  ❌  Connection refused at ${ENDPOINT}\n` +
        `      Is DynamoDB Local running?  Try:\n` +
        `        sudo systemctl status dynamodb-local\n` +
        `        sudo systemctl start  dynamodb-local\n`
      );
    } else {
      console.error(`\n  ❌  ${err.message}`);
    }
    process.exit(1);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  AnyShare — DynamoDB Local Migration");
  console.log("═══════════════════════════════════════════════════════");

  await checkConnection();

  const users      = readCsv("dev_as_users.csv");
  const files      = readCsv("dev_as_files.csv");
  const shares     = readCsv("dev_as_shares.csv");
  const linkShares = readCsv("as_link_shares.csv");

  await importTable(TABLES.USERS,       users,      transformUser,      "Users");
  await importTable(TABLES.FILES,       files,      transformFile,      "Files");
  await importTable(TABLES.SHARES,      shares,     transformShare,     "Email Shares");
  await importTable(TABLES.LINK_SHARES, linkShares, transformLinkShare, "Link Shares");

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  ✅  Migration complete!");
  console.log("═══════════════════════════════════════════════════════");
  console.log("\nNext steps:");
  console.log("  1. Update backend/.env:");
  console.log("       DYNAMO_ENDPOINT=http://localhost:8000");
  console.log("       AWS_ACCESS_KEY_ID=local");
  console.log("       AWS_SECRET_ACCESS_KEY=local");
  console.log("  2. Restart backend:  pm2 restart anyshare  (or node server.js)");
  console.log("  3. Verify data in a route like GET /api/files\n");
})();
