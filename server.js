require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const bodyParser = require('body-parser');

const sensorRoutes = require('./routes/sensorRoutes');
const { startSerialIfConfigured } = require('./serial/reader');
const { addClient } = require('./sse/broadcaster');

const app = express();

// Middlewares
app.use(cors());
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use('/api/sensor', sensorRoutes);

// ✅ SSE route for frontend EventSource connection
app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  addClient(res);
});

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/smart_sensing';
mongoose.connect(MONGO_URI)
  .then(() => console.log(`[server] Connected to MongoDB: ${MONGO_URI}`))
  .catch(err => console.error('[server] MongoDB error:', err));

// Start serial reader if SERIAL_PORT is set
const SERIAL_PORT = process.env.SERIAL_PORT;
const SERIAL_BAUDRATE = process.env.SERIAL_BAUDRATE || 9600;
startSerialIfConfigured(SERIAL_PORT, SERIAL_BAUDRATE);

// Start backend
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`[server] Running at http://localhost:${PORT}`);
});
