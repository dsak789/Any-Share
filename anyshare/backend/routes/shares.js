const express = require("express");
const { v4: uuidv4 } = require("uuid");
const {
  PutCommand,
  GetCommand,
  QueryCommand,
  DeleteCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");
const { docClient, TABLES } = require("../config/dynamo");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateAnySharePin() {
  const digits = Math.floor(10000 + Math.random() * 90000); // 5 digits
  return "AS-" + digits;
}

function expiryDate(days) {
  if (!days) return null; // no expiry
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function isExpired(linkShare) {
  if (linkShare.expiresAt && new Date() > new Date(linkShare.expiresAt))
    return true;
  if (
    linkShare.maxDownloads &&
    linkShare.downloadCount >= linkShare.maxDownloads
  )
    return true;
  return false;
}

async function getFileForOwner(fileId, userId) {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLES.FILES, Key: { fileId } }),
  );
  if (!result.Item) return { error: "File not found", status: 404 };
  if (result.Item.ownerId !== userId)
    return { error: "Not your file", status: 403 };
  return { file: result.Item };
}

// ── EMAIL SHARES (registered users) ─────────────────────────────────────────

// POST /api/shares/email — share with a registered user by email
router.post("/email", authenticate, async (req, res) => {
  try {
    const { fileId, granteeEmail } = req.body;
    if (!fileId || !granteeEmail)
      return res
        .status(400)
        .json({ error: "fileId and granteeEmail are required" });

    const { file, error, status } = await getFileForOwner(
      fileId,
      req.user.userId,
    );
    if (error) return res.status(status).json({ error });

    const userResult = await docClient.send(
      new QueryCommand({
        TableName: TABLES.USERS,
        IndexName: "email-index",
        KeyConditionExpression: "email = :e",
        ExpressionAttributeValues: { ":e": granteeEmail.toLowerCase() },
        Limit: 1,
      }),
    );
    if (!userResult.Count)
      return res
        .status(404)
        .json({ error: "No AnyShare account found with that email" });

    const grantee = userResult.Items[0];
    if (grantee.userId === req.user.userId)
      return res.status(400).json({ error: "Cannot share with yourself" });

    // Check if already shared
    const existing = await docClient.send(
      new GetCommand({
        TableName: TABLES.SHARES,
        Key: { fileId, granteeId: grantee.userId },
      }),
    );
    if (existing.Item)
      return res.status(409).json({ error: "Already shared with this user" });

    const now = new Date().toISOString();
    await docClient.send(
      new PutCommand({
        TableName: TABLES.SHARES,
        Item: {
          fileId,
          granteeId: grantee.userId,
          granteeEmail: grantee.email,
          granteeName: grantee.name,
          grantorId: req.user.userId,
          grantorName: req.user.name,
          grantorEmail: req.user.email,
          fileName: file.originalName,
          fileSize: file.size,
          fileMimeType: file.mimeType,
          grantedAt: now,
        },
      }),
    );

    res.status(201).json({
      share: {
        fileId,
        granteeEmail: grantee.email,
        granteeName: grantee.name,
        fileName: file.originalName,
        grantedAt: now,
      },
    });
  } catch (err) {
    console.error("Email share error:", err);
    res.status(500).json({ error: "Failed to create share" });
  }
});

// GET /api/shares/my-shares — all email shares the current user has granted
router.get("/my-shares", authenticate, async (req, res) => {
  try {
    const filesResult = await docClient.send(
      new QueryCommand({
        TableName: TABLES.FILES,
        IndexName: "owner-index",
        KeyConditionExpression: "ownerId = :o",
        ExpressionAttributeValues: { ":o": req.user.userId },
        ProjectionExpression: "fileId",
      }),
    );

    const fileIds = (filesResult.Items || []).map((f) => f.fileId);
    const allShares = [];
    for (const fileId of fileIds) {
      const sharesResult = await docClient.send(
        new QueryCommand({
          TableName: TABLES.SHARES,
          KeyConditionExpression: "fileId = :f",
          ExpressionAttributeValues: { ":f": fileId },
        }),
      );
      allShares.push(...(sharesResult.Items || []));
    }
    res.json({ shares: allShares });
  } catch (err) {
    console.error("My shares error:", err);
    res.status(500).json({ error: "Failed to fetch shares" });
  }
});

