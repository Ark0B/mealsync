const clock = require('../../src/utils/clock');
const t = require('../../src/utils/time');

const ist = (s) => new Date(`${s.replace(' ', 'T')}:00+05:30`);

afterEach(() => clock.setNow(null));

describe('IST helpers', () => {
  test('istParts converts UTC late evening to next IST day', () => {
    const p = t.istParts(new Date('2026-11-19T20:00:00Z')); // 01:30 IST on the 20th
    expect(p.date).toBe('2026-11-20');
    expect(p.minutes).toBe(90);
  });

  test('today() follows the frozen clock', () => {
    clock.setNow(ist('2026-03-01 00:05'));
    expect(t.today()).toBe('2026-03-01');
  });

  test.each([
    ['2026-11-20 07:29', null],
    ['2026-11-20 07:30', 'B'],
    ['2026-11-20 09:29', 'B'],
    ['2026-11-20 09:30', null],
    ['2026-11-20 13:00', 'L'],
    ['2026-11-20 17:59', 'S'],
    ['2026-11-20 21:29', 'D'],
    ['2026-11-20 21:30', null],
  ])('currentMeal at %s is %s', (when, expected) => {
    expect(t.currentMeal(ist(when))).toBe(expected);
  });

  test('mealStart returns the exact instant', () => {
    expect(t.mealStart('2026-11-20', 'L').toISOString()).toBe('2026-11-20T07:00:00.000Z');
  });
});

describe('date validation and arithmetic', () => {
  test.each(['2026-02-29', '2026-13-01', '2026-1-1', 'tomorrow', '', null])('rejects %p', (v) => {
    expect(t.isValidDate(v)).toBe(false);
  });
  test('accepts a leap day in a leap year', () => expect(t.isValidDate('2028-02-29')).toBe(true));
  test('daysInMonth', () => {
    expect(t.daysInMonth(2026, 2)).toBe(28);
    expect(t.daysInMonth(2028, 2)).toBe(29);
    expect(t.daysInMonth(2026, 11)).toBe(30);
  });
  test('daysBetween is inclusive', () => expect(t.daysBetween('2026-11-01', '2026-11-30')).toBe(30));
  test('addDays crosses month and year', () => expect(t.addDays('2026-12-31', 1)).toBe('2027-01-01'));
  test('monthRange gives a half-open range', () => {
    expect(t.monthRange('2026-12')).toEqual({ start: '2026-12-01', next: '2027-01-01' });
  });
  test('isMeal', () => {
    expect(t.isMeal('L')).toBe(true);
    expect(t.isMeal('X')).toBe(false);
  });
});
