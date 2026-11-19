// Student dashboard: pass, subscription, skips, tokens, wallet, feedback, polls.
(async () => {
  const { api, guard, header, toast, esc, rupees, tag, when, MEALS, istDate, setupTabs } = MealSync;
  const user = await guard((u) => u.role === 'student');
  if (!user) return;
  header(user);
  const approved = user.status === 'approved';
  document.getElementById('pendingNotice').hidden = approved;
  if (user.is_committee) {
    const t = document.getElementById('committeeTab');
    t.hidden = false;
    t.addEventListener('click', () => { location.href = '/committee.html'; });
  }

  const loaders = {
    pass: loadPass, plan: loadPlan, meals: loadMeals, tokens: loadTokens,
    wallet: loadWallet, feedback: loadFeedback, polls: loadPolls,
  };
  setupTabs((tab) => loaders[tab] && loaders[tab]());

  // Pay an order through the gateway. In mock mode the "gateway" is a server endpoint;
  // with Razorpay this is where the Razorpay Checkout popup would open instead.
  async function pay(order) {
    if (!confirm(`Pay ${rupees(order.amountPaise)} via UPI / card?`)) return false;
    const result = await api('POST', `/payments/mock-checkout/${order.orderId}`);
    await api('POST', '/payments/verify', result);
    toast('Payment verified ✔');
    return true;
  }

  // ---------------- Pass (rotating QR) ----------------
  let passTimer = null;
  async function loadPass() {
    clearTimeout(passTimer);
    const state = document.getElementById('passState');
    const qrEl = document.getElementById('qr');
    const menu = await api('GET', '/menu/today');
    document.getElementById('todayMenu').innerHTML = Object.entries(MEALS).map(([m, name]) => {
      const rows = menu.filter((i) => i.meal === m && (i.diet === user.diet_pref || user.diet_pref === 'nonveg'));
      return `<p><b>${name}:</b> ${rows.map((r) => `${tag(r.diet === 'veg' ? 'veg' : 'non-veg', r.diet)} ${esc(r.items)}`).join(' &nbsp; ') || '—'}</p>`;
    }).join('');
    if (!approved) { state.textContent = 'Available after approval.'; qrEl.innerHTML = ''; return; }
    try {
      const { token, expiresIn } = await api('GET', '/pass');
      const qr = qrcode(0, 'M');
      qr.addData(token);
      qr.make();
      qrEl.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2 });
      document.getElementById('passCode').textContent = `Manual code: ${token}`;
      state.textContent = '';
      const bar = document.getElementById('bar');
      bar.style.transition = 'none';
      bar.style.width = `${(expiresIn / 30) * 100}%`;
      requestAnimationFrame(() => { bar.style.transition = `width ${expiresIn}s linear`; bar.style.width = '0%'; });
      // Refresh only while the pass tab is visible.
      passTimer = setTimeout(() => {
        if (document.getElementById('pass').classList.contains('active')) loadPass();
      }, expiresIn * 1000);
    } catch (e) { state.textContent = e.message; }
  }

  // ---------------- Subscription ----------------
  async function loadPlan() {
    const [plans, subs] = await Promise.all([api('GET', '/plans'), api('GET', '/subscriptions/mine')]);
    document.getElementById('planSel').innerHTML = plans
      .map((p) => `<option value="${p.id}">${esc(p.name)} — ${rupees(p.price_paise)}/month</option>`).join('');
    const thisMonth = istDate().slice(0, 7);
    const d = new Date(`${thisMonth}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1);
    const nextMonth = d.toISOString().slice(0, 7);
    document.getElementById('monthSel').innerHTML = `<option>${thisMonth}</option><option>${nextMonth}</option>`;

    document.getElementById('mySubs').innerHTML = subs.length ? `<table><thead><tr><th>Plan</th><th>Valid</th><th>Paid</th><th>Status</th><th></th></tr></thead><tbody>${
      subs.map((s) => `<tr><td>${esc(s.plan_name)} ${tag(s.diet)}</td><td>${s.start_date} → ${s.end_date}</td><td>${rupees(s.amount_paise)}${s.refund_paise ? `<div class="muted">refund ${rupees(s.refund_paise)}</div>` : ''}</td>
        <td>${tag(s.end_date < istDate() && s.status === 'active' ? 'expired' : s.status)}</td>
        <td>${s.status === 'active' && s.end_date >= istDate() ? `<button class="small danger" data-cancel="${s.id}">Request cancellation</button>` : ''}
            ${s.status === 'pending_payment' ? `<button class="small" data-discard="${s.id}">Discard</button>` : ''}</td></tr>`).join('')
    }</tbody></table>` : '<p class="muted">No subscription yet.</p>';
  }

  document.getElementById('subscribeBtn').addEventListener('click', async () => {
    try {
      const res = await api('POST', '/subscriptions', { planId: Number(document.getElementById('planSel').value), month: document.getElementById('monthSel').value });
      await pay(res.order);
    } catch (e) { toast(e.message, true); }
    loadPlan();
  });

  document.getElementById('mySubs').addEventListener('click', async (e) => {
    const cancelId = e.target.dataset.cancel;
    const discardId = e.target.dataset.discard;
    try {
      if (cancelId && confirm('Ask the mess office to cancel this subscription? Unused days are partly refunded to your wallet.')) {
        await api('POST', `/subscriptions/${cancelId}/cancel`); toast('Cancellation requested');
      }
      if (discardId) { await api('DELETE', `/subscriptions/${discardId}`); toast('Discarded'); }
    } catch (err) { toast(err.message, true); }
    loadPlan();
  });

  // ---------------- Skips and late plates ----------------
  async function loadMeals() {
    const [skips, lates, history] = await Promise.all([api('GET', '/skips/mine'), api('GET', '/late-plates/mine'), api('GET', '/meals/history')]);
    const skipMap = new Map(skips.map((s) => [`${s.meal_date}:${s.meal}`, s]));
    const lateSet = new Set(lates.map((l) => `${l.meal_date}:${l.meal}`));
    let html = '<table class="meal-grid"><thead><tr><th>Date</th>';
    Object.values(MEALS).forEach((n) => { html += `<th>${n}</th>`; });
    html += '</tr></thead><tbody>';
    for (let i = 0; i < 7; i += 1) {
      const date = istDate(i);
      html += `<tr><td><b>${date}</b></td>`;
      Object.keys(MEALS).forEach((m) => {
        const key = `${date}:${m}`;
        const s = skipMap.get(key);
        if (s) html += `<td>${tag('skipped', 'cancelled')} <div class="muted">+${rupees(s.credit_paise)}</div><button class="small" data-unskip="${s.id}">Undo</button></td>`;
        else if (lateSet.has(key)) html += `<td>${tag('late plate', 'pending')}</td>`;
        else html += `<td><button class="small" data-skip="${key}">Skip</button> <button class="small" data-late="${key}">Late</button></td>`;
      });
      html += '</tr>';
    }
    document.getElementById('mealGrid').innerHTML = `${html}</tbody></table>`;
    document.getElementById('history').innerHTML = history.length
      ? `<table><tbody>${history.slice(0, 30).map((h) => `<tr><td>${h.meal_date}</td><td>${MEALS[h.meal]}</td><td>${tag(h.source)}</td></tr>`).join('')}</tbody></table>`
      : '<p class="muted">Nothing yet.</p>';
  }

  document.getElementById('mealGrid').addEventListener('click', async (e) => {
    const { skip, late, unskip } = e.target.dataset;
    try {
      if (skip) { const [date, meal] = skip.split(':'); const r = await api('POST', '/skips', { date, meal }); toast(`Skipped — ${rupees(r.credit_paise)} credited`); }
      if (late) { const [date, meal] = late.split(':'); await api('POST', '/late-plates', { date, meal }); toast('Late plate requested'); }
      if (unskip) { await api('DELETE', `/skips/${unskip}`); toast('Skip undone'); }
    } catch (err) { toast(err.message, true); }
    loadMeals();
  });

  // ---------------- Tokens ----------------
  async function loadTokens() {
    const [prices, tokens] = await Promise.all([api('GET', '/meal-prices'), api('GET', '/tokens/mine')]);
    document.getElementById('tDate').value = document.getElementById('tDate').value || istDate();
    document.getElementById('prices').innerHTML = `Prices: ${prices.map((p) => `${MEALS[p.meal]} ${p.diet} ${rupees(p.price_paise)}`).join(' · ')}`;
    document.getElementById('myTokens').innerHTML = tokens.length
      ? `<table><tbody>${tokens.map((t) => `<tr><td>${t.meal_date}</td><td>${MEALS[t.meal]}</td><td>${tag(t.diet)}</td><td>${rupees(t.price_paise)}</td><td>${tag(t.status)}</td>
          <td>${t.status === 'pending_payment' ? `<button class="small" data-tdiscard="${t.id}">Discard</button>` : ''}</td></tr>`).join('')}</tbody></table>`
      : '<p class="muted">No tokens.</p>';
  }

  document.getElementById('buyToken').addEventListener('click', async () => {
    try {
      const res = await api('POST', '/tokens', {
        date: document.getElementById('tDate').value,
        meal: document.getElementById('tMeal').value,
        diet: document.getElementById('tDiet').value,
        payWith: document.getElementById('tPay').value,
      });
      if (res.order) await pay(res.order); else toast('Token bought from wallet ✔');
    } catch (e) { toast(e.message, true); }
    loadTokens();
  });
  document.getElementById('myTokens').addEventListener('click', async (e) => {
    if (!e.target.dataset.tdiscard) return;
    try { await api('DELETE', `/tokens/${e.target.dataset.tdiscard}`); } catch (err) { toast(err.message, true); }
    loadTokens();
  });

  // ---------------- Wallet ----------------
  async function loadWallet() {
    const w = await api('GET', '/wallet');
    document.getElementById('walletBal').textContent = rupees(w.balance_paise);
    document.getElementById('walletTx').innerHTML = w.transactions.length
      ? `<table><tbody>${w.transactions.map((t) => `<tr><td>${when(t.created_at)}</td><td>${tag(t.reason)}</td><td style="text-align:right;color:${t.amount_paise < 0 ? 'var(--bad)' : 'var(--ok)'}">${t.amount_paise < 0 ? '−' : '+'}${rupees(Math.abs(t.amount_paise))}</td></tr>`).join('')}</tbody></table>`
      : '<p class="muted">No transactions yet.</p>';
  }

  // ---------------- Feedback ----------------
  async function loadFeedback() {
    const [history, complaints] = await Promise.all([api('GET', '/meals/history'), api('GET', '/complaints/mine')]);
    document.getElementById('rMeal').innerHTML = history.slice(0, 20)
      .map((h) => `<option value="${h.meal_date}|${h.meal}">${h.meal_date} ${MEALS[h.meal]}</option>`).join('') || '<option value="">No meals yet</option>';
    document.getElementById('myComplaints').innerHTML = complaints.length
      ? `<table><tbody>${complaints.map((c) => `<tr><td>#${c.id}</td><td>${tag(c.category)}</td><td>${esc(c.description)}${c.resolution ? `<div class="muted">Resolution: ${esc(c.resolution)}</div>` : ''}</td><td>${tag(c.status)}</td></tr>`).join('')}</tbody></table>`
      : '<p class="muted">No complaints.</p>';
  }

  document.getElementById('rateBtn').addEventListener('click', async () => {
    const v = document.getElementById('rMeal').value;
    if (!v) return;
    const [date, meal] = v.split('|');
    try {
      await api('POST', '/ratings', { date, meal, stars: Number(document.getElementById('rStars').value), comment: document.getElementById('rComment').value });
      toast('Thanks for rating');
    } catch (e) { toast(e.message, true); }
  });

  document.getElementById('complainBtn').addEventListener('click', async () => {
    try {
      await api('POST', '/complaints', {
        category: document.getElementById('cCat').value,
        description: document.getElementById('cDesc').value,
        meal_date: document.getElementById('cDate').value || undefined,
        meal: document.getElementById('cMeal').value || undefined,
      });
      document.getElementById('cDesc').value = '';
      toast('Complaint submitted');
    } catch (e) { toast(e.message, true); }
    loadFeedback();
  });

  // ---------------- Polls and menu ----------------
  async function loadPolls() {
    const [polls, menu] = await Promise.all([api('GET', '/polls'), api('GET', '/menu')]);
    document.getElementById('pollList').innerHTML = polls.length ? polls.map((p) => `
      <div class="card"><b>${esc(p.question)}</b> ${tag(p.open ? 'open' : 'closed', p.open ? 'open' : 'resolved')}
        <div class="muted">Closes ${when(p.closes_at)} · ${p.totalVotes} vote(s)</div>
        <div class="bars">${p.options.map((o) => `<div>
          ${p.open && !p.myVote && approved ? `<button class="small" data-vote="${p.id}:${o.id}">Vote</button>` : ''}
          <span style="min-width:140px">${esc(o.label)}${p.myVote === o.id ? ' ✔' : ''}</span>
          <span class="bar" style="width:${p.totalVotes ? (o.votes / p.totalVotes) * 200 : 0}px"></span> ${o.votes}</div>`).join('')}</div>
      </div>`).join('') : '<p class="muted">No polls yet.</p>';
    const dow = new Date(Date.now() + 330 * 60000).getUTCDay();
    document.getElementById('weekMenu').innerHTML = window.renderMenuTable(menu, { highlightDay: dow });
  }

  document.getElementById('pollList').addEventListener('click', async (e) => {
    if (!e.target.dataset.vote) return;
    const [pollId, optionId] = e.target.dataset.vote.split(':').map(Number);
    try { await api('POST', `/polls/${pollId}/vote`, { optionId }); toast('Vote recorded'); } catch (err) { toast(err.message, true); }
    loadPolls();
  });

  loadPass();
})();
