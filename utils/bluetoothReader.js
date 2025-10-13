// utils/serialReader.js
const SerialPort = require('serialport');
const Readline = require('@serialport/parser-readline');
const sensorController = require('../controllers/sensorController');

/**
 * Generic serial reader – works with Bluetooth HC-05 or wired UART (STM32 USB).
 * Configure COM port & baud rate via .env:
 *   SERIAL_PORT=COM5
 *   SERIAL_BAUD=9600
 */
function startSerialIfConfigured(serialPortPath, baudRate = 9600) {
  if (!serialPortPath) {
    console.log('[serialReader] SERIAL_PORT not configured - serial reader disabled');
    return;
  }

  const port = new SerialPort(
    {
      path: serialPortPath,
      baudRate: Number(baudRate) || 9600,
      autoOpen: false,
    },
    (err) => {
      if (err) console.error(`[serialReader] Failed creating port ${serialPortPath}:`, err.message);
    }
  );

  const parser = port.pipe(new Readline({ delimiter: '\n' }));

  const openPort = () => {
    port.open((err) => {
      if (err) {
        console.error(`[serialReader] Error opening serial port ${serialPortPath}:`, err.message);
        setTimeout(openPort, 5000); // retry every 5s
        return;
      }
      console.log(`[serialReader] Serial port opened: ${serialPortPath} @ ${baudRate}`);
    });
  };

  openPort();

  parser.on('data', async (line) => {
    line = line.trim();
    if (!line) return;

    let incoming = null;

    try {
      incoming = JSON.parse(line);
    } catch (e) {
      const csvParts = line.split(',').map((p) => p.trim());
      if (csvParts.length >= 2 && !isNaN(Number(csvParts[0])) && !isNaN(Number(csvParts[1]))) {
        incoming = {
          sensorId: Number(csvParts[0]),
          value: Number(csvParts[1]),
          time: csvParts[2] ?? undefined,
          location: csvParts[3] ?? '',
        };
      } else {
        const kvCandidates = line.split(';').map((p) => p.trim()).filter(Boolean);
        if (kvCandidates.length > 1) {
          incoming = {};
          kvCandidates.forEach((pair) => {
            let [k, ...rest] = pair.split(/[:=]/);
            if (!k) return;
            const v = rest.join(':') || '';
            incoming[k.trim()] = v.trim();
          });
        } else {
          const sp = line.split(/\s+/);
          if (sp.length >= 2 && !isNaN(Number(sp[0])) && !isNaN(Number(sp[1]))) {
            incoming = {
              sensorId: Number(sp[0]),
              value: Number(sp[1]),
            };
          } else {
            console.warn('[serialReader] Unrecognized serial line format:', line);
            return;
          }
        }
      }
    }

    try {
      const saved = await sensorController.processIncoming(incoming);
      console.log(
        `[serialReader] Saved sensor ${saved.sensorId || '-'} | value ${saved.value} | status ${saved.status}`
      );
    } catch (err) {
      console.error('[serialReader] Failed to process incoming line:', err.message || err);
    }
  });

  port.on('close', () => {
    console.warn('[serialReader] Serial port closed. Retrying in 5s...');
    setTimeout(openPort, 5000);
  });

  port.on('error', (err) => {
    console.error('[serialReader] Serial port error:', err.message);
  });
}

module.exports = { startSerialIfConfigured };
