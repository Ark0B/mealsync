const { canTransition } = require('../../src/services/complaints.service');
const { mysqlToSqlite } = require('../../src/db');
const { AppError, asyncHandler } = require('../../src/utils/errors');
const v = require('../../src/utils/validate');

describe('complaint state machine', () => {
  test.each([
    ['open', 'in_progress', true],
    ['open', 'resolved', true],
    ['in_progress', 'escalated', true],
    ['escalated', 'resolved', true],
    ['resolved', 'open', false],
    ['resolved', 'in_progress', false],
    ['open', 'open', false],
    ['unknown', 'resolved', false],
  ])('%s -> %s allowed: %s', (from, to, ok) => expect(canTransition(from, to)).toBe(ok));
});

describe('schema conversion MySQL -> SQLite', () => {
  test('auto increment, unique keys and indexes are converted', () => {
    const out = mysqlToSqlite(`CREATE TABLE t (
  id INT AUTO_INCREMENT PRIMARY KEY,
  a INT,
  UNIQUE KEY uq_a (a),
  INDEX idx_a (a)
);`);
    expect(out).toContain('INTEGER PRIMARY KEY AUTOINCREMENT');
    expect(out).toContain('UNIQUE (a)');
    expect(out).not.toContain('INDEX');
  });
});

describe('validators', () => {
  test('requireFields lists every missing field', () => {
    expect(() => v.requireFields({ a: 1, b: '' }, ['a', 'b', 'c'])).toThrow('Missing field(s): b, c');
  });
  test('toId rejects non-positive and non-integers', () => {
    expect(v.toId('5')).toBe(5);
    expect(() => v.toId('0')).toThrow(AppError);
    expect(() => v.toId('1.5')).toThrow(AppError);
    expect(() => v.toId('abc')).toThrow(AppError);
  });
  test('assertMeal / assertDate / assertOneOf', () => {
    expect(() => v.assertMeal('Z')).toThrow(AppError);
    expect(() => v.assertDate('2026-02-30')).toThrow(AppError);
    expect(() => v.assertOneOf('x', ['a'], 'f')).toThrow('f must be one of a');
  });
});

describe('asyncHandler', () => {
  test('forwards a rejected promise to next()', async () => {
    const err = new Error('boom');
    const next = jest.fn();
    await asyncHandler(async () => { throw err; })({}, {}, next);
    expect(next).toHaveBeenCalledWith(err);
  });
});
