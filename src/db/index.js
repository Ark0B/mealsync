// Database adapter.
// The rest of the app only calls: all(), get(), run(), transaction().
// Behind it sits either MySQL (production, via mysql2) or SQLite (zero-setup dev and tests,
// via Node's built-in node:sqlite). Both use '?' placeholders, so queries are written once.
const fs = require('fs');
const path = require('path');
const config = require('../config');

let client = null;   // 'mysql' | 'sqlite'
let pool = null;     // mysql2 pool
let sqlite = null;   // node:sqlite DatabaseSync

// node:sqlite rejects booleans/undefined, so normalise parameters for both drivers.
function clean(params) {
  return params.map((p) => (p === undefined ? null : typeof p === 'boolean' ? (p ? 1 : 0) : p));
}

// Turn driver-specific "unique constraint" errors into one flag the services can check.
function normaliseError(err) {
  if (err && (err.code === 'ER_DUP_ENTRY' || /UNIQUE constraint failed/.test(err.message || ''))) {
    err.isDuplicate = true;
  }
  return err;
}

// Build an executor (all/get/run) on top of a mysql connection/pool or the sqlite handle.
function makeExecutor(conn) {
  if (client === 'mysql') {
    return {
      async all(sql, params = []) {
        try { const [rows] = await conn.query(sql, clean(params)); return rows; } catch (e) { throw normaliseError(e); }
      },
      async get(sql, params = []) {
        try { const [rows] = await conn.query(sql, clean(params)); return rows[0]; } catch (e) { throw normaliseError(e); }
      },
      async run(sql, params = []) {
        try {
          const [res] = await conn.query(sql, clean(params));
          return { insertId: res.insertId, affectedRows: res.affectedRows };
        } catch (e) { throw normaliseError(e); }
      },
    };
  }
  return {
    async all(sql, params = []) {
      try { return conn.prepare(sql).all(...clean(params)); } catch (e) { throw normaliseError(e); }
    },
    async get(sql, params = []) {
      try { return conn.prepare(sql).get(...clean(params)); } catch (e) { throw normaliseError(e); }
    },
    async run(sql, params = []) {
      try {
        const res = conn.prepare(sql).run(...clean(params));
        return { insertId: Number(res.lastInsertRowid), affectedRows: Number(res.changes) };
      } catch (e) { throw normaliseError(e); }
    },
  };
}

let executor = null;

// Convert the canonical MySQL schema into SQLite syntax so there is ONE source of truth.
function mysqlToSqlite(sql) {
  return sql
    .replace(/INT AUTO_INCREMENT PRIMARY KEY/g, 'INTEGER PRIMARY KEY AUTOINCREMENT')
    .replace(/,\s*\n\s*INDEX [^\n]*/g, '')            // secondary indexes are optional in dev
    .replace(/UNIQUE KEY \w+ \(/g, 'UNIQUE (');
}

async function init() {
  client = config.db.client;
  if (client === 'mysql') {
    const mysql = require('mysql2/promise');
    pool = mysql.createPool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
      connectionLimit: 10,
      dateStrings: true,        // return DATE/DATETIME as strings, same as SQLite
      multipleStatements: true, // needed only to run the schema file
    });
    executor = makeExecutor(pool);
  } else {
    const { DatabaseSync } = require('node:sqlite');
    const file = config.db.sqliteFile;
    if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
    sqlite = new DatabaseSync(file);
    sqlite.exec('PRAGMA foreign_keys = ON;');
    executor = makeExecutor(sqlite);
  }
}

// Create all tables if they do not exist (safe to call on every start).
async function applySchema() {
  const raw = fs.readFileSync(path.join(__dirname, '../../database/schema.mysql.sql'), 'utf8');
  if (client === 'mysql') await pool.query(raw);
  else sqlite.exec(mysqlToSqlite(raw));
}

// Run fn(tx) atomically. tx has the same all/get/run methods.
async function transaction(fn) {
  if (client === 'mysql') {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const result = await fn(makeExecutor(conn));
      await conn.commit();
      return result;
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }
  sqlite.exec('BEGIN');
  try {
    const result = await fn(executor);
    sqlite.exec('COMMIT');
    return result;
  } catch (e) {
    sqlite.exec('ROLLBACK');
    throw e;
  }
}

async function close() {
  if (pool) await pool.end();
  if (sqlite) sqlite.close();
  pool = null; sqlite = null; executor = null;
}

module.exports = {
  init,
  applySchema,
  transaction,
  close,
  mysqlToSqlite,
  all: (...a) => executor.all(...a),
  get: (...a) => executor.get(...a),
  run: (...a) => executor.run(...a),
  get client() { return client; },
};
