// controllers/sensorController.js
const Sensor = require('../models/Sensor');
const pythonCaller = require('../utils/pythonCaller');
const { broadcast } = require('../sse/broadcaster');

/**
 * Normalize incoming object to { sensorId, value, time, location, raw }
 * Accepts many key variants (sensor id, sensorId, id, etc.)
 */
function normalizeIncoming(incoming) {
  const sensorId = incoming.sensorId ?? incoming['sensor id'] ?? incoming.sensor_id ?? incoming.id ?? incoming.devId;
  const value = incoming.value ?? incoming.val ?? incoming.temperature ?? incoming.temp;
  const location = incoming.location ?? incoming['location of sensor'] ?? incoming.loc ?? '';
  const time = incoming.time ?? incoming.Time ?? incoming.timestamp ?? incoming.t;
  return {
    sensorId: sensorId === undefined ? undefined : Number(sensorId),
    value: value === undefined ? undefined : Number(value),
    location: location || '',
    time: time ? new Date(time) : new Date(),
    raw: incoming
  };
}

/**
 * Main process function.
 * - Normalize
 * - Fetch recent history (N previous values)
 * - Call Python Z-score script to classify current reading
 * - Save to DB with the returned status
 * - Broadcast via SSE
 */
async function processIncoming(incoming, options = {}) {
  const N_HISTORY = options.historyCount ?? 50;

  const normalized = normalizeIncoming(incoming);
  if (normalized.sensorId === undefined || Number.isNaN(normalized.value)) {
    throw new Error('Invalid incoming: missing sensorId or value');
  }

  // fetch recent history values for this sensor (exclude the current moment)
  const recentDocs = await Sensor.find({ sensorId: normalized.sensorId })
    .sort({ time: -1 })
    .limit(N_HISTORY)
    .lean()
    .exec();

  // Extract numeric history values (most recent first)
  const historyValues = recentDocs.map(d => Number(d.value)).filter(v => !Number.isNaN(v));

  // Call Python to get z-score and status
  let pyResult = { status: 'Normal', zscore: null };
  try {
    pyResult = await pythonCaller.computeStatus(historyValues, normalized.value);
    if (!pyResult || !pyResult.status) pyResult = { status: 'Normal', zscore: null };
  } catch (err) {
    console.error('[sensorController] Python caller error:', err);
    pyResult = { status: 'Normal', zscore: null };
  }

  // Build DB document
  const doc = new Sensor({
    sensorId: normalized.sensorId,
    value: normalized.value,
    status: pyResult.status,
    time: normalized.time,
    location: normalized.location,
    raw: normalized.raw,
    zscore: pyResult.zscore ?? null // optional field
  });

  const saved = await doc.save();

  // Broadcast new reading to SSE clients
  try {
    broadcast('reading', saved);
  } catch (err) {
    console.warn('[sensorController] broadcast failed', err);
  }

  return saved;
}

module.exports = {
  processIncoming,
  normalizeIncoming
};
