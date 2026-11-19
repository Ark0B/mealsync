// Monthly report, CSV export (Excel), settings validation.
const { api, db, setupDb, teardownDb, makeUser, subscribeAndPay, clock, ist } = require('../helpers');

let manager; let staff;
beforeAll(async () => {
  await setupDb();
  clock.setNow(ist('2026-11-20 06:00'));
  manager = await makeUser({ role: 'manager' });
  staff = await makeUser({ role: 'staff' });
});
afterAll(teardownDb);

test('monthly summary adds up revenue, meals, skips and denied scans', async () => {
  clock.setNow(ist('2026-11-20 06:00'));
  const a = await makeUser({ name: '=HYPERLINK("evil")' }); // CSV-injection attempt in a name
  const b = await makeUser();
  await subscribeAndPay(a, 'HOSTEL_VEG', '2026-11'); // 132000
  await subscribeAndPay(b, 'HOSTEL_NONVEG', '2026-11'); // 154000
  await api().post('/api/skips').set(b.auth).send({ date: '2026-11-22', meal: 'B' });
  await api().post('/api/complaints').set(a.auth).send({ category: 'hygiene', description: 'Plates were not washed properly' });

  clock.setNow(ist('2026-11-20 08:00'));
  const pass = (await api().get('/api/pass').set(a.auth)).body.token;
  await api().post('/api/scans').set(staff.auth).send({ token: pass, meal: 'B' });
  await api().post('/api/scans').set(staff.auth).send({ token: pass, meal: 'B' }); // denied: already served

  const res = await api().get('/api/admin/reports/summary?month=2026-11').set(manager.auth);
  expect(res.status).toBe(200);
  expect(res.body.totalRevenuePaise).toBe(286000);
  expect(res.body.revenue).toEqual([{ purpose: 'subscription', payments: 2, amount_paise: 286000 }]);
  expect(res.body.subscriptions).toHaveLength(2);
  expect(res.body.mealsServed).toEqual([{ meal: 'B', count: 1 }]);
  expect(res.body.skips.count).toBe(1);
  expect(res.body.complaints).toEqual([{ status: 'open', count: 1 }]);
  expect(res.body.deniedScans).toEqual([{ outcome: 'already_served', count: 1 }]);
  expect((await api().get('/api/admin/reports/summary?month=11-2026').set(manager.auth)).status).toBe(400);
});

test('CSV export is downloadable and neutralises spreadsheet formulas', async () => {
  const res = await api().get('/api/admin/reports/meals.csv?month=2026-11').set(manager.auth);
  expect(res.status).toBe(200);
  expect(res.headers['content-type']).toMatch(/text\/csv/);
  expect(res.headers['content-disposition']).toContain('mealsync-meals-2026-11.csv');
  const lines = res.text.split('\n');
  expect(lines[0]).toBe('date,meal,roll_no,name,source,served_at_utc');
  expect(lines[1]).toContain(`"'=HYPERLINK(""evil"")"`);
});

test('settings: read, valid update, out-of-range and unknown keys rejected', async () => {
  const get = await api().get('/api/admin/settings').set(manager.auth);
  expect(get.body.skip_cutoff_hours).toBe('4');
  const ok = await api().patch('/api/admin/settings').set(manager.auth).send({ skip_cutoff_hours: 6 });
  expect(ok.body.skip_cutoff_hours).toBe('6');
  expect((await api().patch('/api/admin/settings').set(manager.auth).send({ skip_credit_rate: 5 })).status).toBe(400);
  expect((await api().patch('/api/admin/settings').set(manager.auth).send({ free_food: 1 })).status).toBe(400);
  expect((await api().patch('/api/admin/settings').set(manager.auth).send({})).status).toBe(400);
  const changed = await db.get(`SELECT * FROM audit_log WHERE action = 'setting_changed'`);
  expect(changed.details).toBe('skip_cutoff_hours=6');
});

test('user search for the mess office', async () => {
  const res = await api().get('/api/admin/users?role=student&q=HYPERLINK').set(manager.auth);
  expect(res.body).toHaveLength(1);
});

test('health check and API docs are reachable', async () => {
  expect((await api().get('/api/health')).body).toEqual({ status: 'ok' });
  const docs = await api().get('/api-docs/');
  expect(docs.status).toBe(200);
  expect(docs.text).toContain('swagger');
});
