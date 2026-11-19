// npm run seed               -> tables + reference data + demo accounts (development)
// npm run seed -- --no-demo  -> tables + reference data only (production)
// Safe to run repeatedly: existing rows are left alone.
const db = require('./index');
const { seedReference, seedDemoUsers } = require('./seedData');

const withDemo = !process.argv.includes('--no-demo');

(async () => {
  await db.init();
  await db.applySchema();
  await seedReference(db);
  if (withDemo) await seedDemoUsers(db);
  console.log(`Seeded plans, meal prices and weekly menu${withDemo ? ' + demo users (password: MealSync@123)' : ''}.`);
  await db.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
