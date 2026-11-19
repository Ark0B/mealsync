// 1–5 star meal ratings. Only students who were actually served that meal can rate it.
const db = require('../db');
const { AppError } = require('../utils/errors');
const { nowStamp, today, addDays } = require('../utils/time');
const { requireFields, assertDate, assertMeal } = require('../utils/validate');

async function rate(user, body) {
  requireFields(body, ['date', 'meal', 'stars']);
  assertDate(body.date);
  assertMeal(body.meal);
  const stars = Number(body.stars);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw new AppError(400, 'VALIDATION', 'stars must be 1–5');
  const served = await db.get('SELECT id FROM meal_logs WHERE user_id = ? AND meal_date = ? AND meal = ?', [user.id, body.date, body.meal]);
  if (!served) throw new AppError(403, 'NOT_SERVED', 'You can only rate meals you were served');
  try {
    const res = await db.run(
      'INSERT INTO ratings (user_id, meal_date, meal, stars, comment, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [user.id, body.date, body.meal, stars, body.comment ? String(body.comment).slice(0, 300) : null, nowStamp()],
    );
    return db.get('SELECT * FROM ratings WHERE id = ?', [res.insertId]);
  } catch (e) {
    if (e.isDuplicate) throw new AppError(409, 'DUPLICATE', 'You already rated this meal');
    throw e;
  }
}

// Average rating per meal type and the lowest-rated recent meals — input for committee meetings.
async function summary(days = 30) {
  const from = addDays(today(), -days);
  const byMeal = await db.all(
    `SELECT meal, COUNT(*) AS ratings, AVG(stars) AS avg_stars FROM ratings WHERE meal_date >= ? GROUP BY meal ORDER BY meal`, [from],
  );
  const lowest = await db.all(
    `SELECT meal_date, meal, COUNT(*) AS ratings, AVG(stars) AS avg_stars FROM ratings WHERE meal_date >= ?
      GROUP BY meal_date, meal HAVING COUNT(*) >= 1 ORDER BY avg_stars ASC, meal_date DESC LIMIT 10`, [from],
  );
  const fix = (r) => ({ ...r, ratings: Number(r.ratings), avg_stars: Math.round(Number(r.avg_stars) * 100) / 100 });
  return { from, byMeal: byMeal.map(fix), lowest: lowest.map(fix) };
}

module.exports = { rate, summary };
