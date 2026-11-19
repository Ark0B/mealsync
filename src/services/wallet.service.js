// Wallet: credits from skipped meals and cancellations; can be spent on pay-per-meal tokens.
// The balance is never stored — it is always SUM(transactions), so it cannot drift.
const db = require('../db');
const { nowStamp } = require('../utils/time');

async function balance(userId, exec = db) {
  const row = await exec.get('SELECT COALESCE(SUM(amount_paise), 0) AS bal FROM wallet_transactions WHERE user_id = ?', [userId]);
  return Number(row.bal); // MySQL returns SUM() as a string
}

async function add(exec, userId, amountPaise, reason, refId = null) {
  await exec.run(
    'INSERT INTO wallet_transactions (user_id, amount_paise, reason, ref_id, created_at) VALUES (?, ?, ?, ?, ?)',
    [userId, amountPaise, reason, refId, nowStamp()],
  );
}

async function history(userId) {
  return db.all('SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY id DESC', [userId]);
}

module.exports = { balance, add, history };
