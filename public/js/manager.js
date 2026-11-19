// Mess office dashboard.
(async () => {
  const { api, guard, header, toast, esc, rupees, tag, when, MEALS, istDate, setupTabs } = MealSync;
  const user = await guard((u) => ['manager', 'admin'].includes(u.role));
  if (!user) return;
  header(user);

  const loaders = {
    today: loadHeadcount, approvals: loadPending, cancels: loadCancels, complaints: loadComplaints,
    reports: loadReports, config: loadConfig, people: loadPeople, audit: loadAudit,
  };
  setupTabs((t) => loaders[t] && loaders[t]());
  const $ = (id) => document.getElementById(id);
  const run = async (fn, okMsg) => { try { await fn(); if (okMsg) toast(okMsg); } catch (e) { toast(e.message, true); } };

  // ---------- Headcount ----------
  $('hcDate').value = istDate();
  $('hcBtn').addEventListener('click', loadHeadcount);
  async function loadHeadcount() {
    const h = await api('GET', `/admin/headcount?date=${$('hcDate').value}`);
    $('hcCards').innerHTML = Object.values(h.meals).map((m) => `<div class="card">
      <h2>${MEALS[m.meal]}</h2><div class="stat">${m.expected.total}</div><div class="muted">plates to prepare</div>
      <p>${tag('veg')} ${m.expected.veg} &nbsp; ${tag('nonveg')} ${m.expected.nonveg}</p>
      <p class="muted">${m.subscribed} subscribed · ${m.skipped} skipped · ${m.tokens} tokens · ${m.latePlates} late plates</p>
      <p><b>${m.served}</b> served so far</p></div>`).join('');
  }

  // ---------- Registrations ----------
  const userRow = (u, actions) => `<tr><td>${esc(u.name)}<div class="muted">${esc(u.email)}</div></td><td>${esc(u.roll_no || '')}</td>
    <td>${u.is_day_scholar ? 'Day scholar' : 'Hosteller'} ${tag(u.diet_pref)}</td><td>${tag(u.status)} ${u.is_committee ? tag('committee', 'ok') : ''}</td><td>${actions}</td></tr>`;
  async function loadPending() {
    const rows = await api('GET', '/admin/users?status=pending');
    $('pending').innerHTML = rows.length ? `<table><tbody>${rows.map((u) => userRow(u,
      `<button class="small primary" data-status="${u.id}:approved">Approve</button> <button class="small danger" data-status="${u.id}:rejected">Reject</button>`)).join('')}</tbody></table>`
      : '<p class="muted">Nothing waiting.</p>';
  }
  $('qBtn').addEventListener('click', async () => {
    const rows = await api('GET', `/admin/users?role=student&q=${encodeURIComponent($('q').value)}`);
    $('qRes').innerHTML = `<table><tbody>${rows.map((u) => userRow(u,
      `${u.status === 'approved' ? `<button class="small danger" data-status="${u.id}:disabled">Disable</button>` : `<button class="small" data-status="${u.id}:approved">Approve</button>`}
       <button class="small" data-committee="${u.id}:${u.is_committee ? 0 : 1}">${u.is_committee ? 'Remove from' : 'Add to'} committee</button>`)).join('')}</tbody></table>`;
  });
  document.body.addEventListener('click', async (e) => {
    const { status, committee } = e.target.dataset;
    if (status) {
      const [id, s] = status.split(':');
      await run(() => api('PATCH', `/admin/users/${id}/status`, { status: s }), `User ${s}`);
      loadPending();
    }
    if (committee) {
      const [id, flag] = committee.split(':');
      await run(() => api('PATCH', `/admin/users/${id}/committee`, { is_committee: flag === '1' }), 'Committee updated');
      $('qBtn').click();
    }
  });

  // ---------- Cancellations ----------
  async function loadCancels() {
    const rows = await api('GET', '/admin/cancel-requests');
    $('cancelList').innerHTML = rows.length ? `<table><tbody>${rows.map((s) => `<tr><td>${esc(s.name)} (${esc(s.roll_no)})</td><td>${esc(s.plan_name)}</td>
      <td>${s.start_date} → ${s.end_date}</td><td>${rupees(s.amount_paise)}</td>
      <td><button class="small primary" data-decide="${s.id}:1">Approve</button> <button class="small" data-decide="${s.id}:0">Reject</button></td></tr>`).join('')}</tbody></table>`
      : '<p class="muted">No pending requests.</p>';
  }
  $('cancelList').addEventListener('click', async (e) => {
    if (!e.target.dataset.decide) return;
    const [id, ok] = e.target.dataset.decide.split(':');
    await run(async () => {
      const r = await api('POST', `/admin/subscriptions/${id}/cancel-decision`, { approve: ok === '1' });
      if (ok === '1') toast(`Cancelled — ${rupees(r.refund_paise)} refunded to wallet`);
    });
    loadCancels();
  });

  // ---------- Complaints ----------
  $('cFilter').addEventListener('change', loadComplaints);
  async function loadComplaints() {
    const rows = await api('GET', `/complaints${$('cFilter').value ? `?status=${$('cFilter').value}` : ''}`);
    $('complaintList').innerHTML = rows.length ? `<table><tbody>${rows.map((c) => `<tr><td>#${c.id}<div class="muted">${when(c.created_at)}</div></td>
      <td>${esc(c.name)}<div class="muted">${esc(c.roll_no || '')}</div></td><td>${tag(c.category)} ${c.meal ? MEALS[c.meal] : ''} ${esc(c.meal_date || '')}<div>${esc(c.description)}</div>
      ${c.resolution ? `<div class="muted">Resolution: ${esc(c.resolution)}</div>` : ''}</td><td>${tag(c.status)}</td>
      <td>${c.status === 'resolved' ? '' : `<button class="small" data-cs="${c.id}:in_progress">Working</button>
        <button class="small" data-cs="${c.id}:escalated">To committee</button> <button class="small primary" data-cs="${c.id}:resolved">Resolve</button>`}</td></tr>`).join('')}</tbody></table>`
      : '<p class="muted">No complaints.</p>';
  }
  $('complaintList').addEventListener('click', async (e) => {
    if (!e.target.dataset.cs) return;
    const [id, status] = e.target.dataset.cs.split(':');
    const resolution = status === 'resolved' ? prompt('Resolution note (shown to the student):') : undefined;
    if (status === 'resolved' && !resolution) return;
    await run(() => api('PATCH', `/complaints/${id}`, { status, resolution }), 'Updated');
    loadComplaints();
  });

  // ---------- Reports ----------
  $('rMonth').value = istDate().slice(0, 7);
  $('rBtn').addEventListener('click', loadReports);
  async function loadReports() {
    const month = $('rMonth').value;
    const [s, fraud] = await Promise.all([api('GET', `/admin/reports/summary?month=${month}`), api('GET', `/admin/reports/fraud?month=${month}`)]);
    const list = (rows, label, value) => (rows.length ? rows.map((r) => `<div>${esc(label(r))}: <b>${value(r)}</b></div>`).join('') : '<div class="muted">—</div>');
    $('summaryCards').innerHTML = `
      <div class="card"><h2>Revenue</h2><div class="stat">${rupees(s.totalRevenuePaise)}</div>${list(s.revenue, (r) => r.purpose, (r) => `${rupees(r.amount_paise)} (${r.payments})`)}</div>
      <div class="card"><h2>Subscriptions</h2>${list(s.subscriptions, (r) => r.plan, (r) => r.count)}</div>
      <div class="card"><h2>Meals served</h2>${list(s.mealsServed, (r) => MEALS[r.meal], (r) => r.count)}</div>
      <div class="card"><h2>Skips</h2><div class="stat">${s.skips.count}</div><div class="muted">${rupees(s.skips.creditPaise)} credited · food not cooked</div></div>
      <div class="card"><h2>Complaints</h2>${list(s.complaints, (r) => r.status, (r) => r.count)}</div>
      <div class="card"><h2>Refused scans</h2>${list(s.deniedScans, (r) => r.outcome.replace(/_/g, ' '), (r) => r.count)}</div>`;
    $('fraud').innerHTML = fraud.length ? `<table><thead><tr><th>Student</th><th>Refused</th><th>Second-plate</th><th>Stale pass</th><th>No entitlement</th></tr></thead><tbody>${
      fraud.map((f) => `<tr><td>${esc(f.name)} (${esc(f.roll_no || '')})</td><td>${f.denied}</td><td>${f.repeat_attempts}</td><td>${f.stale_passes}</td><td>${f.no_entitlement}</td></tr>`).join('')}</tbody></table>`
      : '<p class="muted">No signals this month.</p>';
  }
  // CSV needs the auth header, so fetch it and save as a file.
  $('csvBtn').addEventListener('click', async () => {
    const month = $('rMonth').value;
    const res = await fetch(`/api/admin/reports/meals.csv?month=${month}`, { headers: { Authorization: `Bearer ${localStorage.getItem('mealsync_token')}` } });
    if (!res.ok) return toast('Export failed', true);
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a'); a.href = url; a.download = `mealsync-meals-${month}.csv`; a.click();
    URL.revokeObjectURL(url);
  });

  // ---------- Prices & rules ----------
  async function loadConfig() {
    const [plans, prices, settings] = await Promise.all([api('GET', '/admin/plans'), api('GET', '/meal-prices'), api('GET', '/admin/settings')]);
    $('planList').innerHTML = `<table><tbody>${plans.map((p) => `<tr><td>${esc(p.name)}<div class="muted">${esc(p.code)} · meals ${esc(p.meals)}</div></td>
      <td>₹ <input type="number" min="1" step="1" value="${p.price_paise / 100}" data-plan-price="${p.id}" style="width:110px" /></td>
      <td>${p.active ? tag('active') : tag('inactive', 'cancelled')}</td>
      <td><button class="small" data-plan-save="${p.id}">Save</button> <button class="small" data-plan-toggle="${p.id}:${p.active ? 0 : 1}">${p.active ? 'Deactivate' : 'Activate'}</button></td></tr>`).join('')}</tbody></table>`;
    $('mealPrices').innerHTML = `<table><tbody>${prices.map((p) => `<tr><td>${MEALS[p.meal]}</td><td>${tag(p.diet)}</td>
      <td>₹ <input type="number" min="1" step="1" value="${p.price_paise / 100}" data-mp="${p.meal}:${p.diet}" style="width:100px" /></td>
      <td><button class="small" data-mp-save="${p.meal}:${p.diet}">Save</button></td></tr>`).join('')}</tbody></table>`;
    const labels = {
      skip_cutoff_hours: 'Skip cut-off (hours before meal)', skip_credit_rate: 'Skip credit rate (0–1)',
      max_skips_per_month: 'Max skips per month', cancel_refund_rate: 'Cancellation refund rate (0–1)', late_plate_grace_minutes: 'Late-plate grace (minutes)',
    };
    $('settings').innerHTML = Object.entries(labels).map(([k, l]) => `<label>${l}</label><input data-setting="${k}" value="${esc(settings[k])}" />`).join('');
  }
  $('config').addEventListener('click', async (e) => {
    const d = e.target.dataset;
    if (d.planSave) {
      const v = Math.round(Number(document.querySelector(`[data-plan-price="${d.planSave}"]`).value) * 100);
      await run(() => api('PATCH', `/admin/plans/${d.planSave}`, { price_paise: v }), 'Plan price saved');
    }
    if (d.planToggle) {
      const [id, active] = d.planToggle.split(':');
      await run(() => api('PATCH', `/admin/plans/${id}`, { active: active === '1' }), 'Plan updated');
      loadConfig();
    }
    if (d.mpSave) {
      const [meal, diet] = d.mpSave.split(':');
      const v = Math.round(Number(document.querySelector(`[data-mp="${d.mpSave}"]`).value) * 100);
      await run(() => api('PUT', '/admin/meal-prices', { meal, diet, price_paise: v }), 'Price saved');
    }
  });
  $('saveSettings').addEventListener('click', async () => {
    const body = {};
    document.querySelectorAll('[data-setting]').forEach((i) => { body[i.dataset.setting] = i.value; });
    await run(() => api('PATCH', '/admin/settings', body), 'Rules saved');
  });

  // ---------- People ----------
  async function loadPeople() {
    const rows = await api('GET', '/admin/users?role=student');
    const members = rows.filter((u) => u.is_committee);
    $('committeeList').innerHTML = members.length ? `<ul>${members.map((m) => `<li>${esc(m.name)} (${esc(m.roll_no || '')})</li>`).join('')}</ul>` : '<p class="muted">No committee members.</p>';
  }
  $('createStaff').addEventListener('click', async () => {
    await run(() => api('POST', '/admin/users', { name: $('sName').value, email: $('sEmail').value, password: $('sPw').value, role: $('sRole').value }), 'Account created');
  });

  // ---------- Audit ----------
  async function loadAudit() {
    const rows = await api('GET', '/admin/audit');
    $('auditList').innerHTML = `<table><tbody>${rows.map((a) => `<tr><td>${when(a.created_at)}</td><td>${esc(a.actor_name)}</td><td>${tag(a.action, 'ok')}</td>
      <td>${esc(a.entity)} ${a.entity_id ?? ''}</td><td class="muted">${esc(a.details || '')}</td></tr>`).join('')}</tbody></table>`;
  }

  loadHeadcount();
})();
