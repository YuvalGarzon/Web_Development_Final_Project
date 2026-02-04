const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const token = req.cookies?.access_token;

  if (!token) {
    return res.status(401).json({ error: "missing access token" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    if (payload.typ !== "access" || !payload.uid) {
      return res.status(401).json({ error: "invalid access token" });
    }

    req.user = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ error: "invalid access token" });
  }
}

module.exports = requireAuth;