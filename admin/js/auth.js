// ─── Auth Guard ─────────────────────────────────
(function checkAuth() {
  const token = localStorage.getItem('token');
  const isLoginPage = window.location.pathname.includes('login');

  if (!token && !isLoginPage) {
    window.location.href = '/admin/login.html';
  }
})();
