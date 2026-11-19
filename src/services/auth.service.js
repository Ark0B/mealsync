// Registration and login.
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const config = require('../config');
const { AppError } = require('../utils/errors');
const { nowStamp } = require('../utils/time');
const { requireFields, assertOneOf } = require('../utils/validate');

const BCRYPT_COST = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Never send the password hash to the client.
function publicUser(u) {
  const { password_hash, ...rest } = u; // eslint-disable-line no-unused-vars
  return rest;
}

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

// Students self-register; the account stays 'pending' until the mess manager approves it.
// This replaces the Google Form + email registration.
async function register(body) {
  requireFields(body, ['name', 'email', 'password', 'roll_no']);
  const email = String(body.email).trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new AppError(400, 'VALIDATION', 'Invalid email');
  if (String(body.password).length < 8) throw new AppError(400, 'VALIDATION', 'Password must be at least 8 characters');
  const diet = body.diet_pref || 'veg';
  assertOneOf(diet, ['veg', 'nonveg'], 'diet_pref');

  const hash = await bcrypt.hash(String(body.password), BCRYPT_COST);
  try {
    const res = await db.run(
      `INSERT INTO users (name, email, password_hash, role, roll_no, phone, is_day_scholar, diet_pref, status, created_at)
       VALUES (?, ?, ?, 'student', ?, ?, ?, ?, 'pending', ?)`,
      [String(body.name).trim(), email, hash, String(body.roll_no).trim(), body.phone || null,
        body.is_day_scholar ? 1 : 0, diet, nowStamp()],
    );
    const user = await db.get('SELECT * FROM users WHERE id = ?', [res.insertId]);
    return { user: publicUser(user), token: signToken(user) };
  } catch (e) {
    if (e.isDuplicate) throw new AppError(409, 'DUPLICATE', 'Email or roll number already registered');
    throw e;
  }
}

async function login(body) {
  requireFields(body, ['email', 'password']);
  const user = await db.get('SELECT * FROM users WHERE email = ?', [String(body.email).trim().toLowerCase()]);
  // Same message whether the email or the password is wrong: prevents user enumeration.
  const ok = user && (await bcrypt.compare(String(body.password), user.password_hash));
  if (!ok) throw new AppError(401, 'BAD_CREDENTIALS', 'Invalid email or password');
  if (user.status === 'rejected' || user.status === 'disabled') {
    throw new AppError(403, 'ACCOUNT_INACTIVE', 'Account is not active. Contact the mess office.');
  }
  return { user: publicUser(user), token: signToken(user) };
}

module.exports = { register, login, publicUser, signToken, BCRYPT_COST };
