// Meal skips with credit, wallet-paid tokens, late plates, and the kitchen headcount.
const { api, db, setupDb, teardownDb, makeUser, subscribeAndPay, clock, ist } = require('../helpers');

let manager;
beforeAll(async () => { await setupDb(); manager = await makeUser({ role: 'manager' }); });
afterAll(teardownDb);

async function hosteller(code = 'HOSTEL_VEG') {
  clock.setNow(ist('2026-11-20 06:00'));
  const s = await makeUser();
  await subscribeAndPay(s, code, '2026-11');
  return s;
}
const skip = (s, date, meal) => api().post('/api/skips').set(s.auth).send({ date, meal });

describe('skipping a meal', () => {
  test('skip before the cutoff credits 60 % of the per-plate cost', async () => {
    const s = await hosteller();
    const res = await skip(s, '2026-11-21', 'L');
    expect(res.status).toBe(201);
    expect(res.body.credit_paise).toBe(1800); // 360000 / (30*4) * 0.6
    const w = await api().get('/api/wallet').set(s.auth);
    expect(w.body.balance_paise).toBe(1800);
    expect(w.body.transactions[0].reason).toBe('skip_credit');
  });

  test('skipping after the cutoff (4 h before the meal) is refused', async () => {
    const s = await hosteller();
    clock.setNow(ist('2026-11-20 08:31')); // lunch 12:30, cutoff 08:30
    const res = await skip(s, '2026-11-20', 'L');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CUTOFF_PASSED');
    expect(res.body.error.cutoff).toBe('2026-11-20T03:00:00.000Z');
  });

  test('cannot skip twice, cannot skip without a subscription, cannot skip a meal not in the plan', async () => {
    const s = await hosteller();
    await skip(s, '2026-11-22', 'D');
    expect((await skip(s, '2026-11-22', 'D')).status).toBe(409);
    expect((await skip(s, '2026-12-05', 'D')).body.error.code).toBe('NO_SUBSCRIPTION');
    const d = await makeUser({ is_day_scholar: 1 });
    await subscribeAndPay(d, 'DAY_LUNCH_VEG', '2026-11');
    expect((await skip(d, '2026-11-22', 'D')).body.error.code).toBe('NO_SUBSCRIPTION');
  });

  test('undoing a skip before the cutoff takes the credit back', async () => {
    const s = await hosteller();
    const res = await skip(s, '2026-11-23', 'B');
    expect((await api().delete(`/api/skips/${res.body.id}`).set(s.auth)).status).toBe(204);
    expect((await api().get('/api/wallet').set(s.auth)).body.balance_paise).toBe(0);
  });

  test('undoing after the cutoff is refused', async () => {
    const s = await hosteller();
    const res = await skip(s, '2026-11-20', 'D');
    clock.setNow(ist('2026-11-20 18:00'));
    expect((await api().delete(`/api/skips/${res.body.id}`).set(s.auth)).status).toBe(400);
  });

  test('monthly skip limit is enforced (setting changed by the manager)', async () => {
    const s = await hosteller();
    await api().patch('/api/admin/settings').set(manager.auth).send({ max_skips_per_month: 1 });
    expect((await skip(s, '2026-11-24', 'B')).status).toBe(201);
    expect((await skip(s, '2026-11-24', 'L')).body.error.code).toBe('SKIP_LIMIT');
    await api().patch('/api/admin/settings').set(manager.auth).send({ max_skips_per_month: 30 });
    const list = await api().get('/api/skips/mine').set(s.auth);
    expect(list.body).toHaveLength(1);
  });

  test('wallet credit can pay for a token; insufficient balance -> 402', async () => {
    const s = await hosteller('HOSTEL_VEG');
    const d = await makeUser({ is_day_scholar: 1 });
    // build up 3600 paise of credit
    await skip(s, '2026-11-25', 'B');
    await skip(s, '2026-11-25', 'L');
    // hosteller already covered for dinner -> cannot buy a dinner token
    expect((await api().post('/api/tokens').set(s.auth).send({ date: '2026-11-21', meal: 'D', diet: 'veg', payWith: 'wallet' })).body.error.code).toBe('ALREADY_ENTITLED');
    // day scholar with empty wallet
    const poor = await api().post('/api/tokens').set(d.auth).send({ date: '2026-11-21', meal: 'D', diet: 'veg', payWith: 'wallet' });
    expect(poor.status).toBe(402);
  });

  test('wallet purchase succeeds when the balance is enough', async () => {
    const s = await makeUser({ is_day_scholar: 1 });
    await db.run(`INSERT INTO wallet_transactions (user_id, amount_paise, reason, created_at) VALUES (?, 5000, 'cancel_refund', '2026-11-20 00:00:00')`, [s.id]);
    const res = await api().post('/api/tokens').set(s.auth).send({ date: '2026-11-21', meal: 'B', diet: 'veg', payWith: 'wallet' });
    expect(res.status).toBe(201);
    expect(res.body.token.status).toBe('active');
    expect((await api().get('/api/wallet').set(s.auth)).body.balance_paise).toBe(1000);
    expect((await api().post('/api/tokens').set(s.auth).send({ date: '2026-11-21', meal: 'B', diet: 'veg', payWith: 'wallet' })).status).toBe(409);
  });

  test('token rules: date window, finished meal, discard pending', async () => {
    const s = await makeUser({ is_day_scholar: 1 });
    clock.setNow(ist('2026-11-20 15:00'));
    expect((await api().post('/api/tokens').set(s.auth).send({ date: '2026-11-30', meal: 'L', diet: 'veg' })).status).toBe(400);
    expect((await api().post('/api/tokens').set(s.auth).send({ date: '2026-11-19', meal: 'L', diet: 'veg' })).status).toBe(400);
    expect((await api().post('/api/tokens').set(s.auth).send({ date: '2026-11-20', meal: 'L', diet: 'veg' })).body.error.code).toBe('MEAL_OVER');
    const p = await api().post('/api/tokens').set(s.auth).send({ date: '2026-11-21', meal: 'L', diet: 'veg' });
    // buying again while unpaid re-uses the same token with a fresh order
    const again = await api().post('/api/tokens').set(s.auth).send({ date: '2026-11-21', meal: 'L', diet: 'veg' });
    expect(again.body.token.id).toBe(p.body.token.id);
    expect((await api().delete(`/api/tokens/${p.body.token.id}`).set(s.auth)).status).toBe(204);
    expect((await api().get('/api/tokens/mine').set(s.auth)).body).toHaveLength(0);
    const prices = await api().get('/api/meal-prices').set(s.auth);
    expect(prices.body).toHaveLength(8);
  });
});

