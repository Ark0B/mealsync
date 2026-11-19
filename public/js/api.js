// Shared browser helpers used by every page.
const MealSync = (() => {
  const MEALS = { B: 'Breakfast', L: 'Lunch', S: 'Snacks', D: 'Dinner' };
  const tokenKey = 'mealsync_token';
  const userKey = 'mealsync_user';

  const getToken = () => localStorage.getItem(tokenKey);
  const getUser = () => JSON.parse(localStorage.getItem(userKey) || 'null');

  function saveSession({ token, user }) {
    localStorage.setItem(tokenKey, token);
    localStorage.setItem(userKey, JSON.stringify(user));
  }

  function logout() {
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(userKey);
    location.href = '/';
  }

  // fetch wrapper: adds the JWT, parses JSON, throws Error(message) on failure.
  async function api(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (res.status === 401 && path !== '/auth/login') { logout(); throw new Error('Session expired'); }
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error((data.error && data.error.message) || `Request failed (${res.status})`);
      err.code = data.error && data.error.code;
      err.data = data.error;
      throw err;
    }
    return data;
  }

  // Redirect away unless the logged-in user is allowed on this page.
  async function guard(check) {
    if (!getToken()) { location.href = '/'; return null; }
    try {
      const { user } = await api('GET', '/auth/me');
      localStorage.setItem(userKey, JSON.stringify(user));
      if (!check(user)) { location.href = homeFor(user); return null; }
      return user;
    } catch { logout(); return null; }
  }

  function homeFor(user) {
    if (user.role === 'staff') return '/scanner.html';
    if (user.role === 'manager' || user.role === 'admin') return '/manager.html';
    return '/student.html';
  }

  let toastTimer;
  function toast(message, isError = false) {
    let el = document.querySelector('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
    el.textContent = message;
    el.className = `toast show${isError ? ' error' : ''}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = 'toast'; }, 3500);
  }

  // Escape text before putting it into innerHTML (prevents stored XSS from names/complaints).
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rupees = (paise) => `₹${(Number(paise || 0) / 100).toFixed(2)}`;
  const tag = (text, cls = text) => `<span class="tag ${esc(cls)}">${esc(String(text).replace(/_/g, ' '))}</span>`;

  // DB timestamps are UTC 'YYYY-MM-DD HH:MM:SS'; show them in IST, e.g. "20 Nov, 13:05".
  function when(stamp) {
    if (!stamp) return '';
    const d = new Date(`${String(stamp).replace(' ', 'T')}Z`);
    if (Number.isNaN(d.getTime())) return esc(stamp);
    return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
  }

  // Today's date in IST as YYYY-MM-DD (the mess runs on IST whatever the device timezone).
  function istDate(offsetDays = 0) {
    const d = new Date(Date.now() + 330 * 60000 + offsetDays * 86400000);
    return d.toISOString().slice(0, 10);
  }
  function currentMealCode() {
    const d = new Date(Date.now() + 330 * 60000);
    const m = d.getUTCHours() * 60 + d.getUTCMinutes();
    if (m >= 450 && m < 570) return 'B';
    if (m >= 750 && m < 870) return 'L';
    if (m >= 1020 && m < 1080) return 'S';
    if (m >= 1170 && m < 1290) return 'D';
    return null;
  }

  // Simple tab switching: <nav class="tabs"><button data-tab="x"> + <section class="panel" id="x">
  function setupTabs(onShow) {
    const buttons = document.querySelectorAll('nav.tabs button');
    buttons.forEach((b) => b.addEventListener('click', () => {
      buttons.forEach((x) => x.classList.toggle('active', x === b));
      document.querySelectorAll('section.panel').forEach((p) => p.classList.toggle('active', p.id === b.dataset.tab));
      if (onShow) onShow(b.dataset.tab);
    }));
  }

  function header(user) {
    const who = document.querySelector('header.top .who');
    if (who) who.textContent = `${user.name} · ${user.role}${user.is_committee ? ' · committee' : ''}`;
    const out = document.querySelector('#logout');
    if (out) out.addEventListener('click', logout);
  }

  return { MEALS, when, api, guard, saveSession, logout, homeFor, toast, esc, rupees, tag, istDate, currentMealCode, setupTabs, header, getUser };
})();
