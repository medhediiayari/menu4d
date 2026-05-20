// ─── API Client ─────────────────────────────────
const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

async function api(endpoint, options = {}) {
  const token = getToken();
  const headers = { ...options.headers };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('admin');
    window.location.href = '/admin/login.html';
    return;
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erreur serveur');
  return data;
}

// Shortcuts
const api_get = (url) => api(url);
const api_post = (url, body) => api(url, { method: 'POST', body });
const api_put = (url, body) => api(url, { method: 'PUT', body });
const api_patch = (url, body) => api(url, { method: 'PATCH', body });
const api_delete = (url) => api(url, { method: 'DELETE' });

async function api_upload(dishId, files, category = 'image') {
  const token = getToken();
  const formData = new FormData();
  formData.append('fileCategory', category);
  for (const file of files) {
    formData.append('files', file);
  }

  const res = await fetch(`${API_BASE}/upload/${dishId}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erreur upload');
  return data;
}
