// Weekly menu, edited by the mess committee after polls / general body meetings.
const db = require('../db');
const { AppError } = require('../utils/errors');
const { nowStamp, istParts } = require('../utils/time');
const { requireFields, assertMeal, assertOneOf } = require('../utils/validate');
const audit = require('./audit.service');

async function week() {
  return db.all('SELECT * FROM menu_items ORDER BY day_of_week, meal, diet');
}

async function todays() {
  return db.all('SELECT * FROM menu_items WHERE day_of_week = ? ORDER BY meal, diet', [istParts().dayOfWeek]);
}

async function setItem(actor, body) {
  requireFields(body, ['day_of_week', 'meal', 'diet', 'items']);
  const day = Number(body.day_of_week);
  if (!Number.isInteger(day) || day < 0 || day > 6) throw new AppError(400, 'VALIDATION', 'day_of_week must be 0 (Sun) – 6 (Sat)');
  assertMeal(body.meal);
  assertOneOf(body.diet, ['veg', 'nonveg'], 'diet');
  const items = String(body.items).trim();
  if (!items || items.length > 300) throw new AppError(400, 'VALIDATION', 'items must be 1–300 characters');

  const existing = await db.get('SELECT id FROM menu_items WHERE day_of_week = ? AND meal = ? AND diet = ?', [day, body.meal, body.diet]);
  if (existing) {
    await db.run('UPDATE menu_items SET items = ?, updated_by = ?, updated_at = ? WHERE id = ?', [items, actor.id, nowStamp(), existing.id]);
  } else {
    await db.run('INSERT INTO menu_items (day_of_week, meal, diet, items, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [day, body.meal, body.diet, items, actor.id, nowStamp()]);
  }
  await audit.log(db, actor.id, 'menu_updated', 'menu', day, `${body.meal}/${body.diet}`);
  return week();
}

module.exports = { week, todays, setItem };
