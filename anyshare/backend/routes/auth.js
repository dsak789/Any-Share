const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { PutCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient, TABLES } = require("../config/dynamo");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name)
      return res.status(400).json({ error: "email, password, and name are required" });
    if (password.length < 7)
      return res.status(400).json({ error: "Password must be at least 7 characters" });

    // Check duplicate email
    const existing = await docClient.send(
      new QueryCommand({
        TableName: TABLES.USERS,
        IndexName: "email-index",
        KeyConditionExpression: "email = :e",
        ExpressionAttributeValues: { ":e": email.toLowerCase() },
        Limit: 1,
      })
    );
    if (existing.Count > 0)
      return res.status(409).json({ error: "Email already registered" });

    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date().toISOString();

    await docClient.send(
      new PutCommand({
        TableName: TABLES.USERS,
        Item: { userId, email: email.toLowerCase(), name, passwordHash, createdAt: now },
      })
    );

    const token = jwt.sign({ userId, email: email.toLowerCase(), name }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.status(201).json({ token, user: { userId, email: email.toLowerCase(), name } });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Registration failed" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "email and password are required" });

    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLES.USERS,
        IndexName: "email-index",
        KeyConditionExpression: "email = :e",
        ExpressionAttributeValues: { ":e": email.toLowerCase() },
        Limit: 1,
      })
    );

    if (!result.Count)
      return res.status(401).json({ error: "Invalid credentials" });

    const user = result.Items[0];
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid)
      return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { userId: user.userId, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token, user: { userId: user.userId, email: user.email, name: user.name } });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// GET /api/auth/me
router.get("/me", authenticate, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