// DELETE /api/shares/email/:fileId/:granteeId — revoke email share
router.delete("/email/:fileId/:granteeId", authenticate, async (req, res) => {
  try {
    const { fileId, granteeId } = req.params;
    const { error, status } = await getFileForOwner(fileId, req.user.userId);
    if (error) return res.status(status).json({ error });

    await docClient.send(
      new DeleteCommand({
        TableName: TABLES.SHARES,
        Key: { fileId, granteeId },
      }),
    );
    res.json({ message: "Access revoked" });
  } catch (err) {
    console.error("Revoke error:", err);
    res.status(500).json({ error: "Failed to revoke access" });
  }
});

// ── LINK SHARES (anonymous / public) ─────────────────────────────────────────

// POST /api/shares/link — create a public link+PIN share
router.post("/link", authenticate, async (req, res) => {
  try {
    const { fileId, expiryDays, maxDownloads } = req.body;
    if (!fileId) return res.status(400).json({ error: "fileId is required" });

    const { file, error, status } = await getFileForOwner(
      fileId,
      req.user.userId,
    );
    if (error) return res.status(status).json({ error });

    const linkId = uuidv4();
    const pin = generateAnySharePin();
    const now = new Date().toISOString();

    const item = {
      linkId,
      fileId,
      ownerId: req.user.userId,
      ownerName: req.user.name,
      ownerEmail: req.user.email,
      fileName: file.originalName,
      fileSize: file.size,
      fileMimeType: file.mimeType,
      pin,
      createdAt: now,
      downloadCount: 0,
      expiresAt: expiryDays ? expiryDate(parseInt(expiryDays)) : null,
      maxDownloads: maxDownloads ? parseInt(maxDownloads) : null,
    };

    await docClient.send(
      new PutCommand({ TableName: TABLES.LINK_SHARES, Item: item }),
    );

    res.status(201).json({
      linkId,
      pin,
      url: `${process.env.FRONTEND_URL.split(",")[2] || "http://localhost:3000"}/share/${linkId}`,
      expiresAt: item.expiresAt,
      maxDownloads: item.maxDownloads,
    });
  } catch (err) {
    console.error("Create link share error:", err);
    res.status(500).json({ error: "Failed to create link share" });
  }
});

// GET /api/shares/my-links — list all link shares the current user created
router.get("/my-links", authenticate, async (req, res) => {
  try {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLES.LINK_SHARES,
        IndexName: "owner-links-index",
        KeyConditionExpression: "ownerId = :o",
        ExpressionAttributeValues: { ":o": req.user.userId },
      }),
    );
    const links = (result.Items || []).map((l) => ({
      ...l,
      expired: isExpired(l),
    }));
    res.json({ links });
  } catch (err) {
    console.error("My links error:", err);
    res.status(500).json({ error: "Failed to fetch links" });
  }
});

// DELETE /api/shares/link/:linkId — delete a link share
router.delete("/link/:linkId", authenticate, async (req, res) => {
  try {
    const { linkId } = req.params;
    const result = await docClient.send(
      new GetCommand({ TableName: TABLES.LINK_SHARES, Key: { linkId } }),
    );
    if (!result.Item) return res.status(404).json({ error: "Link not found" });
    if (result.Item.ownerId !== req.user.userId)
      return res.status(403).json({ error: "Not your link" });

    await docClient.send(
      new DeleteCommand({ TableName: TABLES.LINK_SHARES, Key: { linkId } }),
    );
    res.json({ message: "Link deleted" });
  } catch (err) {
    console.error("Delete link error:", err);
    res.status(500).json({ error: "Failed to delete link" });
  }
});

