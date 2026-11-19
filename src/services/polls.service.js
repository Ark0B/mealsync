// Committee polls (replaces WhatsApp polls): one vote per student, results visible to everyone.
const db = require('../db');
const { AppError } = require('../utils/errors');
const { nowStamp } = require('../utils/time');
const clock = require('../utils/clock');
const { requireFields, toId } = require('../utils/validate');
const audit = require('./audit.service');

async function create(actor, body) {
  requireFields(body, ['question', 'options', 'closes_at']);
  const options = Array.isArray(body.options) ? body.options.map((o) => String(o).trim()).filter(Boolean) : [];
  if (options.length < 2 || options.length > 10) throw new AppError(400, 'VALIDATION', 'A poll needs 2–10 options');
  if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) throw new AppError(400, 'VALIDATION', 'Options must be unique');
  const closes = new Date(body.closes_at);
  if (Number.isNaN(closes.getTime()) || closes <= clock.now()) throw new AppError(400, 'VALIDATION', 'closes_at must be a future date-time');
  const closesStamp = closes.toISOString().slice(0, 19).replace('T', ' ');

  return db.transaction(async (tx) => {
    const res = await tx.run('INSERT INTO polls (question, created_by, closes_at, status, created_at) VALUES (?, ?, ?, ?, ?)',
      [String(body.question).trim(), actor.id, closesStamp, 'open', nowStamp()]);
    for (const label of options) await tx.run('INSERT INTO poll_options (poll_id, label) VALUES (?, ?)', [res.insertId, label]);
    await audit.log(tx, actor.id, 'poll_created', 'poll', res.insertId);
    return res.insertId;
  }).then((id) => get(id, actor.id));
}

const isOpen = (poll) => poll.status === 'open' && poll.closes_at > nowStamp();

async function get(id, userId) {
  const poll = await db.get('SELECT * FROM polls WHERE id = ?', [id]);
  if (!poll) throw new AppError(404, 'NOT_FOUND', 'Poll not found');
  const options = await db.all(
    `SELECT o.id, o.label, COUNT(v.id) AS votes FROM poll_options o LEFT JOIN poll_votes v ON v.option_id = o.id
      WHERE o.poll_id = ? GROUP BY o.id, o.label ORDER BY o.id`, [id],
  );
  const mine = userId ? await db.get('SELECT option_id FROM poll_votes WHERE poll_id = ? AND user_id = ?', [id, userId]) : null;
  return {
    ...poll,
    open: isOpen(poll),
    options: options.map((o) => ({ ...o, votes: Number(o.votes) })),
    totalVotes: options.reduce((s, o) => s + Number(o.votes), 0),
    myVote: mine ? mine.option_id : null,
  };
}

async function list(userId) {
  const polls = await db.all('SELECT id FROM polls ORDER BY id DESC LIMIT 50');
  return Promise.all(polls.map((p) => get(p.id, userId)));
}

async function vote(user, pollId, body) {
  requireFields(body, ['optionId']);
  const optionId = toId(body.optionId, 'optionId');
  const poll = await db.get('SELECT * FROM polls WHERE id = ?', [pollId]);
  if (!poll) throw new AppError(404, 'NOT_FOUND', 'Poll not found');
  if (!isOpen(poll)) throw new AppError(409, 'POLL_CLOSED', 'This poll is closed');
  const option = await db.get('SELECT id FROM poll_options WHERE id = ? AND poll_id = ?', [optionId, pollId]);
  if (!option) throw new AppError(400, 'VALIDATION', 'Option does not belong to this poll');
  try {
    await db.run('INSERT INTO poll_votes (poll_id, option_id, user_id, created_at) VALUES (?, ?, ?, ?)', [pollId, optionId, user.id, nowStamp()]);
  } catch (e) {
    if (e.isDuplicate) throw new AppError(409, 'ALREADY_VOTED', 'You have already voted in this poll');
    throw e;
  }
  return get(pollId, user.id);
}

async function close(actor, pollId) {
  const poll = await db.get('SELECT * FROM polls WHERE id = ?', [pollId]);
  if (!poll) throw new AppError(404, 'NOT_FOUND', 'Poll not found');
  await db.run(`UPDATE polls SET status = 'closed' WHERE id = ?`, [pollId]);
  await audit.log(db, actor.id, 'poll_closed', 'poll', pollId);
  return get(pollId, actor.id);
}

module.exports = { create, get, list, vote, close };
