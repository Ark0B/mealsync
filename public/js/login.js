// Login and self-registration page.
(() => {
  const { api, saveSession, homeFor, toast, setupTabs } = MealSync;
  setupTabs();

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      const session = await api('POST', '/auth/login', { email: f.get('email'), password: f.get('password') });
      saveSession(session);
      location.href = homeFor(session.user);
    } catch (err) { toast(err.message, true); }
  });

  document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    f.is_day_scholar = f.is_day_scholar === '1';
    try {
      const session = await api('POST', '/auth/register', f);
      saveSession(session);
      location.href = '/student.html';
    } catch (err) { toast(err.message, true); }
  });
})();
