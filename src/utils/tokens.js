const jwt = require("jsonwebtoken");

function parseDurationToMs(str, fallbackMs) {
  if (!str || typeof str !== "string") return fallbackMs;

  const m = str.trim().match(/^(\d+)\s*([smhd])$/i);
  if (!m) return fallbackMs;

  const value = Number(m[1]);
  const unit = m[2].toLowerCase();

  const mult =
    unit === "s" ? 1000 :
    unit === "m" ? 60 * 1000 :
    unit === "h" ? 60 * 60 * 1000 :
    unit === "d" ? 24 * 60 * 60 * 1000 :
    0;

  return value * mult || fallbackMs;
}

function signAccessToken(user) {
  const submitters = (process.env.SUBMITTERS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  const payload = {
    uid: String(user._id),
    email: user.email,
    submitters,
    typ: "access",
  };

  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.ACCESS_EXPIRES_IN || "15m",
  });
}

function signRefreshToken(user) {
  const payload = {
    uid: String(user._id),
    typ: "refresh",
  };

  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.REFRESH_EXPIRES_IN || "1d",
  });
}

function setAuthCookies(res, accessToken, refreshToken) {
  const isProd = process.env.NODE_ENV === "production";

  const accessMaxAge = parseDurationToMs(process.env.ACCESS_EXPIRES_IN, 15 * 60 * 1000);
  const refreshMaxAge = parseDurationToMs(process.env.REFRESH_EXPIRES_IN, 24 * 60 * 60 * 1000);

  res.cookie("access_token", accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: accessMaxAge,
    path: "/",
  });

  res.cookie("refresh_token", refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: refreshMaxAge,
    path: "/auth/refresh",
  });
}

function clearAuthCookies(res) {
  const isProd = process.env.NODE_ENV === "production";

  res.clearCookie("access_token", {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
  });

  res.clearCookie("refresh_token", {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/auth/refresh",
  });
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  setAuthCookies,
  clearAuthCookies,
};
