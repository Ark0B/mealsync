// Counter verification: staff scan the student's rotating QR pass.
// Replaces "show your card if asked / the worker remembers your face".
const db = require('../db');
const { AppError } = require('../utils/errors');
const { nowStamp, istParts, mealStart, mealEnd } = require('../utils/time');
const clock = require('../utils/clock');
const { assertMeal } = require('../utils/validate');
const passToken = require('../utils/passToken');
const subscriptions = require('./subscriptions.service');
const settings = require('./settings.service');

// Every attempt, good or bad, is written to scan_attempts (audit trail + fraud signals).
async function logAttempt(userId, staffId, date, meal, outcome) {
  await db.run(
    'INSERT INTO scan_attempts (user_id, staff_id, meal_date, meal, outcome, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, staffId, date, meal, outcome, nowStamp()],
  );
}

const MESSAGES = {
  invalid_token: [400, 'Not a valid MealSync pass'],
  expired_token: [400, 'Pass expired — ask the student to refresh the app (possible screenshot)'],
  account_inactive: [403, 'Student account is not active'],
  meal_skipped: [403, 'Student skipped this meal and was credited'],
  no_entitlement: [403, 'No subscription or token for this meal'],
  outside_meal_hours: [403, 'Outside serving hours for this meal'],
  already_served: [409, 'Already served this meal'],
};

async function deny(outcome, userId, staffId, date, meal, extra = {}) {
  await logAttempt(userId, staffId, date, meal, outcome);
  const [status, message] = MESSAGES[outcome];
  throw new AppError(status, outcome.toUpperCase(), message, extra);
}

async function scan(staff, body) {
  const meal = body.meal;
  assertMeal(meal);
  const now = clock.now();
  const date = istParts(now).date;

  // 1. Is the pass genuine and fresh?
  const check = passToken.verify(body.token, now);
  if (!check.ok) return deny(check.reason, check.userId || null, staff.id, date, meal);
  const userId = check.userId;

  // 2. Is the account active?
  const student = await db.get('SELECT id, name, roll_no, diet_pref, is_day_scholar, photo_url, status FROM users WHERE id = ?', [userId]);
  if (!student || student.status !== 'approved') return deny('account_inactive', student ? userId : null, staff.id, date, meal);

  // 3. Did they skip this meal (and get money back)?
  const skipped = await db.get('SELECT id FROM skips WHERE user_id = ? AND meal_date = ? AND meal = ?', [userId, date, meal]);
  if (skipped) return deny('meal_skipped', userId, staff.id, date, meal);

  // 4. What entitles them: a subscription or a paid token?
  const sub = await subscriptions.findCovering(db, userId, date, meal);
  const token = sub ? null : await db.get(
    `SELECT * FROM meal_tokens WHERE user_id = ? AND meal_date = ? AND meal = ? AND status IN ('active','used')`,
    [userId, date, meal],
  );
  if (!sub && !token) return deny('no_entitlement', userId, staff.id, date, meal);

  // 5. Serving window (late-plate holders get a grace period after the window).
  const start = mealStart(date, meal);
  let end = mealEnd(date, meal);
  const late = await db.get('SELECT id FROM late_plates WHERE user_id = ? AND meal_date = ? AND meal = ?', [userId, date, meal]);
  if (late) end = new Date(end.getTime() + (await settings.getNumber('late_plate_grace_minutes')) * 60000);
  if (now < start || now >= end) return deny('outside_meal_hours', userId, staff.id, date, meal);

  // 6. Serve exactly once. The UNIQUE(user_id, meal_date, meal) key is the final guard,
  //    even if two counters scan the same pass at the same moment.
  const diet = sub ? sub.diet : token.diet;
  try {
    await db.transaction(async (tx) => {
      await tx.run(
        'INSERT INTO meal_logs (user_id, meal_date, meal, source, ref_id, served_by, served_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [userId, date, meal, sub ? 'subscription' : 'token', sub ? sub.id : token.id, staff.id, nowStamp()],
      );
      if (token) await tx.run(`UPDATE meal_tokens SET status = 'used', used_at = ? WHERE id = ?`, [nowStamp(), token.id]);
    });
  } catch (e) {
    if (e.isDuplicate) {
      const prev = await db.get('SELECT served_at FROM meal_logs WHERE user_id = ? AND meal_date = ? AND meal = ?', [userId, date, meal]);
      return deny('already_served', userId, staff.id, date, meal, { servedAt: prev && prev.served_at, student: { name: student.name, roll_no: student.roll_no } });
    }
    throw e;
  }
  await logAttempt(userId, staff.id, date, meal, 'served');

  return {
    ok: true,
    meal,
    source: sub ? 'subscription' : 'token',
    diet,
    latePlate: Boolean(late),
    student: { id: student.id, name: student.name, roll_no: student.roll_no, photo_url: student.photo_url, is_day_scholar: student.is_day_scholar },
  };
}

async function recentForStaff(staffId, limit = 30) {
  return db.all(
    `SELECT a.id, a.meal_date, a.meal, a.outcome, a.created_at, u.name, u.roll_no
       FROM scan_attempts a LEFT JOIN users u ON u.id = a.user_id
      WHERE a.staff_id = ? ORDER BY a.id DESC LIMIT ?`, [staffId, limit],
  );
}

module.exports = { scan, recentForStaff, MESSAGES };
