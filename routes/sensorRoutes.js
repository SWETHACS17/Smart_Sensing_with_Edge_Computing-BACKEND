// routes/sensor.js
const express = require('express');
const router = express.Router();
const SensorReading = require('../models/Sensor');
const { addClient, broadcast } = require('../sse/broadcaster');

// POST /api/sensor
// Accepts JSON body like:
// { "sensor id": 1, "value": 25.4, "time": "2025-10-12T14:10:00Z", "location": "inside factory component 1" }
// or { sensorId: 1, value: 25.4, time: "...", location: "..." }
router.post('/', async (req, res) => {
  try {
    const incoming = req.body || {};
    // Normalize keys - be permissive
    const sensorId = incoming.sensorId ?? incoming['sensor id'] ?? incoming.sensor_id ?? incoming.id;
    const value = Number(incoming.value ?? incoming.val);
    const location = incoming.location ?? incoming['location of sensor'] ?? '';
    let time = incoming.time ?? incoming.Time ?? incoming.timestamp;

    // Try to parse time string into Date; fallback to now
    let parsedTime = time ? new Date(time) : new Date();
    if (isNaN(parsedTime)) parsedTime = new Date();

    if (sensorId === undefined || Number.isNaN(value)) {
      return res.status(400).json({ error: 'Missing sensorId or value' });
    }

    const doc = new SensorReading({
      sensorId: Number(sensorId),
      value,
      status: incoming.status ?? 'Normal',
      time: parsedTime,
      location,
      raw: incoming
    });

    await doc.save();

    // Broadcast to SSE clients
    broadcast('reading', doc);

    res.status(201).json({ success: true, reading: doc });
  } catch (err) {
    console.error('POST /api/sensor error', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sensor/latest?sensorId=1&limit=20
router.get('/latest', async (req, res) => {
  const sensorId = req.query.sensorId;
  const limit = Math.min(parseInt(req.query.limit || '20', 10), 1000);

  const query = sensorId ? { sensorId: Number(sensorId) } : {};
  try {
    const docs = await SensorReading.find(query)
      .sort({ time: -1 })
      .limit(limit)
      .lean()
      .exec();
    res.json({ count: docs.length, readings: docs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sensor/history/:sensorId?limit=100
router.get('/history/:sensorId', async (req, res) => {
  const sensorId = Number(req.params.sensorId);
  const limit = Math.min(parseInt(req.query.limit || '200', 10), 5000);
  try {
    const docs = await SensorReading.find({ sensorId })
      .sort({ time: -1 })
      .limit(limit)
      .lean()
      .exec();
    res.json({ count: docs.length, readings: docs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SSE endpoint - GET /api/sensor/stream
router.get('/stream', (req, res) => {
  // Required headers for SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    // If you want to override CORS per-route, you can set Access-Control-Allow-Origin here
    // 'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*'
  });
  // Send a comment to keep connection alive
  res.write(': connected\n\n');

  addClient(res);
});

module.exports = router;
