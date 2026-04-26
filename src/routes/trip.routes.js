const express = require("express");
const requireAuth = require("../middleware/requireAuth");
const Trip = require("../models/Trip");
const axios = require("axios");

const router = express.Router();

const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT

function buildPrompt(location, type, duration, preferences) {
  let typeConstraint = "";
  if (type === "bicycle") {
    typeConstraint = "Generate a 3-day circular cycling route within the city (starting and ending at the same point). Total distance: 30km to 60km across all 3 days. The route should explore different neighborhoods or areas of the city each day.";
  } else if (type === "trek") {
    typeConstraint = "Generate a 3-day circular hiking route within the city (starting and ending at the same point). Total distance: 5km to 15km across all 3 days. The route should visit different parks, landmarks, or areas each day.";
  } else {
    typeConstraint = "Generate a route appropriate for " + type;
  }

  return `Create a ${duration}-day trip in ${location}.
${typeConstraint}
${preferences ? `Preferences: ${preferences}` : ''}

Rules:
- Coordinates must follow real roads/trails (no straight lines).
- Provide around 9 distinct waypoints spread across the route. All coordinates must be different locations.
- Respond with ONLY valid JSON. No markdown, no explanation, no code fences.

JSON structure:
{
  "title": "...",
  "description": "...",
  "coordinates": [[lat, lng], ...],
  "startPoint": "...",
  "endPoint": "...",
  "distance": number,
  "duration": ${duration},
  "difficulty": "easy|moderate|challenging",
  "highlights": ["..."],
  "recommendations": ["..."]
}`;
}

router.post("/generate", requireAuth, async (req, res) => {
  try {
    const { location, type, duration, provider, preferences } = req.body;

    if (!location || !type || !duration) {
      return res.status(400).json({ error: "location, type, and duration are required" });
    }

    const prompt = buildPrompt(location, type, duration, preferences);

    const extractJSON = (text) => {
      // Strip markdown code fences (```json ... ``` or ``` ... ```)
      const stripped = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '');
      // Find the outermost JSON object
      const start = stripped.indexOf('{');
      const end = stripped.lastIndexOf('}');
      if (start === -1 || end === -1) throw new Error('No JSON object found in response');
      return JSON.parse(stripped.slice(start, end + 1));
    };

    const getLLMErrorMessage = (err) => {
      const status = err.response?.status;
      if (status === 401 || status === 429 || status === 502 || status === 503)
        return "The AI model is temporarily unavailable. Please try again in a few seconds.";
      return "The AI model could not generate a route for this location. Try a different city or switch the AI provider.";
    };

    const callLLM = async () => {
      if (provider === "openai") {
        let response;
        try {
          response = await axios.post("https://api.openai.com/v1/chat/completions", {
            model: "gpt-4o",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: prompt }
            ],
            temperature: 0.7
          }, {
            headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }
          });
        } catch (err) {
          throw new Error(getLLMErrorMessage(err));
        }
        try {
          const content = response.data.choices[0].message.content;
          return extractJSON(content);
        } catch (parseErr) {
          console.error("OpenAI JSON parse failed. Raw response:", response.data.choices[0].message.content);
          throw new Error("The AI model returned an unexpected response. Please try again.");
        }
      } else if (provider === "gemini") {
        let response;
        try {
          response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7 }
          });
        } catch (err) {
          throw new Error(getLLMErrorMessage(err));
        }
        try {
          const content = response.data.candidates[0].content.parts[0].text;
          return extractJSON(content);
        } catch (parseErr) {
          console.error("Gemini JSON parse failed. Raw response:", response.data.candidates[0].content.parts[0].text);
          throw new Error("The AI model returned an unexpected response. Please try again.");
        }
      } else {
        throw new Error("The AI model is temporarily unavailable. Please try again in a few seconds.");
      }
    };

    const deduplicate = (coords) => {
      const seen = [];
      return coords.filter(([lat, lng]) => {
        const isDup = seen.some(([slat, slng]) => Math.abs(lat - slat) < 0.0005 && Math.abs(lng - slng) < 0.0005);
        if (!isDup) seen.push([lat, lng]);
        return !isDup;
      });
    };

    const padToMin = (coords, min) => {
      const result = [...coords];
      while (result.length < min) {
        let maxDist = -1, maxIdx = 0;
        for (let i = 0; i < result.length - 1; i++) {
          const d = Math.abs(result[i][0] - result[i+1][0]) + Math.abs(result[i][1] - result[i+1][1]);
          if (d > maxDist) { maxDist = d; maxIdx = i; }
        }
        const mid = [(result[maxIdx][0] + result[maxIdx+1][0]) / 2, (result[maxIdx][1] + result[maxIdx+1][1]) / 2];
        result.splice(maxIdx + 1, 0, mid);
      }
      return result;
    };

    // Single LLM call — deduplicate and ensure at least 9 points
    let tripData = null;
    try {
      tripData = await callLLM();
      if (Array.isArray(tripData.coordinates)) {
        tripData.coordinates = padToMin(deduplicate(tripData.coordinates), 9);
      }
    } catch (llmErr) {
      console.error("LLM Error:", llmErr.message);
      return res.status(500).json({ error: llmErr.message });
    }

    // Coordinates for weather (middle of route or start)
    const coords = tripData.coordinates && tripData.coordinates.length > 0 ? tripData.coordinates[0] : [32.0853, 34.7818];
    const [lat, lon] = coords;

    // Fetch Weather (3 days from tomorrow) using open-meteo (free, no API key required)
    let weather = { forecast: [], updatedAt: new Date().toISOString() };
    try {
      const weatherRes = await axios.get(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,precipitation_sum,weathercode&timezone=auto`);
      const daily = weatherRes.data.daily;
      // Get next 3 days starting tomorrow
      for (let i = 1; i <= 3; i++) {
        if (daily.time[i]) {
          let conditionStr = "Clear";
          if (daily.weathercode[i] > 50) conditionStr = "Rain";
          else if (daily.weathercode[i] > 1) conditionStr = "Cloudy";

          weather.forecast.push({
            date: daily.time[i],
            temp: daily.temperature_2m_max[i],
            precipitation: daily.precipitation_sum[i],
            condition: conditionStr
          });
        }
      }
    } catch (weatherErr) {
      console.error("Weather error", weatherErr.message);
    }

    // Image Integration
    const imageUrl = `https://images.unsplash.com/photo-1544989164-897db6745145?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80`; // Static placeholder matching real API format or dynamically generating url based on query if possible, but Unsplash Source is deprecated so let's use a dynamic fixed term or real integration. 
    const finalImage = `https://picsum.photos/seed/${encodeURIComponent(location)}/800/400`;

    return res.json({
      trip: tripData,
      image: finalImage,
      weather: weather
    });

  } catch (err) {
    console.error("Generate error", err);
    res.status(500).json({ error: "The AI model is temporarily unavailable. Please try again in a few seconds." });
  }
});

