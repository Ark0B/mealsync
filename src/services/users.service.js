// Mess-office user management: approve registrations, create staff, assign committee members.
const bcrypt = require('bcryptjs');
const db = require('../db');
const { AppError } = require('../utils/errors');
const { nowStamp } = require('../utils/time');
const { requireFields, assertOneOf } = require('../utils/validate');
const audit = require('./audit.service');
const { publicUser, BCRYPT_COST } = require('./auth.service');

async function list({ status, role, q } = {}) {
  const where = [];
  const params = [];
  if (status) { where.push('status = ?'); params.push(status); }
  if (role) { where.push('role = ?'); params.push(role); }
  if (q) { where.push('(name LIKE ? OR email LIKE ? OR roll_no LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const sql = `SELECT id, name, email, role, is_committee, roll_no, phone, is_day_scholar, diet_pref, status, created_at
                 FROM users ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY id DESC`;
  return db.all(sql, params);
}

async function setStatus(actor, userId, status) {
  assertOneOf(status, ['approved', 'rejected', 'disabled'], 'status');
  const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');
  if (user.id === actor.id) throw new AppError(400, 'VALIDATION', 'You cannot change your own status');
  await db.transaction(async (tx) => {
    await tx.run('UPDATE users SET status = ? WHERE id = ?', [status, userId]);
    await audit.log(tx, actor.id, `user_${status}`, 'user', userId);
  });
  return publicUser(await db.get('SELECT * FROM users WHERE id = ?', [userId]));
}

async function setCommittee(actor, userId, flag) {
  const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');
  if (user.role !== 'student') throw new AppError(400, 'VALIDATION', 'Only students can be committee members');
  await db.transaction(async (tx) => {
    await tx.run('UPDATE users SET is_committee = ? WHERE id = ?', [flag ? 1 : 0, userId]);
    await audit.log(tx, actor.id, flag ? 'committee_added' : 'committee_removed', 'user', userId);
  });
  return publicUser(await db.get('SELECT * FROM users WHERE id = ?', [userId]));
}

// Managers create staff accounts; only an admin may create another manager or admin.
async function createStaff(actor, body) {
  requireFields(body, ['name', 'email', 'password', 'role']);
  assertOneOf(body.role, ['staff', 'manager', 'admin'], 'role');
  if (body.role !== 'staff' && actor.role !== 'admin') {
    throw new AppError(403, 'FORBIDDEN', 'Only an admin can create manager or admin accounts');
  }
  if (String(body.password).length < 8) throw new AppError(400, 'VALIDATION', 'Password must be at least 8 characters');
  const hash = await bcrypt.hash(String(body.password), BCRYPT_COST);
  try {
    const res = await db.run(
      `INSERT INTO users (name, email, password_hash, role, status, created_at) VALUES (?, ?, ?, ?, 'approved', ?)`,
      [body.name, String(body.email).toLowerCase(), hash, body.role, nowStamp()],
    );
    await audit.log(db, actor.id, 'user_created', 'user', res.insertId, body.role);
    return publicUser(await db.get('SELECT * FROM users WHERE id = ?', [res.insertId]));
  } catch (e) {
    if (e.isDuplicate) throw new AppError(409, 'DUPLICATE', 'Email already in use');
    throw e;
  }
}

module.exports = { list, setStatus, setCommittee, createStaff };
