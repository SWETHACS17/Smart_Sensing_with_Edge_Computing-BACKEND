const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const { processIncoming } = require('../controllers/sensorController');

function startSerialIfConfigured(serialPortPath, baudRate = 9600) {
  if (!serialPortPath) {
    console.log('[serial/reader] SERIAL_PORT not configured - serial reader disabled');
    return;
  }

  const port = new SerialPort({
    path: serialPortPath,
    baudRate: Number(baudRate),
    autoOpen: false,
  });

  const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

  port.open((err) => {
    if (err) return console.error(`[serial/reader] Error opening ${serialPortPath}:`, err.message);
    console.log(`[serial/reader] Serial port opened: ${serialPortPath} @ ${baudRate}`);
  });

  parser.on('data', async (line) => {
    line = line.trim();
    if (!line) return;

    try {
      let incoming;
      try {
        incoming = JSON.parse(line);
      } catch {
        const parts = line.split(',').map(p => p.trim());
        if (parts.length >= 2) {
          incoming = {
            sensorId: Number(parts[0]),
            value: Number(parts[1]),
            time: parts[2],
            location: parts[3] || '',
          };
        } else {
          console.warn('[serial/reader] Could not parse:', line);
          return;
        }
      }

      await processIncoming(incoming); // ✅ Main processing

    } catch (err) {
      console.error('[serial/reader] Error:', err);
    }
  });

  port.on('error', (err) => {
    console.error('[serial/reader] Serial port error:', err);
  });
}

module.exports = { startSerialIfConfigured };
