// Small input validators. The server never trusts the client.
const { AppError } = require('./errors');
const { isValidDate, isMeal } = require('./time');

function requireFields(body, fields) {
  const missing = fields.filter((f) => body[f] === undefined || body[f] === null || body[f] === '');
  if (missing.length) throw new AppError(400, 'VALIDATION', `Missing field(s): ${missing.join(', ')}`);
}

function assertDate(value, field = 'date') {
  if (!isValidDate(value)) throw new AppError(400, 'VALIDATION', `${field} must be YYYY-MM-DD`);
}

function assertMeal(value) {
  if (!isMeal(value)) throw new AppError(400, 'VALIDATION', 'meal must be one of B, L, S, D');
}

function assertOneOf(value, allowed, field) {
  if (!allowed.includes(value)) throw new AppError(400, 'VALIDATION', `${field} must be one of ${allowed.join(', ')}`);
}

function toId(value, field = 'id') {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new AppError(400, 'VALIDATION', `${field} must be a positive integer`);
  return n;
}

module.exports = { requireFields, assertDate, assertMeal, assertOneOf, toId };
