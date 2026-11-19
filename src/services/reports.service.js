// Kitchen headcount, monthly reports, CSV export and fraud signals for the mess office.
const db = require('../db');
const { AppError } = require('../utils/errors');
const { MEAL_CODES, monthRange, isValidDate } = require('../utils/time');

const n = (v) => Number(v || 0); // MySQL returns SUM()/AVG() as strings

function assertMonth(month) {
  if (!/^\d{4}-\d{2}$/.test(month || '')) throw new AppError(400, 'VALIDATION', 'month must be YYYY-MM');
}

// Expected plates per meal for a date, split veg / non-veg — the number the kitchen cooks for.
async function headcount(date) {
  if (!isValidDate(date)) throw new AppError(400, 'VALIDATION', 'date must be YYYY-MM-DD');
  const subs = await db.all(
    `SELECT s.user_id, p.diet, p.meals FROM subscriptions s JOIN plans p ON p.id = s.plan_id
      WHERE s.status IN ('active','cancel_requested','cancelled') AND s.start_date <= ? AND s.end_date >= ?`, [date, date],
  );
  const skips = await db.all('SELECT user_id, meal FROM skips WHERE meal_date = ?', [date]);
  const tokens = await db.all(`SELECT meal, diet FROM meal_tokens WHERE meal_date = ? AND status IN ('active','used')`, [date]);
  const late = await db.all('SELECT meal, COUNT(*) AS c FROM late_plates WHERE meal_date = ? GROUP BY meal', [date]);
  const served = await db.all('SELECT meal, COUNT(*) AS c FROM meal_logs WHERE meal_date = ? GROUP BY meal', [date]);

  const skipped = new Set(skips.map((s) => `${s.user_id}:${s.meal}`));
  const meals = {};
  for (const m of MEAL_CODES) {
    const row = { meal: m, subscribed: 0, skipped: 0, tokens: 0, expected: { veg: 0, nonveg: 0, total: 0 }, latePlates: 0, served: 0 };
    for (const s of subs) {
      if (!s.meals.split(',').includes(m)) continue;
      row.subscribed += 1;
      if (skipped.has(`${s.user_id}:${m}`)) row.skipped += 1;
      else row.expected[s.diet] += 1;
    }
    for (const t of tokens) if (t.meal === m) { row.tokens += 1; row.expected[t.diet] += 1; }
    row.expected.total = row.expected.veg + row.expected.nonveg;
    row.latePlates = n((late.find((l) => l.meal === m) || {}).c);
    row.served = n((served.find((l) => l.meal === m) || {}).c);
    meals[m] = row;
  }
  return { date, meals };
}

async function summary(month) {
  assertMonth(month);
  const { start, next } = monthRange(month);
  const revenue = await db.all(
    `SELECT purpose, COUNT(*) AS payments, SUM(amount_paise) AS amount_paise FROM payments
      WHERE status = 'paid' AND paid_at >= ? AND paid_at < ? GROUP BY purpose`, [start, next],
  );
  const subscriptions = await db.all(
    `SELECT p.name AS plan, COUNT(*) AS count FROM subscriptions s JOIN plans p ON p.id = s.plan_id
      WHERE s.status <> 'pending_payment' AND s.start_date < ? AND s.end_date >= ? GROUP BY p.name ORDER BY p.name`, [next, start],
  );
  const served = await db.all(
    'SELECT meal, COUNT(*) AS count FROM meal_logs WHERE meal_date >= ? AND meal_date < ? GROUP BY meal ORDER BY meal', [start, next],
  );
  const skips = await db.get(
    'SELECT COUNT(*) AS count, SUM(credit_paise) AS credit_paise FROM skips WHERE meal_date >= ? AND meal_date < ?', [start, next],
  );
  const complaints = await db.all(
    'SELECT status, COUNT(*) AS count FROM complaints WHERE created_at >= ? AND created_at < ? GROUP BY status', [start, next],
  );
  const denied = await db.all(
    `SELECT outcome, COUNT(*) AS count FROM scan_attempts WHERE meal_date >= ? AND meal_date < ? AND outcome <> 'served'
      GROUP BY outcome ORDER BY count DESC`, [start, next],
  );
  return {
    month,
    revenue: revenue.map((r) => ({ purpose: r.purpose, payments: n(r.payments), amount_paise: n(r.amount_paise) })),
    totalRevenuePaise: revenue.reduce((s, r) => s + n(r.amount_paise), 0),
    subscriptions: subscriptions.map((r) => ({ plan: r.plan, count: n(r.count) })),
    mealsServed: served.map((r) => ({ meal: r.meal, count: n(r.count) })),
    skips: { count: n(skips.count), creditPaise: n(skips.credit_paise) },
    complaints: complaints.map((r) => ({ status: r.status, count: n(r.count) })),
    deniedScans: denied.map((r) => ({ outcome: r.outcome, count: n(r.count) })),
  };
}

// Students with repeated denied scans: pass sharing, screenshot reuse, or trying a second plate.
async function fraudSignals(month, threshold = 3) {
  assertMonth(month);
  const { start, next } = monthRange(month);
  const rows = await db.all(
    `SELECT a.user_id, u.name, u.roll_no, COUNT(*) AS denied,
            SUM(CASE WHEN a.outcome = 'already_served' THEN 1 ELSE 0 END) AS repeat_attempts,
            SUM(CASE WHEN a.outcome = 'expired_token' THEN 1 ELSE 0 END) AS stale_passes,
            SUM(CASE WHEN a.outcome = 'no_entitlement' THEN 1 ELSE 0 END) AS no_entitlement
       FROM scan_attempts a JOIN users u ON u.id = a.user_id
      WHERE a.meal_date >= ? AND a.meal_date < ? AND a.outcome <> 'served'
      GROUP BY a.user_id, u.name, u.roll_no HAVING COUNT(*) >= ? ORDER BY denied DESC`, [start, next, threshold],
  );
  return rows.map((r) => ({
    ...r, denied: n(r.denied), repeat_attempts: n(r.repeat_attempts), stale_passes: n(r.stale_passes), no_entitlement: n(r.no_entitlement),
  }));
}

// CSV opens directly in Excel, so the mess office keeps its existing spreadsheet workflow.
async function mealLogCsv(month) {
  assertMonth(month);
  const { start, next } = monthRange(month);
  const rows = await db.all(
    `SELECT l.meal_date, l.meal, u.roll_no, u.name, l.source, l.served_at FROM meal_logs l JOIN users u ON u.id = l.user_id
      WHERE l.meal_date >= ? AND l.meal_date < ? ORDER BY l.meal_date, l.meal, u.roll_no`, [start, next],
  );
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    // Quote fields with commas/quotes; prefix formula characters to stop CSV injection in Excel.
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const header = 'date,meal,roll_no,name,source,served_at_utc';
  return [header, ...rows.map((r) => [r.meal_date, r.meal, r.roll_no, r.name, r.source, r.served_at].map(esc).join(','))].join('\n');
}

module.exports = { headcount, summary, fraudSignals, mealLogCsv };
