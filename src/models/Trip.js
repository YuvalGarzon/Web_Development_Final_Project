const mongoose = require("mongoose");

const routeSchema = new mongoose.Schema({
  coordinates: { type: [[Number]], required: true },
  startPoint: { type: String, required: true },
  endPoint: { type: String, required: true },
}, { _id: false });

const tripSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true },
  type: { type: String, enum: ["trek", "bicycle"], required: true },
  distance: { type: Number, required: true },
  duration: { type: Number, required: true },
  route: { type: routeSchema, required: true },
  imageUrl: { type: String },
  createdAt: { type: Date, default: Date.now },
  aiProvider: { type: String },
  aiGeneratedData: { type: mongoose.Schema.Types.Mixed }
});

module.exports = mongoose.model("Trip", tripSchema);
