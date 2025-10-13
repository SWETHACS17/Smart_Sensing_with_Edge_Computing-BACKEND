// sse/broadcaster.js
// Simple SSE broadcaster: manages clients and broadcasts data
const clients = new Set();

function addClient(res) {
  clients.add(res);
  // When client closes:
  res.on('close', () => {
    clients.delete(res);
  });
}

function broadcast(eventName, data) {
  const payload = `data: ${JSON.stringify({ event: eventName, data })}\n\n`;
  for (const res of clients) {
    try {
      res.write(payload);
    } catch (err) {
      // client likely disconnected
      clients.delete(res);
    }
  }
}

module.exports = { addClient, broadcast };
