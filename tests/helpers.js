// Shared test fixtures: fresh database, users, frozen clock, and API shortcuts.
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const db = require('../src/db');
const clock = require('../src/utils/clock');
const { seedReference } = require('../src/db/seedData');
const { signToken } = require('../src/services/auth.service');
const { nowStamp } = require('../src/utils/time');

const PASSWORD = 'Password@123';
let hash = null;
let counter = 0;

// IST wall-clock -> UTC Date. ist('2026-11-20 13:00') is 1 pm in Delhi.
const ist = (s) => new Date(`${s.replace(' ', 'T')}:00+05:30`);

async function setupDb() {
  await db.close(); // allow calling twice in one file
  await db.init();
  if (db.client === 'mysql') {
    // CI runs against a real MySQL: wipe tables between files.
    await db.run('SET FOREIGN_KEY_CHECKS = 0');
    for (const t of ['audit_log', 'settings', 'poll_votes', 'poll_options', 'polls', 'menu_items', 'ratings', 'complaints',
      'wallet_transactions', 'scan_attempts', 'meal_logs', 'late_plates', 'skips', 'meal_tokens', 'subscriptions',
      'payments', 'meal_prices', 'plans', 'users']) {
      await db.run(`DROP TABLE IF EXISTS ${t}`);
    }
    await db.run('SET FOREIGN_KEY_CHECKS = 1');
  }
  await db.applySchema();
  await seedReference(db);
}

async function teardownDb() {
  clock.setNow(null);
  await db.close();
}

async function makeUser(overrides = {}) {
  if (!hash) hash = await bcrypt.hash(PASSWORD, 4); // low cost: tests only
  counter += 1;
  const u = {
    name: `User ${counter}`,
    email: `user${counter}@test.local`,
    role: 'student',
    is_committee: 0,
    roll_no: overrides.role && overrides.role !== 'student' ? null : `ROLL${counter}`,
    is_day_scholar: 0,
    diet_pref: 'veg',
    status: 'approved',
    ...overrides,
  };
  const res = await db.run(
    `INSERT INTO users (name, email, password_hash, role, is_committee, roll_no, is_day_scholar, diet_pref, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [u.name, u.email, hash, u.role, u.is_committee, u.roll_no, u.is_day_scholar, u.diet_pref, u.status, nowStamp()],
  );
  const user = await db.get('SELECT * FROM users WHERE id = ?', [res.insertId]);
  return { ...user, token: signToken(user), auth: { Authorization: `Bearer ${signToken(user)}` } };
}

const api = () => request(app);

async function planId(code) {
  return (await db.get('SELECT id FROM plans WHERE code = ?', [code])).id;
}

// Subscribe + pay through the mock gateway; returns the active subscription.
async function subscribeAndPay(user, code, month) {
  const sub = await api().post('/api/subscriptions').set(user.auth).send({ planId: await planId(code), month });
  if (sub.status !== 201) throw new Error(`subscribe failed: ${JSON.stringify(sub.body)}`);
  await payOrder(user, sub.body.order.orderId);
  return (await api().get('/api/subscriptions/mine').set(user.auth)).body.find((s) => s.id === sub.body.subscription.id);
}

async function payOrder(user, orderId) {
  const co = await api().post(`/api/payments/mock-checkout/${orderId}`).set(user.auth);
  const v = await api().post('/api/payments/verify').set(user.auth).send(co.body);
  if (v.status !== 200) throw new Error(`verify failed: ${JSON.stringify(v.body)}`);
  return v.body;
}

module.exports = { api, app, db, clock, ist, setupDb, teardownDb, makeUser, planId, subscribeAndPay, payOrder, PASSWORD };