router.post("/save", requireAuth, async (req, res) => {
  try {
    const { title, type, distance, duration, route, imageUrl, aiProvider, aiGeneratedData } = req.body;
    // IMPORTANT: Save without weather data as requested!
    const trip = await Trip.create({
      userId: req.user.uid,
      title,
      type,
      distance,
      duration,
      route,
      imageUrl,
      aiProvider,
      aiGeneratedData
    });
    return res.status(201).json({ ok: true, trip });
  } catch (err) {
    console.error("Save error", err);
    return res.status(500).json({ error: "Failed to save trip" });
  }
});

router.get("/history", requireAuth, async (req, res) => {
  try {
    const trips = await Trip.find({ userId: req.user.uid }).sort({ createdAt: -1 });

    // For each trip fetch fresh weather data for "tomorrow"
    const enrichedTrips = await Promise.all(trips.map(async (trip) => {
      const tripObj = trip.toObject();
      let newWeather = { forecast: [], updatedAt: new Date().toISOString() };
      try {
        const coords = tripObj.route && tripObj.route.coordinates && tripObj.route.coordinates.length > 0
          ? tripObj.route.coordinates[0]
          : [32.0853, 34.7818];
        const [lat, lon] = coords;
        const weatherRes = await axios.get(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,precipitation_sum,weathercode&timezone=auto`);
        const daily = weatherRes.data.daily;
        for (let i = 1; i <= 3; i++) {
          if (daily.time[i]) {
            let conditionStr = "Clear";
            if (daily.weathercode[i] > 50) conditionStr = "Rain";
            else if (daily.weathercode[i] > 1) conditionStr = "Cloudy";
            newWeather.forecast.push({
              date: daily.time[i],
              temp: daily.temperature_2m_max[i],
              precipitation: daily.precipitation_sum[i],
              condition: conditionStr
            });
          }
        }
      } catch (e) {
        console.error("History weather error", e.message);
      }
      tripObj.weather = newWeather;
      return tripObj;
    }));

    return res.json({ ok: true, trips: enrichedTrips });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch history" });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const trip = await Trip.findOneAndDelete({ _id: req.params.id, userId: req.user.uid });
    if (!trip) return res.status(404).json({ error: "Trip not found" });
    return res.json({ ok: true });
  } catch (err) {
    console.error("Delete trip error", err);
    return res.status(500).json({ error: "Failed to delete trip" });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const trip = await Trip.findOne({ _id: req.params.id, userId: req.user.uid });
    if (!trip) return res.status(404).json({ error: "Trip not found" });

    const tripObj = trip.toObject();
    let newWeather = { forecast: [], updatedAt: new Date().toISOString() };
    try {
      const coords = tripObj.route?.coordinates?.[0] ?? [32.0853, 34.7818];
      const [lat, lon] = coords;
      const weatherRes = await axios.get(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,precipitation_sum,weathercode&timezone=auto`);
      const daily = weatherRes.data.daily;
      for (let i = 1; i <= 3; i++) {
        if (daily.time[i]) {
          const conditionStr = daily.weathercode[i] > 50 ? "Rain" : daily.weathercode[i] > 1 ? "Cloudy" : "Clear";
          newWeather.forecast.push({ date: daily.time[i], temp: daily.temperature_2m_max[i], precipitation: daily.precipitation_sum[i], condition: conditionStr });
        }
      }
    } catch (e) {
      console.error("Weather fetch error", e.message);
    }
    tripObj.weather = newWeather;
    return res.json(tripObj);
  } catch (err) {
    console.error("Get trip error", err);
    return res.status(500).json({ error: "Failed to fetch trip" });
  }
});

module.exports = router;
