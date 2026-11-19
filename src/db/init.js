// npm run db:init — create all tables in the configured database.
const db = require('./index');

(async () => {
  await db.init();
  await db.applySchema();
  console.log(`Schema applied (${db.client}).`);
  await db.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
