// Entry point: connect to the database, make sure tables exist, then listen.
const app = require('./app');
const db = require('./db');
const config = require('./config');

(async () => {
  await db.init();
  await db.applySchema();
  app.listen(config.port, () => {
    console.log(`MealSync running on http://localhost:${config.port}  (db: ${db.client}, payments: ${config.payment.mode})`);
    console.log(`API docs:        http://localhost:${config.port}/api-docs`);
  });
})().catch((e) => {
  console.error('Failed to start:', e.message);
  process.exit(1);
});
