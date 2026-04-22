const app = require('./app');
const { initDatabase } = require('./db');

const PORT = process.env.PORT || 4100;

async function start() {
  await initDatabase();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GradPath server running on http://10.192.145.179:${PORT}`);
  });
}

start();