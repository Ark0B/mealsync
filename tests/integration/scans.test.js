// The core anti-fraud flow: rotating pass -> counter scan -> served exactly once.
const { api, db, setupDb, teardownDb, makeUser, subscribeAndPay, payOrder, clock, ist } = require('../helpers');

let staff;
let manager;

beforeAll(async () => {
  await setupDb();
  staff = await makeUser({ role: 'staff' });
  manager = await makeUser({ role: 'manager' });
});
afterAll(teardownDb);

async function subscribedStudent(code = 'HOSTEL_VEG', extra = {}) {
  clock.setNow(ist('2026-11-20 06:00'));
  const s = await makeUser(extra);
  await subscribeAndPay(s, code, '2026-11');
  return s;
}

const getPass = async (s) => (await api().get('/api/pass').set(s.auth)).body.token;
const scan = (token, meal) => api().post('/api/scans').set(staff.auth).send({ token, meal });

describe('scanning a pass at the counter', () => {
  test('subscribed student is served once; a second scan is refused with the time served', async () => {
    const s = await subscribedStudent();
    clock.setNow(ist('2026-11-20 13:00'));
    const token = await getPass(s);

    const first = await scan(token, 'L');
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ ok: true, source: 'subscription', diet: 'veg', meal: 'L' });
    expect(first.body.student.name).toBe(s.name);

    const second = await scan(await getPass(s), 'L');
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('ALREADY_SERVED');
    expect(second.body.error.servedAt).toBeTruthy();
  });

  test('a screenshot of the pass stops working after about a minute', async () => {
    const s = await subscribedStudent();
    clock.setNow(ist('2026-11-20 13:00'));
    const token = await getPass(s);
    clock.setNow(ist('2026-11-20 13:02'));
    const res = await scan(token, 'L');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('EXPIRED_TOKEN');
  });

  test('a forged / edited pass is rejected', async () => {
    const s = await subscribedStudent();
    clock.setNow(ist('2026-11-20 13:00'));
    const token = await getPass(s);
    const other = await makeUser();
    const res = await scan(token.replace(`MS1.${s.id}.`, `MS1.${other.id}.`), 'L');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  test('outside serving hours is refused', async () => {
    const s = await subscribedStudent();
    clock.setNow(ist('2026-11-20 15:00'));
    const res = await scan(await getPass(s), 'L');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('OUTSIDE_MEAL_HOURS');
  });

  test('a day scholar with a lunch plan cannot take dinner', async () => {
    const s = await subscribedStudent('DAY_LUNCH_VEG', { is_day_scholar: 1 });
    clock.setNow(ist('2026-11-20 20:00'));
    const res = await scan(await getPass(s), 'D');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('NO_ENTITLEMENT');
  });

  test('student without subscription is refused; with a paid token is served and the token is used', async () => {
    clock.setNow(ist('2026-11-20 06:00'));
    const s = await makeUser({ is_day_scholar: 1 });
    clock.setNow(ist('2026-11-20 19:45'));
    expect((await scan(await getPass(s), 'D')).body.error.code).toBe('NO_ENTITLEMENT');

    const buy = await api().post('/api/tokens').set(s.auth).send({ date: '2026-11-20', meal: 'D', diet: 'nonveg' });
    expect(buy.status).toBe(201);
    expect(buy.body.order.amountPaise).toBe(10000);
    await payOrder(s, buy.body.order.orderId);

    const ok = await scan(await getPass(s), 'D');
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ source: 'token', diet: 'nonveg' });
    const tok = await db.get('SELECT status FROM meal_tokens WHERE id = ?', [buy.body.token.id]);
    expect(tok.status).toBe('used');
  });

  test('pending (unapproved) students cannot even get a pass', async () => {
    const s = await makeUser({ status: 'pending' });
    expect((await api().get('/api/pass').set(s.auth)).status).toBe(403);
  });

  test('a student disabled after issuing a pass is refused at the counter', async () => {
    const s = await subscribedStudent();
    clock.setNow(ist('2026-11-20 13:00'));
    const token = await getPass(s);
    await db.run(`UPDATE users SET status = 'disabled' WHERE id = ?`, [s.id]);
    const res = await scan(token, 'L');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_INACTIVE');
  });

  test('a skipped meal cannot then be eaten', async () => {
    const s = await subscribedStudent();
    clock.setNow(ist('2026-11-20 07:00'));
    expect((await api().post('/api/skips').set(s.auth).send({ date: '2026-11-20', meal: 'D' })).status).toBe(201);
    clock.setNow(ist('2026-11-20 20:00'));
    const res = await scan(await getPass(s), 'D');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('MEAL_SKIPPED');
  });

  test('late plate holders can be served during the grace period, others cannot', async () => {
    const withLate = await subscribedStudent();
    const without = await subscribedStudent();
    clock.setNow(ist('2026-11-20 20:30'));
    expect((await api().post('/api/late-plates').set(withLate.auth).send({ date: '2026-11-20', meal: 'D' })).status).toBe(201);
    clock.setNow(ist('2026-11-20 22:00')); // window closed at 21:30, grace 60 min
    const a = await scan(await getPass(withLate), 'D');
    expect(a.status).toBe(200);
    expect(a.body.latePlate).toBe(true);
    expect((await scan(await getPass(without), 'D')).status).toBe(403);
    clock.setNow(ist('2026-11-20 22:31'));
    // grace over
    const late2 = await subscribedStudent();
    clock.setNow(ist('2026-11-20 21:00'));
    await api().post('/api/late-plates').set(late2.auth).send({ date: '2026-11-20', meal: 'D' });
    clock.setNow(ist('2026-11-20 22:31'));
    expect((await scan(await getPass(late2), 'D')).status).toBe(403);
  });

  test('every attempt is logged and repeated denials appear in the fraud report', async () => {
    const s = await subscribedStudent();
    clock.setNow(ist('2026-11-20 08:00'));
    await scan(await getPass(s), 'B');
    await scan(await getPass(s), 'B');
    await scan(await getPass(s), 'B');
    await scan(await getPass(s), 'B');
    const attempts = await db.all('SELECT outcome FROM scan_attempts WHERE user_id = ?', [s.id]);
    expect(attempts.map((a) => a.outcome)).toEqual(['served', 'already_served', 'already_served', 'already_served']);

    const fraud = await api().get('/api/admin/reports/fraud?month=2026-11').set(manager.auth);
    const row = fraud.body.find((r) => r.user_id === s.id);
    expect(row).toMatchObject({ denied: 3, repeat_attempts: 3 });

    const recent = await api().get('/api/scans/recent').set(staff.auth);
    expect(recent.body.length).toBeGreaterThan(0);
  });

  test('invalid meal code is a validation error', async () => {
    expect((await scan('x', 'Z')).status).toBe(400);
  });
});
