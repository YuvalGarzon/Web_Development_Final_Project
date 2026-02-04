const express = require("express");
const bcrypt = require("bcrypt");
const User = require("../models/User");
const requireAuth = require("../middleware/requireAuth");
const jwt = require("jsonwebtoken");

const {
  signAccessToken,
  signRefreshToken,
  setAuthCookies,
  clearAuthCookies,
} = require("../utils/tokens");

const router = express.Router();

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPassword(password) {
  return (
    typeof password === "string" &&
    password.length >= 8 &&
    /[A-Za-z]/.test(password) &&
    /\d/.test(password)
  );
}

router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    const emailNorm = String(email || "").trim().toLowerCase();

    if (!emailNorm || typeof password !== "string" || password.length === 0) {
      return res.status(400).json({ error: "email and password are required" });
    }

    if (!isValidEmail(emailNorm)) {
      return res.status(400).json({ error: "invalid email" });
    }

    if (!isValidPassword(password)) {
      return res.status(400).json({
        error:
          "password must be at least 8 characters and include at least one letter and one number",
      });
    }

    const existing = await User.findOne({ email: emailNorm });
    if (existing) {
      return res.status(409).json({ error: "email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ email: emailNorm, passwordHash });
    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

    setAuthCookies(res, accessToken, refreshToken);

    return res.status(201).json({
      ok: true,
      user: { id: user._id, email: user.email },
    });
  } catch (err) {
    return res.status(500).json({ error: "server error" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    const emailNorm = String(email || "").trim().toLowerCase();

    if (!emailNorm || typeof password !== "string" || password.length === 0) {
      return res.status(400).json({ error: "email and password are required" });
    }

    if (!isValidEmail(emailNorm)) {
      return res.status(400).json({ error: "invalid email" });
    }

    const user = await User.findOne({ email: emailNorm });
    if (!user) {
      return res.status(401).json({ error: "invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "invalid credentials" });
    }

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    setAuthCookies(res, accessToken, refreshToken);

    return res.status(200).json({
      ok: true,
      user: { id: user._id, email: user.email },
    });
  } catch (err) {
    return res.status(500).json({ error: "server error" });
  }
});

router.post("/refresh", async (req, res) => {
  try {
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) {
      return res.status(401).json({ error: "missing refresh token" });
    }

    let payload;
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({ error: "invalid refresh token" });
    }

    if (payload.typ !== "refresh" || !payload.uid) {
      return res.status(401).json({ error: "invalid refresh token" });
    }

    const user = await User.findById(payload.uid);
    if (!user) {
      return res.status(401).json({ error: "invalid refresh token" });
    }

    const newAccessToken = signAccessToken(user);
    const newRefreshToken = signRefreshToken(user); // refresh rotation
    setAuthCookies(res, newAccessToken, newRefreshToken);

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "server error" });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  return res.status(200).json({
    ok: true,
    user: {
      id: req.user.uid,
      email: req.user.email,
      submitters: req.user.submitters,
    },
  });
});

router.post("/logout", (req, res) => {
  try {
    clearAuthCookies(res);
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "server error" });
  }
});

module.exports = router;
