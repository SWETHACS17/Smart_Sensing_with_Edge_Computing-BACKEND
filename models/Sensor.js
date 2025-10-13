// models/Sensor.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const SensorSchema = new Schema({
  sensorId: { type: Number, required: true, index: true },
  value: { type: Number, required: true },
  status: { type: String, default: 'Normal' },
  time: { type: Date, default: Date.now },
  location: { type: String, default: '' },
  raw: { type: Schema.Types.Mixed },
  zscore: { type: Number, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Sensor', SensorSchema);
