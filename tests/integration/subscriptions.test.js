const { api, db, setupDb, teardownDb, makeUser, planId, subscribeAndPay, payOrder, clock, ist } = require('../helpers');

beforeAll(setupDb);
afterAll(teardownDb);
beforeEach(() => clock.setNow(ist('2026-11-20 06:00')));

describe('plans', () => {
  test('hostellers see only hostel plans, day scholars only day-scholar plans', async () => {
    const h = await makeUser();
    const d = await makeUser({ is_day_scholar: 1 });
    const hp = (await api().get('/api/plans').set(h.auth)).body;
    const dp = (await api().get('/api/plans').set(d.auth)).body;
    expect(hp.every((p) => p.for_day_scholar === 0)).toBe(true);
    expect(dp.every((p) => p.for_day_scholar === 1)).toBe(true);
    expect(dp.length).toBeGreaterThan(0);
  });
});

describe('subscribing and paying', () => {
  test('mid-month subscription is pro-rated and starts pending payment', async () => {
    const s = await makeUser();
    const res = await api().post('/api/subscriptions').set(s.auth).send({ planId: await planId('HOSTEL_VEG'), month: '2026-11' });
    expect(res.status).toBe(201);
    expect(res.body.subscription).toMatchObject({ start_date: '2026-11-20', end_date: '2026-11-30', status: 'pending_payment' });
    expect(res.body.subscription.amount_paise).toBe(132000); // 11/30 of 3600.00
    expect(res.body.order.amountPaise).toBe(132000);
  });

  test('next-month subscription starts on the 1st at full price', async () => {
    const s = await makeUser();
    const res = await api().post('/api/subscriptions').set(s.auth).send({ planId: await planId('HOSTEL_NONVEG'), month: '2026-12' });
    expect(res.body.subscription).toMatchObject({ start_date: '2026-12-01', end_date: '2026-12-31', amount_paise: 420000 });
  });

  test('cannot subscribe two months ahead or in the past', async () => {
    const s = await makeUser();
    const pid = await planId('HOSTEL_VEG');
    expect((await api().post('/api/subscriptions').set(s.auth).send({ planId: pid, month: '2027-01' })).status).toBe(400);
    expect((await api().post('/api/subscriptions').set(s.auth).send({ planId: pid, month: '2026-10' })).status).toBe(400);
    expect((await api().post('/api/subscriptions').set(s.auth).send({ planId: pid, month: 'nov' })).status).toBe(400);
  });

  test('a hosteller cannot buy a day-scholar plan', async () => {
    const s = await makeUser();
    const res = await api().post('/api/subscriptions').set(s.auth).send({ planId: await planId('DAY_LUNCH_VEG'), month: '2026-11' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PLAN_NOT_ELIGIBLE');
  });

  test('overlapping subscriptions are refused', async () => {
    const s = await makeUser();
    await subscribeAndPay(s, 'HOSTEL_VEG', '2026-11');
    const again = await api().post('/api/subscriptions').set(s.auth).send({ planId: await planId('HOSTEL_NONVEG'), month: '2026-11' });
    expect(again.status).toBe(409);
  });

  test('payment verification activates the subscription and is idempotent', async () => {
    const s = await makeUser();
    const res = await api().post('/api/subscriptions').set(s.auth).send({ planId: await planId('HOSTEL_VEG'), month: '2026-12' });
    const co = await api().post(`/api/payments/mock-checkout/${res.body.order.orderId}`).set(s.auth);
    const v1 = await api().post('/api/payments/verify').set(s.auth).send(co.body);
    const v2 = await api().post('/api/payments/verify').set(s.auth).send(co.body);
    expect(v1.body.status).toBe('paid');
    expect(v2.status).toBe(200);
    const sub = await db.get('SELECT status FROM subscriptions WHERE id = ?', [res.body.subscription.id]);
    expect(sub.status).toBe('active');
  });

  test('a forged signature (the "screenshot" attack) is rejected and nothing activates', async () => {
    const s = await makeUser();
    const res = await api().post('/api/subscriptions').set(s.auth).send({ planId: await planId('HOSTEL_VEG'), month: '2026-12' });
    const bad = await api().post('/api/payments/verify').set(s.auth)
      .send({ orderId: res.body.order.orderId, paymentId: 'pay_fake', signature: 'deadbeef' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('BAD_SIGNATURE');
    const sub = await db.get('SELECT status FROM subscriptions WHERE id = ?', [res.body.subscription.id]);
    expect(sub.status).toBe('pending_payment');
  });

  test('a student cannot verify or checkout someone else\'s order', async () => {
    const a = await makeUser();
    const b = await makeUser();
    const res = await api().post('/api/subscriptions').set(a.auth).send({ planId: await planId('HOSTEL_VEG'), month: '2026-12' });
    expect((await api().post(`/api/payments/mock-checkout/${res.body.order.orderId}`).set(b.auth)).status).toBe(404);
    const co = await api().post(`/api/payments/mock-checkout/${res.body.order.orderId}`).set(a.auth);
    expect((await api().post('/api/payments/verify').set(b.auth).send(co.body)).status).toBe(404);
  });

  test('an unpaid subscription can be discarded, a paid one cannot', async () => {
    const s = await makeUser();
    const res = await api().post('/api/subscriptions').set(s.auth).send({ planId: await planId('HOSTEL_VEG'), month: '2026-12' });
    expect((await api().delete(`/api/subscriptions/${res.body.subscription.id}`).set(s.auth)).status).toBe(204);
    const paid = await subscribeAndPay(s, 'HOSTEL_VEG', '2026-12');
    expect((await api().delete(`/api/subscriptions/${paid.id}`).set(s.auth)).status).toBe(409);
  });

  test('payments history lists the student\'s orders', async () => {
    const s = await makeUser();
    await subscribeAndPay(s, 'HOSTEL_VEG', '2026-11');
    const res = await api().get('/api/payments/mine').set(s.auth);
    expect(res.body[0]).toMatchObject({ purpose: 'subscription', status: 'paid' });
  });
});

describe('cancellation', () => {
  test('request -> manager approves -> refund of unused days lands in the wallet', async () => {
    const s = await makeUser();
    const manager = await makeUser({ role: 'manager' });
    const sub = await subscribeAndPay(s, 'HOSTEL_VEG', '2026-11'); // 20..30 Nov, 132000 paid
    const req = await api().post(`/api/subscriptions/${sub.id}/cancel`).set(s.auth);
    expect(req.body.status).toBe('cancel_requested');

    const list = await api().get('/api/admin/cancel-requests').set(manager.auth);
    expect(list.body.map((r) => r.id)).toContain(sub.id);

    const done = await api().post(`/api/admin/subscriptions/${sub.id}/cancel-decision`).set(manager.auth).send({ approve: true });
    // unused = 21..30 Nov = 10 of 11 days; 132000 * 10/11 * 0.5 = 60000
    expect(done.body).toMatchObject({ status: 'cancelled', end_date: '2026-11-20', refund_paise: 60000 });
    const wallet = await api().get('/api/wallet').set(s.auth);
    expect(wallet.body.balance_paise).toBe(60000);
  });

  test('manager can reject a cancellation; deciding twice is refused', async () => {
    const s = await makeUser();
    const manager = await makeUser({ role: 'manager' });
    const sub = await subscribeAndPay(s, 'HOSTEL_VEG', '2026-11');
    await api().post(`/api/subscriptions/${sub.id}/cancel`).set(s.auth);
    const r = await api().post(`/api/admin/subscriptions/${sub.id}/cancel-decision`).set(manager.auth).send({ approve: false });
    expect(r.body.status).toBe('active');
    const again = await api().post(`/api/admin/subscriptions/${sub.id}/cancel-decision`).set(manager.auth).send({ approve: true });
    expect(again.status).toBe(409);
  });

  test('cancelling before the start date leaves no entitlement and refunds every day', async () => {
    const s = await makeUser();
    const manager = await makeUser({ role: 'manager' });
    const sub = await subscribeAndPay(s, 'HOSTEL_VEG', '2026-12');
    await api().post(`/api/subscriptions/${sub.id}/cancel`).set(s.auth);
    const done = await api().post(`/api/admin/subscriptions/${sub.id}/cancel-decision`).set(manager.auth).send({ approve: true });
    expect(done.body.end_date).toBe('2026-11-30');
    expect(done.body.refund_paise).toBe(180000);
  });

  test('cannot cancel someone else\'s subscription or a pending one', async () => {
    const a = await makeUser();
    const b = await makeUser();
    const sub = await subscribeAndPay(a, 'HOSTEL_VEG', '2026-11');
    expect((await api().post(`/api/subscriptions/${sub.id}/cancel`).set(b.auth)).status).toBe(404);
    const pending = await api().post('/api/subscriptions').set(b.auth).send({ planId: await planId('HOSTEL_VEG'), month: '2026-11' });
    expect((await api().post(`/api/subscriptions/${pending.body.subscription.id}/cancel`).set(b.auth)).status).toBe(409);
  });
});

describe('mess office price management', () => {
  test('manager updates a plan price and a meal price; invalid values rejected', async () => {
    const manager = await makeUser({ role: 'manager' });
    const pid = await planId('HOSTEL_VEG');
    const ok = await api().patch(`/api/admin/plans/${pid}`).set(manager.auth).send({ price_paise: 370000 });
    expect(ok.body.price_paise).toBe(370000);
    expect((await api().patch(`/api/admin/plans/${pid}`).set(manager.auth).send({ price_paise: -1 })).status).toBe(400);
    const mp = await api().put('/api/admin/meal-prices').set(manager.auth).send({ meal: 'L', diet: 'veg', price_paise: 7500 });
    expect(mp.body.find((r) => r.meal === 'L' && r.diet === 'veg').price_paise).toBe(7500);
    const all = await api().get('/api/admin/plans').set(manager.auth);
    expect(all.body.length).toBeGreaterThanOrEqual(5);
  });
});