describe('late plates', () => {
  test('need an entitlement, cannot follow a skip, cannot be requested after the meal', async () => {
    const s = await hosteller();
    const none = await makeUser();
    expect((await api().post('/api/late-plates').set(none.auth).send({ date: '2026-11-20', meal: 'L' })).body.error.code).toBe('NO_ENTITLEMENT');
    await skip(s, '2026-11-21', 'L');
    expect((await api().post('/api/late-plates').set(s.auth).send({ date: '2026-11-21', meal: 'L' })).body.error.code).toBe('MEAL_SKIPPED');
    expect((await api().post('/api/late-plates').set(s.auth).send({ date: '2026-11-20', meal: 'L' })).status).toBe(201);
    expect((await api().post('/api/late-plates').set(s.auth).send({ date: '2026-11-20', meal: 'L' })).status).toBe(409);
    clock.setNow(ist('2026-11-20 22:00'));
    expect((await api().post('/api/late-plates').set(s.auth).send({ date: '2026-11-20', meal: 'D' })).body.error.code).toBe('MEAL_OVER');
    expect((await api().get('/api/late-plates/mine').set(s.auth)).body).toHaveLength(1);
  });
});

describe('kitchen headcount', () => {
  test('expected plates = subscribers - skips + tokens, split by diet', async () => {
    await setupDb(); // fresh numbers
    const staff = await makeUser({ role: 'staff' });
    const v1 = await hosteller('HOSTEL_VEG');
    await hosteller('HOSTEL_VEG');
    const nv = await hosteller('HOSTEL_NONVEG');
    const d = await makeUser({ is_day_scholar: 1 });
    await subscribeAndPay(d, 'DAY_LUNCH_NONVEG', '2026-11');
    await skip(v1, '2026-11-21', 'L');
    await skip(nv, '2026-11-21', 'D');
    const tokUser = await makeUser({ is_day_scholar: 1 });
    await db.run(`INSERT INTO meal_tokens (user_id, meal_date, meal, diet, price_paise, status, created_at) VALUES (?, '2026-11-21', 'D', 'veg', 7000, 'active', '2026-11-20 00:00:00')`, [tokUser.id]);

    const res = await api().get('/api/admin/headcount?date=2026-11-21').set(staff.auth);
    expect(res.status).toBe(200);
    expect(res.body.meals.L).toMatchObject({ subscribed: 4, skipped: 1, expected: { veg: 1, nonveg: 2, total: 3 } });
    expect(res.body.meals.D).toMatchObject({ subscribed: 3, skipped: 1, tokens: 1, expected: { veg: 3, nonveg: 0, total: 3 } });
    expect(res.body.meals.B.expected.total).toBe(3);
    expect((await api().get('/api/admin/headcount?date=21-11-2026').set(staff.auth)).status).toBe(400);
  });
});
