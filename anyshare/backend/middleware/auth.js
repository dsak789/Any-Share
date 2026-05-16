const jwt = require("jsonwebtoken");

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  // Also accept ?token= query param (used by img/video/iframe src preview URLs)
  const queryToken = req.query.token;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : queryToken;

  if (!token) return res.status(401).json({ error: "No token provided" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

module.exports = { authenticate };