// ── PUBLIC endpoints (no auth) ────────────────────────────────────────────────

// GET /api/public/share/:linkId — get link metadata (public, no auth)
router.get("/public/:linkId", async (req, res) => {
  try {
    const { linkId } = req.params;
    const result = await docClient.send(
      new GetCommand({ TableName: TABLES.LINK_SHARES, Key: { linkId } }),
    );
    if (!result.Item) return res.status(404).json({ error: "Link not found" });

    const link = result.Item;
    const expired = isExpired(link);

    // Return safe metadata (no pin, no fileId until PIN verified)
    res.json({
      expired,
      ownerName: link.ownerName,
      fileName: link.fileName,
      fileSize: link.fileSize,
      fileMimeType: link.fileMimeType,
      createdAt: link.createdAt,
      expiresAt: link.expiresAt,
      maxDownloads: link.maxDownloads,
      downloadCount: link.downloadCount,
    });
  } catch (err) {
    console.error("Public link info error:", err);
    res.status(500).json({ error: "Failed to load link" });
  }
});

// POST /api/public/share/:linkId/verify — verify PIN, get download token
router.post("/public/:linkId/verify", async (req, res) => {
  try {
    const { linkId } = req.params;
    const { pin } = req.body;
    if (!pin) return res.status(400).json({ error: "PIN is required" });

    const result = await docClient.send(
      new GetCommand({ TableName: TABLES.LINK_SHARES, Key: { linkId } }),
    );
    if (!result.Item) return res.status(404).json({ error: "Link not found" });

    const link = result.Item;
    if (isExpired(link))
      return res
        .status(410)
        .json({ error: "This link has expired or reached its download limit" });

    if (pin.toUpperCase() !== link.pin.toUpperCase())
      return res.status(401).json({ error: "Incorrect PIN" });

    // Return fileId so client can call the public download endpoint
    res.json({
      fileId: link.fileId,
      fileName: link.fileName,
      fileMimeType: link.fileMimeType,
      fileSize: link.fileSize,
    });
  } catch (err) {
    console.error("Verify PIN error:", err);
    res.status(500).json({ error: "Verification failed" });
  }
});

// GET /api/public/share/:linkId/download?pin=AS-XXXXX — public download
router.get("/public/:linkId/download", async (req, res) => {
  const fs = require("fs");
  const path = require("path");
  try {
    const { linkId } = req.params;
    const { pin } = req.query;
    if (!pin) return res.status(400).json({ error: "PIN is required" });

    const result = await docClient.send(
      new GetCommand({ TableName: TABLES.LINK_SHARES, Key: { linkId } }),
    );
    if (!result.Item) return res.status(404).json({ error: "Link not found" });

    const link = result.Item;
    if (isExpired(link))
      return res.status(410).json({ error: "This link has expired" });
    if (pin.toUpperCase() !== link.pin.toUpperCase())
      return res.status(401).json({ error: "Incorrect PIN" });

    // Fetch the actual file
    const fileResult = await docClient.send(
      new GetCommand({ TableName: TABLES.FILES, Key: { fileId: link.fileId } }),
    );
    if (!fileResult.Item)
      return res.status(404).json({ error: "File not found" });

    const file = fileResult.Item;

    // Increment download count
    await docClient.send(
      new UpdateCommand({
        TableName: TABLES.LINK_SHARES,
        Key: { linkId },
        UpdateExpression: "SET downloadCount = downloadCount + :one",
        ExpressionAttributeValues: { ":one": 1 },
      }),
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${file.originalName}"`,
    );
    res.setHeader("Content-Type", file.mimeType || "application/octet-stream");

    if (file.storageType === "disk") {
      if (!fs.existsSync(file.storagePath))
        return res.status(404).json({ error: "File data not found" });
      return res.sendFile(path.resolve(file.storagePath));
    }

    const buffer = Buffer.from(file.content, "base64");
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
  } catch (err) {
    console.error("Public download error:", err);
    res.status(500).json({ error: "Download failed" });
  }
});

module.exports = router;
