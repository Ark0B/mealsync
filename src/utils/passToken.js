// Rotating QR meal pass.
// Format:  MS1.<userId>.<timeStep>.<signature>
// timeStep = floor(unixSeconds / 30), so the pass changes every 30 seconds (like a TOTP code).
// signature = HMAC-SHA256(PASS_SECRET, "<userId>.<timeStep>") in base64url, first 22 chars (~131 bits).
// Without the server secret nobody can forge a pass; a screenshot stops working within ~60 s.
const crypto = require('crypto');
const config = require('../config');
const clock = require('./clock');

const PREFIX = 'MS1';

const stepAt = (date) => Math.floor(date.getTime() / 1000 / config.passStepSeconds);

function sign(userId, step) {
  return crypto.createHmac('sha256', config.passSecret).update(`${userId}.${step}`).digest('base64url').slice(0, 22);
}

function issue(userId, date = clock.now()) {
  const step = stepAt(date);
  const secondsLeft = config.passStepSeconds - (Math.floor(date.getTime() / 1000) % config.passStepSeconds);
  return { token: `${PREFIX}.${userId}.${step}.${sign(userId, step)}`, expiresIn: secondsLeft };
}

// Returns { ok: true, userId } or { ok: false, reason: 'invalid_token' | 'expired_token', userId? }
function verify(token, date = clock.now()) {
  const parts = String(token || '').trim().split('.');
  if (parts.length !== 4 || parts[0] !== PREFIX) return { ok: false, reason: 'invalid_token' };
  const userId = Number(parts[1]);
  const step = Number(parts[2]);
  if (!Number.isInteger(userId) || !Number.isInteger(step)) return { ok: false, reason: 'invalid_token' };

  const expected = Buffer.from(sign(userId, step));
  const given = Buffer.from(parts[3]);
  // timingSafeEqual prevents guessing the signature byte by byte from response times.
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
    return { ok: false, reason: 'invalid_token' };
  }
  const current = stepAt(date);
  // Accept the current step and the previous one (clock skew / slow scan), nothing older or newer.
  if (step < current - 1 || step > current) return { ok: false, reason: 'expired_token', userId };
  return { ok: true, userId };
}

module.exports = { issue, verify, sign };
