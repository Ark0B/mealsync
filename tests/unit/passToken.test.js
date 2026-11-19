const pass = require('../../src/utils/passToken');

const T0 = new Date('2026-11-20T07:00:05Z');
const later = (s) => new Date(T0.getTime() + s * 1000);

describe('rotating QR pass', () => {
  test('a freshly issued pass verifies and names the user', () => {
    const { token, expiresIn } = pass.issue(42, T0);
    expect(token).toMatch(/^MS1\.42\.\d+\.[A-Za-z0-9_-]{22}$/);
    expect(expiresIn).toBeGreaterThan(0);
    expect(expiresIn).toBeLessThanOrEqual(30);
    expect(pass.verify(token, T0)).toEqual({ ok: true, userId: 42 });
  });

  test('the previous 30-second step is still accepted (slow scan)', () => {
    const { token } = pass.issue(42, T0);
    expect(pass.verify(token, later(30)).ok).toBe(true);
  });

  test('a pass older than ~60 s is expired (screenshot replay)', () => {
    const { token } = pass.issue(42, T0);
    expect(pass.verify(token, later(65))).toEqual({ ok: false, reason: 'expired_token', userId: 42 });
  });

  test('a pass from the future is rejected', () => {
    const { token } = pass.issue(42, later(120));
    expect(pass.verify(token, T0).reason).toBe('expired_token');
  });

  test('changing the user id breaks the signature (cannot borrow a friend\'s pass)', () => {
    const { token } = pass.issue(42, T0);
    const forged = token.replace('MS1.42.', 'MS1.43.');
    expect(pass.verify(forged, T0)).toEqual({ ok: false, reason: 'invalid_token' });
  });

  test.each(['', 'hello', 'MS1.1.2', 'XX1.1.2.abc', 'MS1.a.b.c', null, undefined])('garbage %p is invalid', (t) => {
    expect(pass.verify(t, T0)).toEqual({ ok: false, reason: 'invalid_token' });
  });

  test('a different signature length is rejected without throwing', () => {
    const { token } = pass.issue(7, T0);
    expect(pass.verify(`${token}x`, T0).reason).toBe('invalid_token');
  });
});
