// Monthly plans and subscriptions (replaces the handwritten monthly paper card).
const db = require('../db');
const { AppError } = require('../utils/errors');
const { nowStamp, today, addDays, daysInMonth } = require('../utils/time');
const { requireFields, toId } = require('../utils/validate');
const { proratedPrice, cancellationRefund } = require('../utils/pricing');
const payments = require('./payments.service');
const wallet = require('./wallet.service');
const settings = require('./settings.service');
const audit = require('./audit.service');

// Statuses that still entitle the student to food on dates inside [start_date, end_date].
const ENTITLED = `('active','cancel_requested','cancelled')`;

// Hostellers see hostel plans, day scholars see day-scholar plans.
async function listPlans(user) {
  if (user && user.role === 'student') {
    return db.all('SELECT * FROM plans WHERE active = 1 AND for_day_scholar = ? ORDER BY price_paise', [user.is_day_scholar]);
  }
  return db.all('SELECT * FROM plans ORDER BY for_day_scholar, price_paise');
}

async function updatePlan(actor, planId, body) {
  const plan = await db.get('SELECT * FROM plans WHERE id = ?', [planId]);
  if (!plan) throw new AppError(404, 'NOT_FOUND', 'Plan not found');
  const price = body.price_paise !== undefined ? Number(body.price_paise) : plan.price_paise;
  const active = body.active !== undefined ? (body.active ? 1 : 0) : plan.active;
  if (!Number.isInteger(price) || price <= 0) throw new AppError(400, 'VALIDATION', 'price_paise must be a positive integer');
  await db.run('UPDATE plans SET price_paise = ?, active = ? WHERE id = ?', [price, active, planId]);
  await audit.log(db, actor.id, 'plan_updated', 'plan', planId, `price=${price} active=${active}`);
  return db.get('SELECT * FROM plans WHERE id = ?', [planId]);
}

// The subscription (with plan details) that covers this user, date and meal — or null.
async function findCovering(exec, userId, date, meal) {
  const rows = await exec.all(
    `SELECT s.*, p.meals, p.diet, p.name AS plan_name, p.price_paise AS plan_price
       FROM subscriptions s JOIN plans p ON p.id = s.plan_id
      WHERE s.user_id = ? AND s.status IN ${ENTITLED} AND s.start_date <= ? AND s.end_date >= ?`,
    [userId, date, date],
  );
  return rows.find((r) => r.meals.split(',').includes(meal)) || null;
}

// Subscribe for the current or next month. Joining mid-month pays only for the remaining days.
async function create(user, body) {
  requireFields(body, ['planId', 'month']);
  const planId = toId(body.planId, 'planId');
  if (!/^\d{4}-\d{2}$/.test(body.month)) throw new AppError(400, 'VALIDATION', 'month must be YYYY-MM');

  const plan = await db.get('SELECT * FROM plans WHERE id = ? AND active = 1', [planId]);
  if (!plan) throw new AppError(404, 'NOT_FOUND', 'Plan not found');
  if (plan.for_day_scholar !== user.is_day_scholar) {
    throw new AppError(400, 'PLAN_NOT_ELIGIBLE', plan.for_day_scholar ? 'This plan is for day scholars' : 'This plan is for hostellers');
  }

  const t = today();
  const thisMonth = t.slice(0, 7);
  const nextMonth = addDays(`${thisMonth}-01`, 32).slice(0, 7);
  if (![thisMonth, nextMonth].includes(body.month)) {
    throw new AppError(400, 'VALIDATION', 'You can subscribe only for the current or the next month');
  }
  const [y, m] = body.month.split('-').map(Number);
  const start = body.month === thisMonth ? t : `${body.month}-01`;
  const end = `${body.month}-${String(daysInMonth(y, m)).padStart(2, '0')}`;

  const overlap = await db.get(
    `SELECT id FROM subscriptions WHERE user_id = ? AND status IN ('pending_payment','active','cancel_requested')
        AND start_date <= ? AND end_date >= ?`, [user.id, end, start],
  );
  if (overlap) throw new AppError(409, 'ALREADY_SUBSCRIBED', 'You already have a subscription for this period');

  const amount = proratedPrice(plan.price_paise, start);
  return db.transaction(async (tx) => {
    const res = await tx.run(
      `INSERT INTO subscriptions (user_id, plan_id, start_date, end_date, amount_paise, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending_payment', ?)`,
      [user.id, plan.id, start, end, amount, nowStamp()],
    );
    const order = await payments.createOrder(tx, user.id, 'subscription', res.insertId, amount);
    return { subscription: await tx.get('SELECT * FROM subscriptions WHERE id = ?', [res.insertId]), order };
  });
}

