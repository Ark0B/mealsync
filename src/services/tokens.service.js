// Pay-per-meal tokens: for day scholars, unsubscribed students, or an extra meal outside a plan.
const db = require('../db');
const { AppError } = require('../utils/errors');
const { nowStamp, today, addDays, mealEnd } = require('../utils/time');
const clock = require('../utils/clock');
const { requireFields, assertDate, assertMeal, assertOneOf, toId } = require('../utils/validate');
const subscriptions = require('./subscriptions.service');
const payments = require('./payments.service');
const wallet = require('./wallet.service');
const audit = require('./audit.service');

const MAX_DAYS_AHEAD = 7;

async function prices() {
  return db.all('SELECT * FROM meal_prices ORDER BY meal, diet');
}

async function setPrice(actor, body) {
  requireFields(body, ['meal', 'diet', 'price_paise']);
  assertMeal(body.meal);
  assertOneOf(body.diet, ['veg', 'nonveg'], 'diet');
  const price = Number(body.price_paise);
  if (!Number.isInteger(price) || price <= 0) throw new AppError(400, 'VALIDATION', 'price_paise must be a positive integer');
  const exists = await db.get('SELECT meal FROM meal_prices WHERE meal = ? AND diet = ?', [body.meal, body.diet]);
  if (exists) await db.run('UPDATE meal_prices SET price_paise = ? WHERE meal = ? AND diet = ?', [price, body.meal, body.diet]);
  else await db.run('INSERT INTO meal_prices (meal, diet, price_paise) VALUES (?, ?, ?)', [body.meal, body.diet, price]);
  await audit.log(db, actor.id, 'meal_price_updated', 'meal_price', null, `${body.meal}/${body.diet}=${price}`);
  return prices();
}

// payWith: 'wallet' (instant, uses skip/cancel credits) or 'gateway' (returns an order to pay).
async function buy(user, body) {
  requireFields(body, ['date', 'meal', 'diet']);
  assertDate(body.date);
  assertMeal(body.meal);
  assertOneOf(body.diet, ['veg', 'nonveg'], 'diet');
  const payWith = body.payWith || 'gateway';
  assertOneOf(payWith, ['wallet', 'gateway'], 'payWith');

  const t = today();
  if (body.date < t || body.date > addDays(t, MAX_DAYS_AHEAD)) {
    throw new AppError(400, 'VALIDATION', `Tokens can be bought for today up to ${MAX_DAYS_AHEAD} days ahead`);
  }
  if (clock.now() >= mealEnd(body.date, body.meal)) throw new AppError(400, 'MEAL_OVER', 'That meal is already over');

  if (await subscriptions.findCovering(db, user.id, body.date, body.meal)) {
    throw new AppError(409, 'ALREADY_ENTITLED', 'Your subscription already covers this meal');
  }

  const priceRow = await db.get('SELECT price_paise FROM meal_prices WHERE meal = ? AND diet = ?', [body.meal, body.diet]);
  if (!priceRow) throw new AppError(400, 'VALIDATION', 'No price configured for this meal');
  const price = priceRow.price_paise;

  const existing = await db.get('SELECT * FROM meal_tokens WHERE user_id = ? AND meal_date = ? AND meal = ?', [user.id, body.date, body.meal]);
  if (existing && existing.status !== 'pending_payment') throw new AppError(409, 'DUPLICATE', 'You already have a token for this meal');

  return db.transaction(async (tx) => {
    let tokenId = existing ? existing.id : null;
    if (!tokenId) {
      const res = await tx.run(
        `INSERT INTO meal_tokens (user_id, meal_date, meal, diet, price_paise, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'pending_payment', ?)`,
        [user.id, body.date, body.meal, body.diet, price, nowStamp()],
      );
      tokenId = res.insertId;
    }
    if (payWith === 'wallet') {
      const bal = await wallet.balance(user.id, tx);
      if (bal < price) throw new AppError(402, 'INSUFFICIENT_BALANCE', 'Not enough wallet balance');
      await wallet.add(tx, user.id, -price, 'token_purchase', tokenId);
      await tx.run(`UPDATE meal_tokens SET status = 'active' WHERE id = ?`, [tokenId]);
      return { token: await tx.get('SELECT * FROM meal_tokens WHERE id = ?', [tokenId]) };
    }
    const order = await payments.createOrder(tx, user.id, 'token', tokenId, price);
    return { token: await tx.get('SELECT * FROM meal_tokens WHERE id = ?', [tokenId]), order };
  });
}

async function mine(userId) {
  return db.all('SELECT * FROM meal_tokens WHERE user_id = ? ORDER BY meal_date DESC, meal', [userId]);
}

async function discardPending(user, id) {
  id = toId(id);
  const tok = await db.get('SELECT * FROM meal_tokens WHERE id = ? AND user_id = ?', [id, user.id]);
  if (!tok) throw new AppError(404, 'NOT_FOUND', 'Token not found');
  if (tok.status !== 'pending_payment') throw new AppError(409, 'INVALID_STATE', 'Only unpaid tokens can be discarded');
  await db.run(`DELETE FROM payments WHERE purpose = 'token' AND ref_id = ? AND status <> 'paid'`, [id]);
  await db.run('DELETE FROM meal_tokens WHERE id = ?', [id]);
}

module.exports = { prices, setPrice, buy, mine, discardPending, MAX_DAYS_AHEAD };
