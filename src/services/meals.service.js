// Meal skips (opt out in advance and get credit) and late-plate reservations.
// This is the fix for "if you miss a meal your money and the food are wasted".
const db = require('../db');
const { AppError } = require('../utils/errors');
const { nowStamp, mealStart, mealEnd, addDays } = require('../utils/time');
const clock = require('../utils/clock');
const { requireFields, assertDate, assertMeal, toId } = require('../utils/validate');
const { skipCredit } = require('../utils/pricing');
const subscriptions = require('./subscriptions.service');
const wallet = require('./wallet.service');
const settings = require('./settings.service');

async function cutoffFor(date, meal) {
  const hours = await settings.getNumber('skip_cutoff_hours');
  return new Date(mealStart(date, meal).getTime() - hours * 3600000);
}

async function createSkip(user, body) {
  requireFields(body, ['date', 'meal']);
  assertDate(body.date);
  assertMeal(body.meal);

  const sub = await subscriptions.findCovering(db, user.id, body.date, body.meal);
  if (!sub) throw new AppError(400, 'NO_SUBSCRIPTION', 'No subscription covers this meal');

  const cutoff = await cutoffFor(body.date, body.meal);
  if (clock.now() >= cutoff) {
    throw new AppError(400, 'CUTOFF_PASSED', 'Too late to skip this meal', { cutoff: cutoff.toISOString() });
  }

  const month = body.date.slice(0, 7);
  const nextMonthStart = `${addDays(`${month}-01`, 32).slice(0, 7)}-01`;
  const used = await db.get(
    'SELECT COUNT(*) AS n FROM skips WHERE user_id = ? AND meal_date >= ? AND meal_date < ?',
    [user.id, `${month}-01`, nextMonthStart],
  );
  const max = await settings.getNumber('max_skips_per_month');
  if (Number(used.n) >= max) throw new AppError(400, 'SKIP_LIMIT', `Monthly skip limit (${max}) reached`);

  const rate = await settings.getNumber('skip_credit_rate');
  const credit = skipCredit(sub.plan_price, month, sub.meals.split(',').length, rate);

  try {
    return await db.transaction(async (tx) => {
      const res = await tx.run(
        'INSERT INTO skips (user_id, subscription_id, meal_date, meal, credit_paise, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [user.id, sub.id, body.date, body.meal, credit, nowStamp()],
      );
      if (credit > 0) await wallet.add(tx, user.id, credit, 'skip_credit', res.insertId);
      return tx.get('SELECT * FROM skips WHERE id = ?', [res.insertId]);
    });
  } catch (e) {
    if (e.isDuplicate) throw new AppError(409, 'DUPLICATE', 'Meal already skipped');
    throw e;
  }
}

// Undo a skip (only before the cutoff) and take the credit back.
async function cancelSkip(user, id) {
  id = toId(id);
  const skip = await db.get('SELECT * FROM skips WHERE id = ? AND user_id = ?', [id, user.id]);
  if (!skip) throw new AppError(404, 'NOT_FOUND', 'Skip not found');
  if (clock.now() >= (await cutoffFor(skip.meal_date, skip.meal))) {
    throw new AppError(400, 'CUTOFF_PASSED', 'Too late to undo this skip');
  }
  await db.transaction(async (tx) => {
    await tx.run('DELETE FROM skips WHERE id = ?', [id]);
    if (skip.credit_paise > 0) await wallet.add(tx, user.id, -skip.credit_paise, 'skip_reversal', id);
  });
}

async function mySkips(userId) {
  return db.all('SELECT * FROM skips WHERE user_id = ? ORDER BY meal_date DESC, meal', [userId]);
}

// Late plate: "keep my food aside, I will come after the counter closes".
async function createLatePlate(user, body) {
  requireFields(body, ['date', 'meal']);
  assertDate(body.date);
  assertMeal(body.meal);
  if (clock.now() >= mealEnd(body.date, body.meal)) throw new AppError(400, 'MEAL_OVER', 'Request a late plate before the meal ends');

  const sub = await subscriptions.findCovering(db, user.id, body.date, body.meal);
  const token = await db.get(
    `SELECT id FROM meal_tokens WHERE user_id = ? AND meal_date = ? AND meal = ? AND status = 'active'`,
    [user.id, body.date, body.meal],
  );
  if (!sub && !token) throw new AppError(400, 'NO_ENTITLEMENT', 'You have no subscription or token for this meal');
  const skipped = await db.get('SELECT id FROM skips WHERE user_id = ? AND meal_date = ? AND meal = ?', [user.id, body.date, body.meal]);
  if (skipped) throw new AppError(409, 'MEAL_SKIPPED', 'You skipped this meal; undo the skip first');

  try {
    const res = await db.run('INSERT INTO late_plates (user_id, meal_date, meal, created_at) VALUES (?, ?, ?, ?)',
      [user.id, body.date, body.meal, nowStamp()]);
    return db.get('SELECT * FROM late_plates WHERE id = ?', [res.insertId]);
  } catch (e) {
    if (e.isDuplicate) throw new AppError(409, 'DUPLICATE', 'Late plate already requested');
    throw e;
  }
}

async function myLatePlates(userId) {
  return db.all('SELECT * FROM late_plates WHERE user_id = ? ORDER BY meal_date DESC', [userId]);
}

async function history(userId) {
  return db.all('SELECT meal_date, meal, source, served_at FROM meal_logs WHERE user_id = ? ORDER BY meal_date DESC, served_at DESC LIMIT 200', [userId]);
}

module.exports = { createSkip, cancelSkip, mySkips, createLatePlate, myLatePlates, history, cutoffFor };