async function mine(userId) {
  return db.all(
    `SELECT s.*, p.name AS plan_name, p.diet, p.meals FROM subscriptions s JOIN plans p ON p.id = s.plan_id
      WHERE s.user_id = ? ORDER BY s.id DESC`, [userId],
  );
}

async function getOwned(user, id) {
  const sub = await db.get('SELECT * FROM subscriptions WHERE id = ?', [id]);
  if (!sub || sub.user_id !== user.id) throw new AppError(404, 'NOT_FOUND', 'Subscription not found');
  return sub;
}

// Abandon an unpaid subscription (e.g. payment window closed).
async function discardPending(user, id) {
  const sub = await getOwned(user, id);
  if (sub.status !== 'pending_payment') throw new AppError(409, 'INVALID_STATE', 'Only unpaid subscriptions can be discarded');
  await db.run('DELETE FROM payments WHERE purpose = ? AND ref_id = ? AND status <> ?', ['subscription', id, 'paid']);
  await db.run('DELETE FROM subscriptions WHERE id = ?', [id]);
}

// Student asks to cancel; the mess manager decides (replaces cancellation emails).
async function requestCancel(user, id) {
  const sub = await getOwned(user, id);
  if (sub.status !== 'active') throw new AppError(409, 'INVALID_STATE', 'Only active subscriptions can be cancelled');
  if (sub.end_date < today()) throw new AppError(409, 'INVALID_STATE', 'Subscription already ended');
  await db.run(`UPDATE subscriptions SET status = 'cancel_requested', cancel_requested_at = ? WHERE id = ?`, [nowStamp(), id]);
  return db.get('SELECT * FROM subscriptions WHERE id = ?', [id]);
}

async function listCancelRequests() {
  return db.all(
    `SELECT s.*, u.name, u.roll_no, p.name AS plan_name FROM subscriptions s
       JOIN users u ON u.id = s.user_id JOIN plans p ON p.id = s.plan_id
      WHERE s.status = 'cancel_requested' ORDER BY s.cancel_requested_at`,
  );
}

// Approve: food continues until today, unused days are refunded to the wallet at cancel_refund_rate.
async function decideCancel(actor, id, approve) {
  const sub = await db.get('SELECT * FROM subscriptions WHERE id = ?', [id]);
  if (!sub) throw new AppError(404, 'NOT_FOUND', 'Subscription not found');
  if (sub.status !== 'cancel_requested') throw new AppError(409, 'INVALID_STATE', 'No pending cancellation for this subscription');

  if (!approve) {
    await db.run(`UPDATE subscriptions SET status = 'active', cancel_requested_at = NULL WHERE id = ?`, [id]);
    await audit.log(db, actor.id, 'cancel_rejected', 'subscription', id);
    return db.get('SELECT * FROM subscriptions WHERE id = ?', [id]);
  }

  const t = today();
  const rate = await settings.getNumber('cancel_refund_rate');
  const refund = cancellationRefund(sub.amount_paise, sub.start_date, sub.end_date, addDays(t, 1), rate);
  const newEnd = t >= sub.start_date ? t : addDays(sub.start_date, -1); // before start => no entitlement at all
  await db.transaction(async (tx) => {
    await tx.run(
      `UPDATE subscriptions SET status = 'cancelled', cancelled_at = ?, end_date = ?, refund_paise = ? WHERE id = ?`,
      [nowStamp(), newEnd, refund, id],
    );
    if (refund > 0) await wallet.add(tx, sub.user_id, refund, 'cancel_refund', id);
    await audit.log(tx, actor.id, 'cancel_approved', 'subscription', id, `refund=${refund}`);
  });
  return db.get('SELECT * FROM subscriptions WHERE id = ?', [id]);
}

module.exports = {
  listPlans, updatePlan, findCovering, create, mine, discardPending,
  requestCancel, listCancelRequests, decideCancel,
};
