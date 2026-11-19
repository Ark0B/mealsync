// Runtime-editable business rules (cutoffs, credit rates). Defaults live in config.
const db = require('../db');
const config = require('../config');
const { AppError } = require('../utils/errors');
const audit = require('./audit.service');

// Allowed range for each setting, so a typo cannot set a 500 % refund.
const RULES = {
  skip_cutoff_hours: [0, 48],
  skip_credit_rate: [0, 1],
  max_skips_per_month: [0, 124],
  cancel_refund_rate: [0, 1],
  late_plate_grace_minutes: [0, 180],
};

async function getAll() {
  const rows = await db.all('SELECT setting_key, setting_value FROM settings');
  const result = { ...config.defaultSettings };
  rows.forEach((r) => { result[r.setting_key] = r.setting_value; });
  return result;
}

async function getNumber(key) {
  const all = await getAll();
  return Number(all[key]);
}

async function update(actorId, changes) {
  const entries = Object.entries(changes || {});
  if (!entries.length) throw new AppError(400, 'VALIDATION', 'No settings given');
  for (const [key, value] of entries) {
    if (!RULES[key]) throw new AppError(400, 'VALIDATION', `Unknown setting: ${key}`);
    const n = Number(value);
    const [min, max] = RULES[key];
    if (Number.isNaN(n) || n < min || n > max) {
      throw new AppError(400, 'VALIDATION', `${key} must be between ${min} and ${max}`);
    }
  }
  await db.transaction(async (tx) => {
    for (const [key, value] of entries) {
      const exists = await tx.get('SELECT setting_key FROM settings WHERE setting_key = ?', [key]);
      if (exists) await tx.run('UPDATE settings SET setting_value = ? WHERE setting_key = ?', [String(value), key]);
      else await tx.run('INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)', [key, String(value)]);
      await audit.log(tx, actorId, 'setting_changed', 'settings', null, `${key}=${value}`);
    }
  });
  return getAll();
}

module.exports = { getAll, getNumber, update, RULES };
