// Mess committee: polls, menu, ratings and escalated complaints.
(async () => {
  const { api, guard, header, toast, esc, tag, when, MEALS, setupTabs } = MealSync;
  const user = await guard((u) => u.is_committee === 1 || ['manager', 'admin'].includes(u.role));
  if (!user) return;
  header(user);
  const $ = (id) => document.getElementById(id);
  setupTabs((t) => ({ polls: loadPolls, menu: loadMenu, feedback: loadFeedback }[t]()));

  async function loadPolls() {
    const polls = await api('GET', '/polls');
    $('pollList').innerHTML = polls.length ? polls.map((p) => `<div class="card"><b>${esc(p.question)}</b> ${tag(p.open ? 'open' : 'closed', p.open ? 'open' : 'resolved')}
      <div class="muted">Closes ${when(p.closes_at)} · ${p.totalVotes} vote(s)</div>
      <div class="bars">${p.options.map((o) => `<div><span style="min-width:140px">${esc(o.label)}</span><span class="bar" style="width:${p.totalVotes ? (o.votes / p.totalVotes) * 240 : 0}px"></span> ${o.votes}</div>`).join('')}</div>
      ${p.open ? `<button class="small" data-close="${p.id}">Close poll</button>` : ''}</div>`).join('') : '<p class="muted">No polls yet.</p>';
  }
  $('createPoll').addEventListener('click', async () => {
    try {
      const closes = $('pc').value ? new Date($('pc').value).toISOString() : '';
      await api('POST', '/polls', { question: $('pq').value, options: $('po').value.split('\n'), closes_at: closes });
      toast('Poll published'); $('pq').value = ''; $('po').value = '';
    } catch (e) { toast(e.message, true); }
    loadPolls();
  });
  $('pollList').addEventListener('click', async (e) => {
    if (!e.target.dataset.close) return;
    try { await api('POST', `/polls/${e.target.dataset.close}/close`); } catch (err) { toast(err.message, true); }
    loadPolls();
  });

  let menu = [];
  async function loadMenu() {
    menu = await api('GET', '/menu');
    $('weekMenu').innerHTML = window.renderMenuTable(menu);
    fillSlot();
  }
  function fillSlot() {
    const it = menu.find((i) => i.day_of_week === Number($('md').value) && i.meal === $('mm').value && i.diet === $('mdi').value);
    $('mi').value = it ? it.items : '';
  }
  ['md', 'mm', 'mdi'].forEach((id) => $(id).addEventListener('change', fillSlot));
  $('saveMenu').addEventListener('click', async () => {
    try {
      menu = await api('PUT', '/menu', { day_of_week: Number($('md').value), meal: $('mm').value, diet: $('mdi').value, items: $('mi').value });
      $('weekMenu').innerHTML = window.renderMenuTable(menu);
      toast('Menu updated');
    } catch (e) { toast(e.message, true); }
  });

  async function loadFeedback() {
    const [r, complaints] = await Promise.all([api('GET', '/ratings/summary'), api('GET', '/complaints?status=escalated')]);
    $('ratings').innerHTML = `${r.byMeal.length ? r.byMeal.map((m) => `<div>${MEALS[m.meal]}: <b>${m.avg_stars}★</b> <span class="muted">(${m.ratings})</span></div>`).join('') : '<p class="muted">No ratings yet.</p>'}
      ${r.lowest.length ? `<h3>Lowest rated meals</h3><table><tbody>${r.lowest.map((l) => `<tr><td>${l.meal_date}</td><td>${MEALS[l.meal]}</td><td>${l.avg_stars}★ (${l.ratings})</td></tr>`).join('')}</tbody></table>` : ''}`;
    $('escalated').innerHTML = complaints.length ? `<table><tbody>${complaints.map((c) => `<tr><td>#${c.id}</td><td>${tag(c.category)}<div>${esc(c.description)}</div></td>
      <td><button class="small" data-cs="${c.id}:in_progress">Take up</button> <button class="small primary" data-cs="${c.id}:resolved">Resolve</button></td></tr>`).join('')}</tbody></table>`
      : '<p class="muted">Nothing escalated.</p>';
  }
  $('escalated').addEventListener('click', async (e) => {
    if (!e.target.dataset.cs) return;
    const [id, status] = e.target.dataset.cs.split(':');
    const resolution = status === 'resolved' ? prompt('Resolution note:') : undefined;
    if (status === 'resolved' && !resolution) return;
    try { await api('PATCH', `/complaints/${id}`, { status, resolution }); toast('Updated'); } catch (err) { toast(err.message, true); }
    loadFeedback();
  });

  loadPolls();
})();
