// Complaint tickets (replaces the paper complaint register). Every ticket has a tracked status.
const db = require('../db');
const { AppError } = require('../utils/errors');
const { nowStamp } = require('../utils/time');
const { requireFields, assertOneOf, assertDate, assertMeal } = require('../utils/validate');
const audit = require('./audit.service');

const CATEGORIES = ['food_quality', 'quantity', 'hygiene', 'staff', 'billing', 'other'];

// Allowed status changes (a small state machine — see docs/04-design.md).
const TRANSITIONS = {
  open: ['in_progress', 'escalated', 'resolved'],
  in_progress: ['escalated', 'resolved'],
  escalated: ['in_progress', 'resolved'],
  resolved: [],
};

const canTransition = (from, to) => (TRANSITIONS[from] || []).includes(to);

async function create(user, body) {
  requireFields(body, ['category', 'description']);
  assertOneOf(body.category, CATEGORIES, 'category');
  const text = String(body.description).trim();
  if (text.length < 10 || text.length > 2000) throw new AppError(400, 'VALIDATION', 'Description must be 10–2000 characters');
  if (body.meal_date) assertDate(body.meal_date, 'meal_date');
  if (body.meal) assertMeal(body.meal);
  const stamp = nowStamp();
  const res = await db.run(
    `INSERT INTO complaints (user_id, category, description, meal_date, meal, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'open', ?, ?)`,
    [user.id, body.category, text, body.meal_date || null, body.meal || null, stamp, stamp],
  );
  return db.get('SELECT * FROM complaints WHERE id = ?', [res.insertId]);
}

async function mine(userId) {
  return db.all('SELECT * FROM complaints WHERE user_id = ? ORDER BY id DESC', [userId]);
}

async function list({ status } = {}) {
  const params = [];
  let where = '';
  if (status) { where = 'WHERE c.status = ?'; params.push(status); }
  return db.all(
    `SELECT c.*, u.name, u.roll_no FROM complaints c JOIN users u ON u.id = c.user_id ${where} ORDER BY c.id DESC`, params,
  );
}

// Managers handle any ticket; committee members handle tickets escalated to them.
async function updateStatus(actor, id, body) {
  requireFields(body, ['status']);
  const c = await db.get('SELECT * FROM complaints WHERE id = ?', [id]);
  if (!c) throw new AppError(404, 'NOT_FOUND', 'Complaint not found');
  const isManager = ['manager', 'admin'].includes(actor.role);
  if (!isManager && c.status !== 'escalated') {
    throw new AppError(403, 'FORBIDDEN', 'Committee members can act only on escalated complaints');
  }
  if (!canTransition(c.status, body.status)) {
    throw new AppError(409, 'INVALID_TRANSITION', `Cannot move a complaint from ${c.status} to ${body.status}`);
  }
  if (body.status === 'resolved' && !body.resolution) {
    throw new AppError(400, 'VALIDATION', 'A resolution note is required to resolve a complaint');
  }
  await db.run('UPDATE complaints SET status = ?, resolution = ?, handled_by = ?, updated_at = ? WHERE id = ?',
    [body.status, body.resolution || c.resolution, actor.id, nowStamp(), id]);
  await audit.log(db, actor.id, `complaint_${body.status}`, 'complaint', id);
  return db.get('SELECT * FROM complaints WHERE id = ?', [id]);
}

module.exports = { create, mine, list, updateStatus, canTransition, TRANSITIONS, CATEGORIES };
