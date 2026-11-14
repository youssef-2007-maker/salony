// Salony backend – standalone server. Start with: npm start (from backend/)
const app = require('./app');

const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => {
  console.log(`Salony backend listening on http://localhost:${PORT}`);
});

// Graceful shutdown so in-flight requests finish and the DB closes cleanly.
function shutdown() {
  console.log('Shutting down…');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

