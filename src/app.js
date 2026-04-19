const authRoutes = require("./routes/auth.routes");
const tripRoutes = require("./routes/trip.routes");
const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

app.get("/", (req, res) => {
  res.json({ ok: true, service: "auth", status: "running" });
});

app.use("/auth", authRoutes);
app.use("/api/trips", tripRoutes);

module.exports = app;
