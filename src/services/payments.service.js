// Payments follow the Razorpay "order -> checkout -> signature verification" flow:
//   1. server creates an ORDER for the exact amount (client never decides the price)
//   2. the gateway takes the money and returns { paymentId, signature }
//   3. server checks signature = HMAC_SHA256(orderId + "|" + paymentId, gatewaySecret)
// Only step 3 activates anything. This removes "show the server a payment screenshot".
const crypto = require('crypto');
const db = require('../db');
const config = require('../config');
const { AppError } = require('../utils/errors');
const { nowStamp } = require('../utils/time');
const { requireFields } = require('../utils/validate');

const signatureFor = (orderId, paymentId) =>
  crypto.createHmac('sha256', config.payment.secret).update(`${orderId}|${paymentId}`).digest('hex');

async function createOrder(exec, userId, purpose, refId, amountPaise) {
  const orderId = `order_${crypto.randomBytes(8).toString('hex')}`;
  await exec.run(
    `INSERT INTO payments (order_id, user_id, purpose, ref_id, amount_paise, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'created', ?)`,
    [orderId, userId, purpose, refId, amountPaise, nowStamp()],
  );
  return { orderId, amountPaise, currency: 'INR', mode: config.payment.mode };
}

// MOCK GATEWAY (development/demo only). Plays the role of Razorpay's checkout popup.
// In production this route is disabled and the real gateway SDK produces paymentId + signature.
async function mockCheckout(user, orderId) {
  if (config.payment.mode !== 'mock') throw new AppError(404, 'NOT_FOUND', 'Mock gateway disabled');
  const p = await db.get('SELECT * FROM payments WHERE order_id = ? AND user_id = ?', [orderId, user.id]);
  if (!p) throw new AppError(404, 'NOT_FOUND', 'Order not found');
  const paymentId = `pay_${crypto.randomBytes(8).toString('hex')}`;
  return { orderId, paymentId, signature: signatureFor(orderId, paymentId) };
}

async function verify(user, body) {
  requireFields(body, ['orderId', 'paymentId', 'signature']);
  const p = await db.get('SELECT * FROM payments WHERE order_id = ?', [body.orderId]);
  if (!p || p.user_id !== user.id) throw new AppError(404, 'NOT_FOUND', 'Order not found');
  if (p.status === 'paid') return { status: 'paid', purpose: p.purpose, refId: p.ref_id }; // idempotent retry

  const expected = Buffer.from(signatureFor(body.orderId, body.paymentId));
  const given = Buffer.from(String(body.signature));
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
    await db.run(`UPDATE payments SET status = 'failed' WHERE id = ?`, [p.id]);
    throw new AppError(400, 'BAD_SIGNATURE', 'Payment could not be verified');
  }

  await db.transaction(async (tx) => {
    await tx.run(`UPDATE payments SET status = 'paid', provider_payment_id = ?, paid_at = ? WHERE id = ?`,
      [body.paymentId, nowStamp(), p.id]);
    if (p.purpose === 'subscription') {
      await tx.run(`UPDATE subscriptions SET status = 'active' WHERE id = ? AND status = 'pending_payment'`, [p.ref_id]);
    } else if (p.purpose === 'token') {
      await tx.run(`UPDATE meal_tokens SET status = 'active' WHERE id = ? AND status = 'pending_payment'`, [p.ref_id]);
    }
  });
  return { status: 'paid', purpose: p.purpose, refId: p.ref_id };
}

async function mine(userId) {
  return db.all('SELECT order_id, purpose, ref_id, amount_paise, status, created_at, paid_at FROM payments WHERE user_id = ? ORDER BY id DESC', [userId]);
}

module.exports = { createOrder, mockCheckout, verify, mine, signatureFor };
