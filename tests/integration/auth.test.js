const { api, setupDb, teardownDb, makeUser, planId, clock, ist } = require('../helpers');

beforeAll(setupDb);
afterAll(teardownDb);
beforeEach(() => clock.setNow(ist('2026-11-20 06:00')));

const student = { name: 'Test Student', email: 'Stu@Test.local', password: 'longpassword', roll_no: 'R-100', diet_pref: 'veg' };

describe('registration and login', () => {
  test('a new student registers as pending and gets a token', async () => {
    const res = await api().post('/api/auth/register').send(student);
    expect(res.status).toBe(201);
    expect(res.body.user.status).toBe('pending');
    expect(res.body.user.email).toBe('stu@test.local'); // normalised
    expect(res.body.user.password_hash).toBeUndefined();
    expect(res.body.token).toBeTruthy();
  });

  test('duplicate email or roll number is rejected with 409', async () => {
    const res = await api().post('/api/auth/register').send({ ...student, email: 'other@test.local' });
    expect(res.status).toBe(409);
  });

  test.each([
    [{ ...student, email: 'bad' }, 'Invalid email'],
    [{ ...student, email: 'x@y.z', roll_no: 'R-2', password: 'short' }, 'at least 8'],
    [{ name: 'A' }, 'Missing field'],
    [{ ...student, email: 'q@q.q', roll_no: 'R-3', diet_pref: 'vegan' }, 'diet_pref'],
  ])('invalid registration %#', async (body, msg) => {
    const res = await api().post('/api/auth/register').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain(msg);
  });

  test('login works and wrong password gives the same message as unknown email', async () => {
    const ok = await api().post('/api/auth/login').send({ email: 'stu@test.local', password: 'longpassword' });
    expect(ok.status).toBe(200);
    const wrongPw = await api().post('/api/auth/login').send({ email: 'stu@test.local', password: 'nope-nope' });
    const noUser = await api().post('/api/auth/login').send({ email: 'ghost@test.local', password: 'nope-nope' });
    expect(wrongPw.status).toBe(401);
    expect(noUser.status).toBe(401);
    expect(wrongPw.body.error.message).toBe(noUser.body.error.message);
  });

  test('malformed JSON body returns 400', async () => {
    const res = await api().post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_JSON');
  });
});

describe('approval workflow and authorisation', () => {
  test('a pending student cannot subscribe until the manager approves', async () => {
    const login = await api().post('/api/auth/login').send({ email: 'stu@test.local', password: 'longpassword' });
    const auth = { Authorization: `Bearer ${login.body.token}` };
    const body = { planId: await planId('HOSTEL_VEG'), month: '2026-11' };

    const blocked = await api().post('/api/subscriptions').set(auth).send(body);
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('NOT_APPROVED');

    const manager = await makeUser({ role: 'manager' });
    const pending = await api().get('/api/admin/users?status=pending').set(manager.auth);
    const me = pending.body.find((u) => u.email === 'stu@test.local');
    const approve = await api().patch(`/api/admin/users/${me.id}/status`).set(manager.auth).send({ status: 'approved' });
    expect(approve.body.status).toBe('approved');

    const allowed = await api().post('/api/subscriptions').set(auth).send(body);
    expect(allowed.status).toBe(201);
  });

  test('a rejected student cannot log in and an old token stops working', async () => {
    const s = await makeUser();
    const manager = await makeUser({ role: 'manager' });
    await api().patch(`/api/admin/users/${s.id}/status`).set(manager.auth).send({ status: 'rejected' });
    const login = await api().post('/api/auth/login').send({ email: s.email, password: 'Password@123' });
    expect(login.status).toBe(403);
    const me = await api().get('/api/auth/me').set(s.auth);
    expect(me.status).toBe(403);
  });

  test('no token -> 401, bad token -> 401, wrong role -> 403', async () => {
    expect((await api().get('/api/wallet')).status).toBe(401);
    expect((await api().get('/api/wallet').set('Authorization', 'Bearer abc.def.ghi')).status).toBe(401);
    const s = await makeUser();
    expect((await api().get('/api/admin/users').set(s.auth)).status).toBe(403);
    expect((await api().post('/api/scans').set(s.auth).send({})).status).toBe(403);
  });

  test('only an admin can create a manager; a manager can create staff', async () => {
    const manager = await makeUser({ role: 'manager' });
    const admin = await makeUser({ role: 'admin' });
    const staff = await api().post('/api/admin/users').set(manager.auth).send({ name: 'S', email: 's1@x.io', password: 'password1', role: 'staff' });
    expect(staff.status).toBe(201);
    const denied = await api().post('/api/admin/users').set(manager.auth).send({ name: 'M', email: 'm1@x.io', password: 'password1', role: 'manager' });
    expect(denied.status).toBe(403);
    const ok = await api().post('/api/admin/users').set(admin.auth).send({ name: 'M', email: 'm1@x.io', password: 'password1', role: 'manager' });
    expect(ok.status).toBe(201);
  });

  test('a manager cannot change their own status', async () => {
    const manager = await makeUser({ role: 'manager' });
    const res = await api().patch(`/api/admin/users/${manager.id}/status`).set(manager.auth).send({ status: 'disabled' });
    expect(res.status).toBe(400);
  });

  test('committee flag can only be given to students', async () => {
    const manager = await makeUser({ role: 'manager' });
    const staff = await makeUser({ role: 'staff' });
    const s = await makeUser();
    expect((await api().patch(`/api/admin/users/${staff.id}/committee`).set(manager.auth).send({ is_committee: true })).status).toBe(400);
    const ok = await api().patch(`/api/admin/users/${s.id}/committee`).set(manager.auth).send({ is_committee: true });
    expect(ok.body.is_committee).toBe(1);
  });

  test('unknown API route returns JSON 404', async () => {
    const res = await api().get('/api/nope').set((await makeUser()).auth);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
