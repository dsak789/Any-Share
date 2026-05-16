const express = require("express");
const { v4: uuidv4 } = require("uuid");
const {
  PutCommand,
  GetCommand,
  QueryCommand,
  DeleteCommand,
} = require("@aws-sdk/lib-dynamodb");
const { docClient, TABLES } = require("../config/dynamo");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

function generatePin(length = 6) {
  return Math.floor(Math.random() * Math.pow(10, length))
    .toString()
    .padStart(length, "0");
}

// POST /api/shares — create a PIN share for a file
router.post("/", authenticate, async (req, res) => {
  try {
    const { fileId, granteeEmail } = req.body;
    if (!fileId || !granteeEmail)
      return res.status(400).json({ error: "fileId and granteeEmail are required" });

    // Verify ownership
    const fileResult = await docClient.send(
      new GetCommand({ TableName: TABLES.FILES, Key: { fileId } })
    );
    if (!fileResult.Item) return res.status(404).json({ error: "File not found" });
    if (fileResult.Item.ownerId !== req.user.userId)
      return res.status(403).json({ error: "Not your file" });

    // Look up grantee by email
    const userResult = await docClient.send(
      new QueryCommand({
        TableName: TABLES.USERS,
        IndexName: "email-index",
        KeyConditionExpression: "email = :e",
        ExpressionAttributeValues: { ":e": granteeEmail.toLowerCase() },
        Limit: 1,
      })
    );
    if (!userResult.Count)
      return res.status(404).json({ error: "No user found with that email" });

    const grantee = userResult.Items[0];
    if (grantee.userId === req.user.userId)
      return res.status(400).json({ error: "Cannot share with yourself" });

    // Generate unique PIN
    let pin;
    let collision = true;
    let attempts = 0;
    while (collision && attempts < 10) {
      pin = generatePin(6);
      const existing = await docClient.send(
        new QueryCommand({
          TableName: TABLES.SHARES,
          IndexName: "pin-index",
          KeyConditionExpression: "pin = :p",
          ExpressionAttributeValues: { ":p": pin },
          Limit: 1,
        })
      );
      collision = existing.Count > 0;
      attempts++;
    }

    const now = new Date().toISOString();
    const shareItem = {
      fileId,
      granteeId: grantee.userId,
      granteeEmail: grantee.email,
      granteeName: grantee.name,
      grantorId: req.user.userId,
      grantorName: req.user.name,
      fileName: fileResult.Item.originalName,
      pin,
      grantedAt: now,
    };

    await docClient.send(new PutCommand({ TableName: TABLES.SHARES, Item: shareItem }));

    res.status(201).json({
      share: {
        fileId,
        granteeEmail: grantee.email,
        granteeName: grantee.name,
        fileName: fileResult.Item.originalName,
        pin,
        grantedAt: now,
      },
    });
  } catch (err) {
    console.error("Create share error:", err);
    res.status(500).json({ error: "Failed to create share" });
  }
});

// POST /api/shares/validate-pin — validate PIN and grant download access
router.post("/validate-pin", authenticate, async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin) return res.status(400).json({ error: "PIN is required" });

    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLES.SHARES,
        IndexName: "pin-index",
        KeyConditionExpression: "pin = :p",
        ExpressionAttributeValues: { ":p": pin.toString().padStart(6, "0") },
        Limit: 1,
      })
    );

    if (!result.Count) return res.status(404).json({ error: "Invalid PIN" });

    const share = result.Items[0];

    // The PIN must be assigned to this user
    if (share.granteeId !== req.user.userId)
      return res.status(403).json({ error: "This PIN was not issued to your account" });

    // Return file info so the client can initiate download
    const fileResult = await docClient.send(
      new GetCommand({
        TableName: TABLES.FILES,
        Key: { fileId: share.fileId },
        ProjectionExpression:
          "fileId, ownerId, ownerName, originalName, mimeType, #sz, uploadedAt, isLarge, storageType",
        ExpressionAttributeNames: { "#sz": "size" },
      })
    );

    if (!fileResult.Item) return res.status(404).json({ error: "File no longer exists" });

    res.json({ file: fileResult.Item, share });
  } catch (err) {
    console.error("Validate PIN error:", err);
    res.status(500).json({ error: "PIN validation failed" });
  }
});

// GET /api/shares/my-shares — shares the authenticated user has granted
router.get("/my-shares", authenticate, async (req, res) => {
  try {
    // Query all shares where grantorId matches — scan with filter (simple approach)
    // For production, add a grantorId GSI
    const filesResult = await docClient.send(
      new QueryCommand({
        TableName: TABLES.FILES,
        IndexName: "owner-index",
        KeyConditionExpression: "ownerId = :o",
        ExpressionAttributeValues: { ":o": req.user.userId },
        ProjectionExpression: "fileId",
      })
    );

    const fileIds = (filesResult.Items || []).map((f) => f.fileId);

    const allShares = [];
    for (const fileId of fileIds) {
      const sharesResult = await docClient.send(
        new QueryCommand({
          TableName: TABLES.SHARES,
          KeyConditionExpression: "fileId = :f",
          ExpressionAttributeValues: { ":f": fileId },
        })
      );
      allShares.push(...(sharesResult.Items || []));
    }

    res.json({ shares: allShares });
  } catch (err) {
    console.error("My shares error:", err);
    res.status(500).json({ error: "Failed to fetch shares" });
  }
});

// DELETE /api/shares/:fileId/:granteeId — revoke access
router.delete("/:fileId/:granteeId", authenticate, async (req, res) => {
  try {
    const { fileId, granteeId } = req.params;

    // Verify ownership
    const fileResult = await docClient.send(
      new GetCommand({ TableName: TABLES.FILES, Key: { fileId } })
    );
    if (!fileResult.Item) return res.status(404).json({ error: "File not found" });
    if (fileResult.Item.ownerId !== req.user.userId)
      return res.status(403).json({ error: "Not your file" });

    await docClient.send(
      new DeleteCommand({ TableName: TABLES.SHARES, Key: { fileId, granteeId } })
    );

    res.json({ message: "Access revoked" });
  } catch (err) {
    console.error("Revoke error:", err);
    res.status(500).json({ error: "Failed to revoke access" });
  }
});

module.exports = router;
