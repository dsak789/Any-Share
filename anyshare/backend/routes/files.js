const express = require("express");
const fs = require("fs");
const path = require("path");
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
const { upload } = require("../config/multer");

const router = express.Router();

const LARGE_THRESHOLD = parseInt(process.env.LARGE_FILE_THRESHOLD) || 104857600; // 100 MB

// POST /api/files/upload
router.post("/upload", authenticate, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const { originalname, filename, size, mimetype, path: filePath } = req.file;
    const fileId = uuidv4();
    const now = new Date().toISOString();
    const isLarge = size >= LARGE_THRESHOLD;

    let fileItem = {
      fileId,
      ownerId: req.user.userId,
      ownerName: req.user.name,
      originalName: originalname,
      mimeType: mimetype,
      size,
      uploadedAt: now,
      isLarge,
    };

    if (isLarge) {
      // Store on disk; record the server path
      fileItem.storagePath = filePath;
      fileItem.storageType = "disk";
    } else {
      // Store file content inline in DynamoDB as base64
      const content = fs.readFileSync(filePath);
      fileItem.content = content.toString("base64");
      fileItem.storageType = "inline";
      // Remove the temp disk file
      fs.unlinkSync(filePath);
    }

    await docClient.send(new PutCommand({ TableName: TABLES.FILES, Item: fileItem }));

    // Don't return raw content to client
    const { content, ...safeItem } = fileItem;
    res.status(201).json({ file: safeItem });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

// GET /api/files — list files owned by the authenticated user
router.get("/", authenticate, async (req, res) => {
  try {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLES.FILES,
        IndexName: "owner-index",
        KeyConditionExpression: "ownerId = :o",
        ExpressionAttributeValues: { ":o": req.user.userId },
        // Exclude inline content from list response
        ProjectionExpression:
          "fileId, ownerId, ownerName, originalName, mimeType, #sz, uploadedAt, isLarge, storageType, storagePath",
        ExpressionAttributeNames: { "#sz": "size" },
      })
    );

    const files = (result.Items || []).sort(
      (a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)
    );

    res.json({ files });
  } catch (err) {
    console.error("List files error:", err);
    res.status(500).json({ error: "Failed to list files" });
  }
});

// GET /api/files/shared — files shared with the authenticated user
router.get("/shared", authenticate, async (req, res) => {
  try {
    const sharesResult = await docClient.send(
      new QueryCommand({
        TableName: TABLES.SHARES,
        IndexName: "grantee-index",
        KeyConditionExpression: "granteeId = :g",
        ExpressionAttributeValues: { ":g": req.user.userId },
      })
    );

    const shares = sharesResult.Items || [];
    const files = await Promise.all(
      shares.map(async (share) => {
        const fileResult = await docClient.send(
          new GetCommand({
            TableName: TABLES.FILES,
            Key: { fileId: share.fileId },
            ProjectionExpression:
              "fileId, ownerId, ownerName, originalName, mimeType, #sz, uploadedAt, isLarge, storageType",
            ExpressionAttributeNames: { "#sz": "size" },
          })
        );
        if (!fileResult.Item) return null;
        return { ...fileResult.Item, shareGrantedAt: share.grantedAt };
      })
    );

    res.json({ files: files.filter(Boolean) });
  } catch (err) {
    console.error("List shared error:", err);
    res.status(500).json({ error: "Failed to list shared files" });
  }
});

// GET /api/files/:fileId/download — download file (owner or grantee)
router.get("/:fileId/download", authenticate, async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user.userId;

    const fileResult = await docClient.send(
      new GetCommand({ TableName: TABLES.FILES, Key: { fileId } })
    );
    if (!fileResult.Item) return res.status(404).json({ error: "File not found" });

    const file = fileResult.Item;

    // Check access: owner or grantee
    let hasAccess = file.ownerId === userId;
    if (!hasAccess) {
      const shareResult = await docClient.send(
        new GetCommand({
          TableName: TABLES.SHARES,
          Key: { fileId, granteeId: userId },
        })
      );
      hasAccess = !!shareResult.Item;
    }

    if (!hasAccess) return res.status(403).json({ error: "Access denied" });

    res.setHeader("Content-Disposition", `attachment; filename="${file.originalName}"`);
    res.setHeader("Content-Type", file.mimeType || "application/octet-stream");

    if (file.storageType === "disk") {
      if (!fs.existsSync(file.storagePath))
        return res.status(404).json({ error: "File data not found on disk" });
      return res.sendFile(path.resolve(file.storagePath));
    }

    // Inline (base64 stored in DynamoDB)
    const buffer = Buffer.from(file.content, "base64");
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
  } catch (err) {
    console.error("Download error:", err);
    res.status(500).json({ error: "Download failed" });
  }
});

// GET /api/files/:fileId/preview — stream file inline for in-browser preview (owner or grantee)
router.get("/:fileId/preview", authenticate, async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user.userId;

    const fileResult = await docClient.send(
      new GetCommand({ TableName: TABLES.FILES, Key: { fileId } })
    );
    if (!fileResult.Item) return res.status(404).json({ error: "File not found" });

    const file = fileResult.Item;

    let hasAccess = file.ownerId === userId;
    if (!hasAccess) {
      const shareResult = await docClient.send(
        new GetCommand({ TableName: TABLES.SHARES, Key: { fileId, granteeId: userId } })
      );
      hasAccess = !!shareResult.Item;
    }
    if (!hasAccess) return res.status(403).json({ error: "Access denied" });

    // Inline disposition so browser renders it rather than downloading
    res.setHeader("Content-Disposition", `inline; filename="${file.originalName}"`);
    res.setHeader("Content-Type", file.mimeType || "application/octet-stream");

    if (file.storageType === "disk") {
      if (!fs.existsSync(file.storagePath))
        return res.status(404).json({ error: "File not found on disk" });
      return res.sendFile(path.resolve(file.storagePath));
    }

    const buffer = Buffer.from(file.content, "base64");
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
  } catch (err) {
    console.error("Preview error:", err);
    res.status(500).json({ error: "Preview failed" });
  }
});

// DELETE /api/files/:fileId
router.delete("/:fileId", authenticate, async (req, res) => {
  try {
    const { fileId } = req.params;

    const fileResult = await docClient.send(
      new GetCommand({ TableName: TABLES.FILES, Key: { fileId } })
    );
    if (!fileResult.Item) return res.status(404).json({ error: "File not found" });
    if (fileResult.Item.ownerId !== req.user.userId)
      return res.status(403).json({ error: "Not your file" });

    const file = fileResult.Item;

    // Remove from disk if large file
    if (file.storageType === "disk" && file.storagePath && fs.existsSync(file.storagePath)) {
      fs.unlinkSync(file.storagePath);
    }

    await docClient.send(new DeleteCommand({ TableName: TABLES.FILES, Key: { fileId } }));
    res.json({ message: "File deleted" });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ error: "Delete failed" });
  }
});

module.exports = router;
