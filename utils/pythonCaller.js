// utils/pythonCaller.js
const { spawnSync } = require('child_process');
const path = require('path');

const PYTHON_PATH = process.env.PYTHON_PATH || 'python3' || 'python';
const ZSCORE_SCRIPT = process.env.ZSCORE_SCRIPT_PATH || path.join(__dirname, '..', 'python', 'zscore.py');

/**
 * computeStatus(historyValues: number[], currentValue: number) -> Promise<{status, zscore}>
 * Calls the Python script with JSON on stdin and expects JSON on stdout.
 */
function computeStatus(historyValues = [], currentValue = null) {
  return new Promise((resolve, reject) => {
    if (currentValue === null || Number.isNaN(Number(currentValue))) {
      return reject(new Error('Invalid currentValue'));
    }

    const payload = { history: historyValues, value: Number(currentValue) };

    // spawnSync to invoke Python and pass JSON via stdin
    try {
      const result = spawnSync(PYTHON_PATH, [ZSCORE_SCRIPT], {
        input: JSON.stringify(payload),
        encoding: 'utf8',
        timeout: 5000 // ms
      });

      if (result.error) {
        return reject(result.error);
      }

      if (result.status !== 0 && result.status !== null) {
        // Python returned non-zero. But maybe it printed JSON anyway. Try to parse stdout.
        // console.warn('python exited non-zero', result.stderr, result.stdout);
      }

      const stdout = (result.stdout || '').trim();
      if (!stdout) {
        // No output — treat as Normal
        return resolve({ status: 'Normal', zscore: null });
      }

      try {
        const parsed = JSON.parse(stdout);
        return resolve(parsed);
      } catch (err) {
        // stdout is not JSON
        console.warn('[pythonCaller] could not parse python stdout as JSON:', stdout);
        return resolve({ status: 'Normal', zscore: null });
      }
    } catch (err) {
      return reject(err);
    }
  });
}

module.exports = { computeStatus };
