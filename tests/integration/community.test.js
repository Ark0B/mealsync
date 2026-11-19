// Complaints, ratings, menu and committee polls.
const { api, db, setupDb, teardownDb, makeUser, subscribeAndPay, clock, ist } = require('../helpers');

let manager; let committee; let student;
beforeAll(async () => {
  await setupDb();
  clock.setNow(ist('2026-11-20 06:00'));
  manager = await makeUser({ role: 'manager' });
  committee = await makeUser({ is_committee: 1 });
  student = await makeUser();
});
afterAll(teardownDb);
beforeEach(() => clock.setNow(ist('2026-11-20 06:00')));

describe('complaints', () => {
  let id;
  test('student files a complaint; short descriptions and bad categories are rejected', async () => {
    const res = await api().post('/api/complaints').set(student.auth)
      .send({ category: 'food_quality', description: 'Dal was undercooked at lunch today', meal_date: '2026-11-19', meal: 'L' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('open');
    id = res.body.id;
    expect((await api().post('/api/complaints').set(student.auth).send({ category: 'food_quality', description: 'bad' })).status).toBe(400);
    expect((await api().post('/api/complaints').set(student.auth).send({ category: 'weather', description: 'long enough text here' })).status).toBe(400);
    expect((await api().get('/api/complaints/mine').set(student.auth)).body).toHaveLength(1);
  });

  test('students cannot see everyone\'s complaints; committee and manager can', async () => {
    expect((await api().get('/api/complaints').set(student.auth)).status).toBe(403);
    expect((await api().get('/api/complaints').set(committee.auth)).body.length).toBe(1);
    expect((await api().get('/api/complaints?status=open').set(manager.auth)).body.length).toBe(1);
  });

  test('committee can act only after the manager escalates', async () => {
    expect((await api().patch(`/api/complaints/${id}`).set(committee.auth).send({ status: 'in_progress' })).status).toBe(403);
    expect((await api().patch(`/api/complaints/${id}`).set(manager.auth).send({ status: 'escalated' })).body.status).toBe('escalated');
    expect((await api().patch(`/api/complaints/${id}`).set(committee.auth).send({ status: 'resolved' })).status).toBe(400); // needs note
    const done = await api().patch(`/api/complaints/${id}`).set(committee.auth).send({ status: 'resolved', resolution: 'Discussed with cook; dal soaked overnight from now on' });
    expect(done.body).toMatchObject({ status: 'resolved', handled_by: committee.id });
  });

  test('a resolved complaint cannot be re-opened (state machine)', async () => {
    const res = await api().patch(`/api/complaints/${id}`).set(manager.auth).send({ status: 'in_progress' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
    expect((await api().patch('/api/complaints/9999').set(manager.auth).send({ status: 'resolved' })).status).toBe(404);
  });
});

describe('ratings', () => {
  test('only meals actually served can be rated, once', async () => {
    const s = await makeUser();
    await subscribeAndPay(s, 'HOSTEL_VEG', '2026-11');
    expect((await api().post('/api/ratings').set(s.auth).send({ date: '2026-11-20', meal: 'L', stars: 4 })).status).toBe(403);

    const staff = await makeUser({ role: 'staff' });
    clock.setNow(ist('2026-11-20 13:00'));
    const pass = (await api().get('/api/pass').set(s.auth)).body.token;
    await api().post('/api/scans').set(staff.auth).send({ token: pass, meal: 'L' });

    expect((await api().post('/api/ratings').set(s.auth).send({ date: '2026-11-20', meal: 'L', stars: 6 })).status).toBe(400);
    expect((await api().post('/api/ratings').set(s.auth).send({ date: '2026-11-20', meal: 'L', stars: 2, comment: 'cold rice' })).status).toBe(201);
    expect((await api().post('/api/ratings').set(s.auth).send({ date: '2026-11-20', meal: 'L', stars: 5 })).status).toBe(409);

    const summary = await api().get('/api/ratings/summary').set(committee.auth);
    expect(summary.body.byMeal).toEqual([{ meal: 'L', ratings: 1, avg_stars: 2 }]);
    expect(summary.body.lowest[0]).toMatchObject({ meal_date: '2026-11-20', meal: 'L' });
  });
});

describe('menu', () => {
  test('everyone can read the menu; only committee/manager can edit it', async () => {
    const week = await api().get('/api/menu').set(student.auth);
    expect(week.body).toHaveLength(56); // 7 days x 4 meals x 2 diets
    const today = await api().get('/api/menu/today').set(student.auth);
    expect(today.body.every((m) => m.day_of_week === 5)).toBe(true); // 20 Nov 2026 is a Friday

    const item = { day_of_week: 5, meal: 'L', diet: 'veg', items: 'Rajma, rice, roti, salad' };
    expect((await api().put('/api/menu').set(student.auth).send(item)).status).toBe(403);
    const ok = await api().put('/api/menu').set(committee.auth).send(item);
    expect(ok.body.find((m) => m.day_of_week === 5 && m.meal === 'L' && m.diet === 'veg').items).toBe(item.items);
    expect((await api().put('/api/menu').set(committee.auth).send({ ...item, day_of_week: 7 })).status).toBe(400);
  });
});

describe('polls', () => {
  let pollId; let options;
  test('committee creates a poll; validation of options and closing time', async () => {
    const base = { question: 'Replace Tuesday dinner aloo gobhi with?', options: ['Chole', 'Paneer bhurji', 'Keep as is'], closes_at: '2026-11-25T12:00:00Z' };
    expect((await api().post('/api/polls').set(student.auth).send(base)).status).toBe(403);
    expect((await api().post('/api/polls').set(committee.auth).send({ ...base, options: ['One'] })).status).toBe(400);
    expect((await api().post('/api/polls').set(committee.auth).send({ ...base, options: ['A', 'a'] })).status).toBe(400);
    expect((await api().post('/api/polls').set(committee.auth).send({ ...base, closes_at: '2026-11-01T00:00:00Z' })).status).toBe(400);
    const res = await api().post('/api/polls').set(committee.auth).send(base);
    expect(res.status).toBe(201);
    expect(res.body.open).toBe(true);
    pollId = res.body.id;
    options = res.body.options;
  });

  test('a student votes exactly once and sees their vote', async () => {
    const v = await api().post(`/api/polls/${pollId}/vote`).set(student.auth).send({ optionId: options[1].id });
    expect(v.body).toMatchObject({ totalVotes: 1, myVote: options[1].id });
    expect((await api().post(`/api/polls/${pollId}/vote`).set(student.auth).send({ optionId: options[0].id })).body.error.code).toBe('ALREADY_VOTED');
  });

  test('option must belong to the poll; closed polls refuse votes', async () => {
    const other = await makeUser();
    expect((await api().post(`/api/polls/${pollId}/vote`).set(other.auth).send({ optionId: 99999 })).status).toBe(400);
    await api().post(`/api/polls/${pollId}/close`).set(committee.auth);
    expect((await api().post(`/api/polls/${pollId}/vote`).set(other.auth).send({ optionId: options[0].id })).body.error.code).toBe('POLL_CLOSED');
    const list = await api().get('/api/polls').set(other.auth);
    expect(list.body[0]).toMatchObject({ id: pollId, open: false, totalVotes: 1 });
    expect((await api().get('/api/polls/12345').set(other.auth)).status).toBe(404);
  });

  test('a poll past its closing time is treated as closed', async () => {
    const res = await api().post('/api/polls').set(committee.auth).send({ question: 'Q?', options: ['x', 'y'], closes_at: '2026-11-21T00:00:00Z' });
    clock.setNow(new Date('2026-11-21T00:00:01Z'));
    const v = await api().post(`/api/polls/${res.body.id}/vote`).set(student.auth).send({ optionId: res.body.options[0].id });
    expect(v.body.error.code).toBe('POLL_CLOSED');
  });
});

describe('audit trail', () => {
  test('manager actions are recorded', async () => {
    const res = await api().get('/api/admin/audit').set(manager.auth);
    const actions = res.body.map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(['complaint_escalated', 'poll_created', 'menu_updated']));
    expect(await db.get('SELECT COUNT(*) AS n FROM audit_log')).toBeTruthy();
  });
});
