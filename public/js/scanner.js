// Counter scanner. Uses the device camera (html5-qrcode) or a typed code.
(async () => {
  const { api, guard, header, toast, esc, tag, when, MEALS, currentMealCode, istDate } = MealSync;
  const user = await guard((u) => ['staff', 'manager', 'admin'].includes(u.role));
  if (!user) return;
  header(user);

  const mealSel = document.getElementById('meal');
  mealSel.value = currentMealCode() || 'L';

  const result = document.getElementById('result');
  let busy = false;
  let lastToken = '';

  // Beep for success / failure so staff do not have to look at the screen every time.
  function beep(ok) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(); o.frequency.value = ok ? 880 : 220;
      o.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + (ok ? 0.12 : 0.4));
    } catch { /* audio not available */ }
  }

  async function check(token) {
    if (busy || !token) return;
    busy = true;
    try {
      const r = await api('POST', '/scans', { token: token.trim(), meal: mealSel.value });
      result.className = 'scan-result ok';
      result.innerHTML = `<div class="big">✔ SERVE</div><div>${esc(r.student.name)} · ${esc(r.student.roll_no || '')}</div>
        <div><span class="diet">${r.diet === 'veg' ? 'VEG ONLY' : 'NON-VEG OK'}</span></div>
        <div class="muted" style="color:#fff">${r.source === 'token' ? 'Paid token' : 'Subscription'}${r.latePlate ? ' · late plate' : ''}</div>`;
      beep(true);
    } catch (e) {
      result.className = 'scan-result bad';
      const extra = e.data && e.data.servedAt ? `<div>Served at ${when(e.data.servedAt)}${e.data.student ? ` · ${esc(e.data.student.name)}` : ''}</div>` : '';
      result.innerHTML = `<div class="big">✖ DO NOT SERVE</div><div>${esc(e.message)}</div>${extra}`;
      beep(false);
    }
    loadRecent();
    loadHeadcount();
    setTimeout(() => { busy = false; }, 1200); // ignore the same QR for a moment
  }

  // Camera scanning
  let scanner = null;
  document.getElementById('camBtn').addEventListener('click', async () => {
    if (scanner) { await scanner.stop(); scanner = null; document.getElementById('camBtn').textContent = 'Start camera'; return; }
    try {
      scanner = new Html5Qrcode('reader');
      await scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: 250 }, (text) => {
        if (text === lastToken && busy) return;
        lastToken = text;
        check(text);
      });
      document.getElementById('camBtn').textContent = 'Stop camera';
    } catch (e) {
      scanner = null;
      toast(`Camera unavailable: ${e.message || e}. Use the code box instead (camera needs HTTPS or localhost).`, true);
    }
  });

  document.getElementById('manualBtn').addEventListener('click', () => check(document.getElementById('manual').value));
  document.getElementById('manual').addEventListener('keydown', (e) => { if (e.key === 'Enter') check(e.target.value); });

  async function loadRecent() {
    const rows = await api('GET', '/scans/recent');
    document.getElementById('recent').innerHTML = rows.length ? `<table><tbody>${rows.map((r) => `<tr>
      <td>${when(r.created_at)}</td><td>${MEALS[r.meal]}</td><td>${esc(r.name || 'unknown')}</td><td>${esc(r.roll_no || '')}</td>
      <td>${tag(r.outcome, r.outcome === 'served' ? 'ok' : 'bad')}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">No scans yet.</p>';
  }

  async function loadHeadcount() {
    const h = await api('GET', `/admin/headcount?date=${istDate()}`);
    const m = h.meals[mealSel.value];
    document.getElementById('headcount').innerHTML = `<b>${MEALS[m.meal]}</b>: served <b>${m.served}</b> of ~${m.expected.total} expected
      (${m.expected.veg} veg, ${m.expected.nonveg} non-veg) · ${m.skipped} skipped · ${m.latePlates} late plates`;
  }
  mealSel.addEventListener('change', loadHeadcount);

  loadRecent();
  loadHeadcount();
})();
