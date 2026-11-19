const p = require('../../src/utils/pricing');

describe('pricing (all values in paise)', () => {
  test('full month when joining on the 1st', () => {
    expect(p.proratedPrice(360000, '2026-11-01')).toBe(360000);
  });
  test('pro-rated when joining mid-month (16 of 30 days left)', () => {
    expect(p.proratedPrice(360000, '2026-11-15')).toBe(192000);
  });
  test('last day of month pays one day', () => {
    expect(p.proratedPrice(310000, '2026-12-31')).toBe(10000);
  });

  test('per-meal cost divides by days x meals', () => {
    expect(p.perMealCost(360000, '2026-11', 4)).toBe(3000);
  });
  test('skip credit applies the rate and rounds down', () => {
    expect(p.skipCredit(360000, '2026-11', 4, 0.6)).toBe(1800);
    expect(p.skipCredit(150000, '2026-11', 1, 0.6)).toBe(3000);
    expect(p.skipCredit(100000, '2026-11', 3, 0.5)).toBe(555);
  });

  test('cancellation refund for unused days', () => {
    // paid 300000 for 30 days, cancelling with 10 days left at 50 %
    expect(p.cancellationRefund(300000, '2026-11-01', '2026-11-30', '2026-11-21', 0.5)).toBe(50000);
  });
  test('cancelling before the subscription starts refunds every day', () => {
    expect(p.cancellationRefund(300000, '2026-12-01', '2026-12-30', '2026-11-20', 0.5)).toBe(150000);
  });
  test('no refund after the end date', () => {
    expect(p.cancellationRefund(300000, '2026-11-01', '2026-11-30', '2026-12-01', 0.5)).toBe(0);
  });
  test('rupees formatting', () => expect(p.rupees(12345)).toBe('123.45'));
});
