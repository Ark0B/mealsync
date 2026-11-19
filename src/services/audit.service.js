// Append-only record of who changed what. `exec` is db or a transaction.
const { nowStamp } = require('../utils/time');

async function log(exec, actorId, action, entity, entityId, details = null) {
  await exec.run(
    'INSERT INTO audit_log (actor_id, action, entity, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [actorId, action, entity, entityId, details, nowStamp()],
  );
}

async function recent(db, limit = 100) {
  return db.all(
    `SELECT a.*, u.name AS actor_name FROM audit_log a JOIN users u ON u.id = a.actor_id
      ORDER BY a.id DESC LIMIT ?`, [limit],
  );
}

module.exports = { log, recent };
