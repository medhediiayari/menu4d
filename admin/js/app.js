// ─── Admin App ──────────────────────────────────
let restaurantsData = [];
let currentRestaurantId = null;
let categoriesData = [];
let dishesData = [];
let pendingImageFiles = [];
let pending3DFiles = [];
let pendingLogoFile = null;

// ─── Init ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Set admin email
  const admin = JSON.parse(localStorage.getItem('admin') || '{}');
  document.getElementById('adminEmail').textContent = admin.email || '';

  // Restore active restaurant
  currentRestaurantId = localStorage.getItem('currentRestaurantId') || null;

  // Nav
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(item.dataset.section);
    });
  });

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('admin');
    window.location.href = '/admin/login.html';
  });

  // Forms
  document.getElementById('restaurantForm').addEventListener('submit', saveRestaurant);
  document.getElementById('categoryForm').addEventListener('submit', saveCategory);
  document.getElementById('dishForm').addEventListener('submit', saveDish);
  document.getElementById('addRestaurantBtn').addEventListener('click', () => openRestaurantModal());
  document.getElementById('addCategoryBtn').addEventListener('click', () => openCategoryModal());
  document.getElementById('addDishBtn').addEventListener('click', () => openDishModal());
  document.getElementById('filterCategory').addEventListener('change', loadDishes);

  // Color pickers sync
  setupColorSync();

  // Logo upload
  setupLogoUpload();

  // File upload
  setupDropzone();

  // Load data
  await loadDashboard();
});

// ─── Color picker sync ───────────────────────────
function setupColorSync() {
  const pairs = [
    ['primaryColor', 'primaryColorHex'],
    ['secondaryColor', 'secondaryColorHex'],
    ['accentColor', 'accentColorHex'],
  ];
  pairs.forEach(([colorName, hexName]) => {
    const colorInput = document.querySelector(`[name="${colorName}"]`);
    const hexInput = document.querySelector(`[name="${hexName}"]`);
    if (!colorInput || !hexInput) return;
    colorInput.addEventListener('input', () => { hexInput.value = colorInput.value; });
    hexInput.addEventListener('input', () => {
      if (/^#[0-9a-fA-F]{6}$/.test(hexInput.value)) {
        colorInput.value = hexInput.value;
      }
    });
  });
}

// ─── Logo Upload ─────────────────────────────────
function setupLogoUpload() {
  const dz = document.getElementById('dropzoneLogo');
  const input = document.getElementById('logoInput');
  if (!dz || !input) return;

  dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
  dz.addEventListener('drop', (e) => {
    e.preventDefault();
    dz.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
      pendingLogoFile = e.dataTransfer.files[0];
      showLogoPreview(pendingLogoFile);
    }
  });
  input.addEventListener('change', () => {
    if (input.files.length) {
      pendingLogoFile = input.files[0];
      showLogoPreview(pendingLogoFile);
    }
  });
}

function showLogoPreview(file) {
  const preview = document.getElementById('logoPreview');
  const url = URL.createObjectURL(file);
  preview.innerHTML = `<img src="${url}" style="max-width:100px;max-height:60px;border-radius:6px;border:1px solid var(--border);" />`;
}

// ─── Navigation ──────────────────────────────────
function navigateTo(section) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));

  const navItem = document.querySelector(`.nav-item[data-section="${section}"]`);
  if (navItem) navItem.classList.add('active');

  document.getElementById(`sec-${section}`).classList.add('active');
  document.getElementById('pageTitle').textContent = navItem?.textContent.trim() || section;

  // Load section data
  if (section === 'dashboard') loadDashboard();
  if (section === 'restaurants') loadRestaurants();
  if (section === 'categories') loadCategories();
  if (section === 'dishes') loadDishes();
  if (section === 'analytics') loadAnalytics();
}

// ─── Dashboard ───────────────────────────────────
async function loadDashboard() {
  try {
    restaurantsData = await api_get('/restaurant');
    updateRestaurantSelector();

    document.getElementById('statCategories').textContent = restaurantsData.reduce((n, r) => n + (r.categories?.length || 0), 0);
    document.getElementById('statDishes').textContent = restaurantsData.reduce((n, r) =>
      n + (r.categories?.reduce((m, c) => m + (c._count?.dishes || 0), 0) || 0), 0);
    document.getElementById('statAR').textContent = restaurantsData.length + ' restaurants';
    document.getElementById('statImages').textContent = '—';
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function updateRestaurantSelector() {
  const sel = document.getElementById('activeRestaurantSelect');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Sélectionner un restaurant —</option>' +
    restaurantsData.map(r => `<option value="${r.id}" ${r.id === currentRestaurantId ? 'selected' : ''}>${escHtml(r.name)}</option>`).join('');
  updateSidebarRestaurantCtx();
}

function updateSidebarRestaurantCtx() {
  const ctx = document.getElementById('sidebarRestaurantCtx');
  const nameEl = document.getElementById('sidebarRestaurantName');
  if (!ctx || !nameEl) return;
  if (currentRestaurantId) {
    const r = restaurantsData.find(x => x.id === currentRestaurantId);
    if (r) {
      nameEl.textContent = r.name;
      ctx.style.display = 'block';
      return;
    }
  }
  ctx.style.display = 'none';
}

function switchRestaurant() {
  const sel = document.getElementById('activeRestaurantSelect');
  currentRestaurantId = sel.value || null;
  localStorage.setItem('currentRestaurantId', currentRestaurantId || '');
  categoriesData = [];
  updateSidebarRestaurantCtx();
  // Refresh current section if it depends on the selected restaurant
  const activeSection = document.querySelector('.section.active');
  if (activeSection) {
    const id = activeSection.id.replace('sec-', '');
    if (id === 'categories') loadCategories();
    else if (id === 'dishes') loadDishes();
  }
  loadRestaurants();
}

// ─── Restaurants ─────────────────────────────────
async function loadRestaurants() {
  try {
    restaurantsData = await api_get('/restaurant');
    updateRestaurantSelector();
    renderRestaurants();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderRestaurants() {
  const grid = document.getElementById('restaurantsList');
  if (!restaurantsData.length) {
    grid.innerHTML = '<p style="color:var(--text-dim)">Aucun restaurant. Créez-en un !</p>';
    return;
  }

  grid.innerHTML = restaurantsData.map(r => {
    const totalDishes = r.categories?.reduce((n, c) => n + (c._count?.dishes || 0), 0) || 0;
    return `
      <div class="restaurant-card">
        <div class="restaurant-card-header">
          <div class="restaurant-card-logo">
            ${r.logoUrl ? `<img src="${escHtml(r.logoUrl)}" alt="" />` : '🏪'}
          </div>
          <div class="restaurant-card-info">
            <h4>${escHtml(r.name)}</h4>
            <p>${escHtml(r.subtitle || r.address || '')}</p>
            <div class="restaurant-card-colors">
              <span class="swatch" style="background:${r.primaryColor || '#c9a84c'}"></span>
              <span class="swatch" style="background:${r.secondaryColor || '#0a0806'}"></span>
              <span class="swatch" style="background:${r.accentColor || '#f0e8d8'}"></span>
            </div>
          </div>
        </div>
        <div class="restaurant-card-body">
          <span>📂 ${r.categories?.length || 0} catégories · 🍽️ ${totalDishes} plats</span>
          ${r.googleReviewUrl ? '<span>⭐ Google Review configuré</span>' : ''}
          ${r.whatsappNumber ? '<span>💬 WhatsApp: ' + escHtml(r.whatsappNumber) + '</span>' : ''}
          <span style="font-family:monospace;font-size:11px;color:var(--gold);">/menu/${escHtml(r.slug)}</span>
        </div>
        <div class="restaurant-card-footer">
          <button class="btn btn-sm btn-secondary" onclick="openRestaurantModal('${r.id}')">✏️ Modifier</button>
          <button class="btn btn-sm btn-secondary" onclick="showQRCode('${r.id}')">📱 QR Code</button>
          <button class="btn btn-sm btn-outline" onclick="selectRestaurant('${r.id}')">Gérer le menu</button>
          <button class="btn btn-sm btn-danger" onclick="deleteRestaurant('${r.id}')">Supprimer</button>
        </div>
      </div>
    `;
  }).join('');
}

function selectRestaurant(id) {
  currentRestaurantId = id;
  localStorage.setItem('currentRestaurantId', id);
  categoriesData = [];
  updateRestaurantSelector();
  navigateTo('categories');
  showToast('Restaurant sélectionné', 'success');
}

function openRestaurantModal(id = null) {
  const form = document.getElementById('restaurantForm');
  form.reset();
  form.querySelector('[name="id"]').value = '';
  pendingLogoFile = null;
  document.getElementById('logoPreview').innerHTML = '';

  // Reset color pickers
  form.querySelector('[name="primaryColor"]').value = '#c9a84c';
  form.querySelector('[name="primaryColorHex"]').value = '#c9a84c';
  form.querySelector('[name="secondaryColor"]').value = '#0a0806';
  form.querySelector('[name="secondaryColorHex"]').value = '#0a0806';
  form.querySelector('[name="accentColor"]').value = '#f0e8d8';
  form.querySelector('[name="accentColorHex"]').value = '#f0e8d8';

  if (id) {
    const r = restaurantsData.find(x => x.id === id);
    if (r) {
      document.getElementById('restaurantModalTitle').textContent = 'Modifier le restaurant';
      form.querySelector('[name="id"]').value = r.id;
      form.querySelector('[name="name"]').value = r.name || '';
      form.querySelector('[name="slug"]').value = r.slug || '';
      form.querySelector('[name="subtitle"]').value = r.subtitle || '';
      form.querySelector('[name="address"]').value = r.address || '';
      form.querySelector('[name="phone"]').value = r.phone || '';
      form.querySelector('[name="googleReviewUrl"]').value = r.googleReviewUrl || '';
      form.querySelector('[name="whatsappNumber"]').value = r.whatsappNumber || '';
      form.querySelector('[name="logoUrl"]').value = r.logoUrl || '';
      if (r.primaryColor) {
        form.querySelector('[name="primaryColor"]').value = r.primaryColor;
        form.querySelector('[name="primaryColorHex"]').value = r.primaryColor;
      }
      if (r.secondaryColor) {
        form.querySelector('[name="secondaryColor"]').value = r.secondaryColor;
        form.querySelector('[name="secondaryColorHex"]').value = r.secondaryColor;
      }
      if (r.accentColor) {
        form.querySelector('[name="accentColor"]').value = r.accentColor;
        form.querySelector('[name="accentColorHex"]').value = r.accentColor;
      }
      if (r.logoUrl) {
        document.getElementById('logoPreview').innerHTML = `<img src="${escHtml(r.logoUrl)}" style="max-width:100px;max-height:60px;border-radius:6px;border:1px solid var(--border);" />`;
      }
    }
  } else {
    document.getElementById('restaurantModalTitle').textContent = 'Nouveau restaurant';
  }
  openModal('restaurantModal');
}

async function saveRestaurant(e) {
  e.preventDefault();
  const form = e.target;
  const id = form.querySelector('[name="id"]').value;
  const data = {
    name: form.querySelector('[name="name"]').value,
    slug: form.querySelector('[name="slug"]').value,
    subtitle: form.querySelector('[name="subtitle"]').value || null,
    address: form.querySelector('[name="address"]').value || null,
    phone: form.querySelector('[name="phone"]').value || null,
    logoUrl: form.querySelector('[name="logoUrl"]').value || null,
    primaryColor: form.querySelector('[name="primaryColor"]').value,
    secondaryColor: form.querySelector('[name="secondaryColor"]').value,
    accentColor: form.querySelector('[name="accentColor"]').value,
    googleReviewUrl: form.querySelector('[name="googleReviewUrl"]').value || null,
    whatsappNumber: form.querySelector('[name="whatsappNumber"]').value || null,
  };

  try {
    if (id) {
      await api_put(`/restaurant/${id}`, data);
      showToast('Restaurant mis à jour', 'success');
    } else {
      const created = await api_post('/restaurant', data);
      currentRestaurantId = created.id;
      localStorage.setItem('currentRestaurantId', created.id);
      showToast('Restaurant créé', 'success');
    }
    closeModal('restaurantModal');
    await loadRestaurants();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteRestaurant(id) {
  if (!confirm('Supprimer ce restaurant et tout son contenu (catégories, plats) ?')) return;
  try {
    await api_delete(`/restaurant/${id}`);
    if (currentRestaurantId === id) {
      currentRestaurantId = null;
      localStorage.removeItem('currentRestaurantId');
    }
    showToast('Restaurant supprimé', 'success');
    await loadRestaurants();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── QR Code ─────────────────────────────────────
function showQRCode(id) {
  const r = restaurantsData.find(x => x.id === id);
  if (!r) return;

  const menuUrl = `${window.location.origin}/menu/${r.slug}`;
  document.getElementById('qrRestaurantName').textContent = r.name;
  document.getElementById('qrMenuUrl').textContent = menuUrl;

  const container = document.getElementById('qrCodeContainer');
  container.innerHTML = '';

  if (typeof QRCode !== 'undefined') {
    const canvas = document.createElement('canvas');
    QRCode.toCanvas(canvas, menuUrl, {
      width: 256,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });
    container.appendChild(canvas);
  } else {
    container.innerHTML = `<p style="color:#000;padding:20px;">QR: ${escHtml(menuUrl)}</p>`;
  }

  openModal('qrModal');
}

function downloadQR() {
  const canvas = document.querySelector('#qrCodeContainer canvas');
  if (!canvas) return;
  const link = document.createElement('a');
  link.download = 'qr-menu.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

// ─── Categories ──────────────────────────────────
async function loadCategories() {
  if (!currentRestaurantId) {
    document.getElementById('categoriesList').innerHTML = '<p style="color:var(--text-dim)">Sélectionnez d\'abord un restaurant dans la section Restaurants.</p>';
    return;
  }
  try {
    categoriesData = await api_get('/categories?restaurantId=' + currentRestaurantId);
    renderCategories();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderCategories() {
  const list = document.getElementById('categoriesList');
  if (!categoriesData.length) {
    list.innerHTML = '<p style="color:var(--text-dim)">Aucune catégorie. Créez-en une !</p>';
    return;
  }
  list.innerHTML = categoriesData.map(cat => `
    <div class="list-item" data-id="${cat.id}">
      <div class="list-item-info">
        <h4>${escHtml(cat.name)}</h4>
        <p>${escHtml(cat.eyebrow || '')} · ${cat._count?.dishes || 0} plats · Ordre: ${cat.sortOrder}</p>
      </div>
      <div class="list-item-actions">
        <button class="btn btn-sm btn-secondary" onclick="openCategoryModal('${cat.id}')">Modifier</button>
        <button class="btn btn-sm btn-danger" onclick="deleteCategory('${cat.id}')">Supprimer</button>
      </div>
    </div>
  `).join('');
}

function openCategoryModal(id = null) {
  const form = document.getElementById('categoryForm');
  form.reset();
  form.id.value = '';

  if (id) {
    const cat = categoriesData.find(c => c.id === id);
    if (cat) {
      document.getElementById('categoryModalTitle').textContent = 'Modifier la catégorie';
      form.id.value = cat.id;
      form.name.value = cat.name;
      form.slug.value = cat.slug;
      form.eyebrow.value = cat.eyebrow || '';
      form.sortOrder.value = cat.sortOrder;
    }
  } else {
    document.getElementById('categoryModalTitle').textContent = 'Nouvelle catégorie';
  }
  openModal('categoryModal');
}

async function saveCategory(e) {
  e.preventDefault();
  const form = e.target;
  const data = {
    name: form.name.value,
    slug: form.slug.value,
    eyebrow: form.eyebrow.value,
    sortOrder: parseInt(form.sortOrder.value) || 0,
  };

  try {
    if (form.id.value) {
      await api_put(`/categories/${form.id.value}`, data);
      showToast('Catégorie modifiée', 'success');
    } else {
      if (!currentRestaurantId) {
        showToast('Sélectionnez d\'abord un restaurant', 'error');
        return;
      }
      data.restaurantId = currentRestaurantId;
      await api_post('/categories', data);
      showToast('Catégorie créée', 'success');
    }
    closeModal('categoryModal');
    await loadCategories();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteCategory(id) {
  if (!confirm('Supprimer cette catégorie et tous ses plats ?')) return;
  try {
    await api_delete(`/categories/${id}`);
    showToast('Catégorie supprimée', 'success');
    await loadCategories();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── Dishes ──────────────────────────────────────
async function loadDishes() {
  if (!currentRestaurantId) {
    document.getElementById('dishesList').innerHTML = '<p style="color:var(--text-dim)">Sélectionnez d\'abord un restaurant dans la section Restaurants.</p>';
    return;
  }
  try {
    if (!categoriesData.length) {
      categoriesData = await api_get('/categories?restaurantId=' + currentRestaurantId);
    }

    // Populate filter
    const filter = document.getElementById('filterCategory');
    const currentVal = filter.value;
    filter.innerHTML = '<option value="">Toutes les catégories</option>' +
      categoriesData.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('');
    filter.value = currentVal;

    // Populate dish form category select
    const select = document.getElementById('dishCategorySelect');
    select.innerHTML = categoriesData.map(c =>
      `<option value="${c.id}">${escHtml(c.name)}</option>`
    ).join('');

    // Load dishes
    const params = filter.value
      ? `?categoryId=${filter.value}`
      : `?restaurantId=${currentRestaurantId}`;
    dishesData = await api_get(`/dishes${params}`);
    renderDishes();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderDishes() {
  const grid = document.getElementById('dishesList');
  if (!dishesData.length) {
    grid.innerHTML = '<p style="color:var(--text-dim)">Aucun plat. Ajoutez-en un !</p>';
    return;
  }

  grid.innerHTML = dishesData.map(dish => {
    const img = dish.files.find(f => f.type === 'IMAGE' || f.type === 'THUMBNAIL');
    const hasAR = dish.files.some(f => f.type === 'USDZ');
    const has3D = dish.files.some(f => f.type === 'OBJ');
    const badges = [
      hasAR ? '<span class="badge badge-ar">AR</span>' : '',
      has3D ? '<span class="badge badge-3d">3D</span>' : '',
      dish.featured ? '<span class="badge badge-featured">Vedette</span>' : '',
      !dish.visible ? '<span class="badge badge-hidden">Masqué</span>' : '',
    ].filter(Boolean).join('');

    return `
      <div class="dish-card" data-id="${dish.id}">
        ${img ? `<img class="dish-card-img" src="${img.url}" alt="" loading="lazy" />` : '<div class="dish-card-img"></div>'}
        <div class="dish-card-body">
          <h4>${escHtml(dish.name)}</h4>
          <p>${escHtml((dish.description || '').slice(0, 80))}${dish.description?.length > 80 ? '...' : ''}</p>
        </div>
        <div class="dish-card-footer">
          <span class="dish-price">${dish.price} €${dish.priceLabel ? ' ' + escHtml(dish.priceLabel) : ''}</span>
          <div class="dish-badges">${badges}</div>
        </div>
        <div style="padding:0 16px 12px; display:flex; gap:8px;">
          <button class="btn btn-sm btn-secondary" onclick="openDishModal('${dish.id}')">Modifier</button>
          <button class="btn btn-sm btn-danger" onclick="deleteDish('${dish.id}')">Supprimer</button>
        </div>
      </div>
    `;
  }).join('');
}

function openDishModal(id = null) {
  const form = document.getElementById('dishForm');
  form.reset();
  form.querySelector('[name="id"]').value = '';
  form.querySelector('[name="visible"]').checked = true;
  pendingImageFiles = [];
  pending3DFiles = [];
  document.getElementById('dishImageFiles').innerHTML = '';
  document.getElementById('dish3DFiles').innerHTML = '';

  if (id) {
    const dish = dishesData.find(d => d.id === id);
    if (dish) {
      document.getElementById('dishModalTitle').textContent = 'Modifier le plat';
      form.querySelector('[name="id"]').value = dish.id;
      form.querySelector('[name="name"]').value = dish.name;
      form.querySelector('[name="price"]').value = dish.price;
      form.querySelector('[name="categoryId"]').value = dish.categoryId;
      form.querySelector('[name="subcategory"]').value = dish.subcategory || '';
      form.querySelector('[name="description"]').value = dish.description || '';
      form.querySelector('[name="allergens"]').value = dish.allergens || '';
      form.querySelector('[name="priceLabel"]').value = dish.priceLabel || '';
      form.querySelector('[name="featured"]').checked = dish.featured;
      form.querySelector('[name="visible"]').checked = dish.visible;

      // Show existing files
      renderDishFiles(dish.files);
    }
  } else {
    document.getElementById('dishModalTitle').textContent = 'Nouveau plat';
  }
  openModal('dishModal');
}

function renderDishFiles(files) {
  const imageGrid = document.getElementById('dishImageFiles');
  const threeDGrid = document.getElementById('dish3DFiles');

  const imageFiles = files.filter(f => f.type === 'IMAGE');
  const threeDFiles = files.filter(f => f.type === 'USDZ' || f.type === 'OBJ');

  imageGrid.innerHTML = imageFiles.map(f => `
    <div class="upload-file">
      <img src="${f.url}" alt="" />
      <span class="file-badge">IMG</span>
      <button class="file-remove" onclick="removeFile('${f.id}')">×</button>
    </div>
  `).join('');

  threeDGrid.innerHTML = threeDFiles.map(f => `
    <div class="upload-file">
      <div style="display:flex;align-items:center;justify-content:center;height:100%;background:var(--surface-2);color:var(--text-dim);font-size:11px;">${f.type}<br>${f.filename.split('.').pop()}</div>
      <span class="file-badge">${f.type}</span>
      <button class="file-remove" onclick="removeFile('${f.id}')">×</button>
    </div>
  `).join('');
}

async function removeFile(fileId) {
  const form = document.getElementById('dishForm');
  const dishId = form.querySelector('[name="id"]').value;
  if (!dishId) return;
  try {
    await api_delete(`/dishes/${dishId}/files/${fileId}`);
    const dish = await api_get(`/dishes/${dishId}`);
    renderDishFiles(dish.files);
    showToast('Fichier supprimé', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function saveDish(e) {
  e.preventDefault();
  const form = e.target;
  const data = {
    name: form.querySelector('[name="name"]').value,
    price: parseFloat(form.querySelector('[name="price"]').value),
    categoryId: form.querySelector('[name="categoryId"]').value,
    subcategory: form.querySelector('[name="subcategory"]').value || null,
    description: form.querySelector('[name="description"]').value || null,
    allergens: form.querySelector('[name="allergens"]').value || null,
    priceLabel: form.querySelector('[name="priceLabel"]').value || null,
    featured: form.querySelector('[name="featured"]').checked,
    visible: form.querySelector('[name="visible"]').checked,
  };

  const id = form.querySelector('[name="id"]').value;

  try {
    let dish;
    if (id) {
      dish = await api_put(`/dishes/${id}`, data);
    } else {
      dish = await api_post('/dishes', data);
    }

    // Upload pending files
    if (pendingImageFiles.length > 0) {
      await api_upload(dish.id, pendingImageFiles, 'image');
      pendingImageFiles = [];
    }
    if (pending3DFiles.length > 0) {
      await api_upload(dish.id, pending3DFiles, '3d');
      pending3DFiles = [];
    }

    showToast(id ? 'Plat modifié' : 'Plat créé', 'success');
    closeModal('dishModal');
    await loadDishes();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteDish(id) {
  if (!confirm('Supprimer ce plat ?')) return;
  try {
    await api_delete(`/dishes/${id}`);
    showToast('Plat supprimé', 'success');
    await loadDishes();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── File Upload (dropzones) ─────────────────────
function setupDropzone() {
  // Image dropzone
  const dzImage = document.getElementById('dropzoneImage');
  const imageInput = document.getElementById('imageInput');

  dzImage.addEventListener('dragover', (e) => { e.preventDefault(); dzImage.classList.add('dragover'); });
  dzImage.addEventListener('dragleave', () => dzImage.classList.remove('dragover'));
  dzImage.addEventListener('drop', (e) => {
    e.preventDefault();
    dzImage.classList.remove('dragover');
    handleImageFiles(e.dataTransfer.files);
  });
  imageInput.addEventListener('change', () => {
    handleImageFiles(imageInput.files);
    imageInput.value = '';
  });

  // 3D dropzone
  const dz3D = document.getElementById('dropzone3D');
  const file3DInput = document.getElementById('file3DInput');

  dz3D.addEventListener('dragover', (e) => { e.preventDefault(); dz3D.classList.add('dragover'); });
  dz3D.addEventListener('dragleave', () => dz3D.classList.remove('dragover'));
  dz3D.addEventListener('drop', (e) => {
    e.preventDefault();
    dz3D.classList.remove('dragover');
    handle3DFiles(e.dataTransfer.files);
  });
  file3DInput.addEventListener('change', () => {
    handle3DFiles(file3DInput.files);
    file3DInput.value = '';
  });
}

function handleImageFiles(fileList) {
  for (const file of fileList) {
    pendingImageFiles.push(file);
  }
  renderPendingImages();
}

function handle3DFiles(fileList) {
  for (const file of fileList) {
    pending3DFiles.push(file);
  }
  renderPending3D();
}

function renderPendingImages() {
  const grid = document.getElementById('dishImageFiles');
  grid.querySelectorAll('[data-pending]').forEach(el => el.remove());

  pendingImageFiles.forEach((file, i) => {
    const div = document.createElement('div');
    div.className = 'upload-file';
    div.dataset.pending = i;
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    div.appendChild(img);
    div.innerHTML += `<span class="file-badge">IMG</span>`;
    div.innerHTML += `<button class="file-remove" onclick="removePendingImage(${i})">×</button>`;
    grid.appendChild(div);
  });
}

function renderPending3D() {
  const grid = document.getElementById('dish3DFiles');
  grid.querySelectorAll('[data-pending]').forEach(el => el.remove());

  pending3DFiles.forEach((file, i) => {
    const div = document.createElement('div');
    div.className = 'upload-file';
    div.dataset.pending = i;
    const ext = file.name.split('.').pop().toUpperCase();
    div.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;background:var(--surface-2);color:var(--green);font-size:11px;font-weight:600;">${ext}</div>`;
    div.innerHTML += `<span class="file-badge">${ext}</span>`;
    div.innerHTML += `<button class="file-remove" onclick="removePending3D(${i})">×</button>`;
    grid.appendChild(div);
  });
}

function removePendingImage(index) {
  pendingImageFiles.splice(index, 1);
  renderPendingImages();
}

function removePending3D(index) {
  pending3DFiles.splice(index, 1);
  renderPending3D();
}

// ─── Utilities ───────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ─── Analytics ─────────────────────────────────────
let analyticsChart = null;

async function loadAnalytics() {
  const days = document.getElementById('analyticsPeriod')?.value || 30;
  try {
    const data = await api_get(`/analytics/summary?days=${days}`);
    renderAnalytics(data);
  } catch (err) {
    console.error('Analytics load failed:', err);
  }
}

function renderAnalytics(data) {
  document.getElementById('analyticsPageViews').textContent = data.totals.pageViews.toLocaleString();
  document.getElementById('analyticsARClicks').textContent = data.totals.arClicks.toLocaleString();
  document.getElementById('analyticsDishViews').textContent = data.totals.dishViews.toLocaleString();

  // Top dishes
  const topDishesEl = document.getElementById('topDishesTable');
  topDishesEl.innerHTML = data.topDishes.length === 0
    ? '<p style="color:var(--text-dim);font-size:12px;">Aucune donnée</p>'
    : data.topDishes.map((d, i) => `
      <div class="analytics-rank">
        <div class="analytics-rank-num">${i + 1}</div>
        <div class="analytics-rank-name">${escHtml(d.name)}</div>
        <div class="analytics-rank-count">${d.views}</div>
      </div>
    `).join('');

  // Top AR
  const topAREl = document.getElementById('topARTable');
  topAREl.innerHTML = data.topAR.length === 0
    ? '<p style="color:var(--text-dim);font-size:12px;">Aucune donnée</p>'
    : data.topAR.map((d, i) => `
      <div class="analytics-rank">
        <div class="analytics-rank-num">${i + 1}</div>
        <div class="analytics-rank-name">${escHtml(d.name)}</div>
        <div class="analytics-rank-count">${d.clicks}</div>
      </div>
    `).join('');

  // Daily chart (simple canvas bars)
  renderDailyChart(data.daily);
}

function renderDailyChart(daily) {
  const canvas = document.getElementById('chartDaily');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width - 40;
  canvas.height = 200;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!daily || daily.length === 0) {
    ctx.fillStyle = '#888';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText('Aucune donnée', canvas.width / 2 - 40, 100);
    return;
  }

  const maxCount = Math.max(...daily.map(d => d.count), 1);
  const barWidth = Math.max(4, (canvas.width - 40) / daily.length - 2);
  const chartHeight = canvas.height - 40;

  daily.forEach((day, i) => {
    const x = 30 + i * (barWidth + 2);
    const barH = (day.count / maxCount) * chartHeight;
    const y = chartHeight - barH + 10;

    // Bar
    ctx.fillStyle = '#c9a84c';
    ctx.beginPath();
    ctx.roundRect(x, y, barWidth, barH, 2);
    ctx.fill();

    // Label (show every few bars)
    if (daily.length <= 14 || i % Math.ceil(daily.length / 7) === 0) {
      ctx.fillStyle = '#888';
      ctx.font = '9px Inter, sans-serif';
      const label = new Date(day.day).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      ctx.fillText(label, x - 4, canvas.height - 4);
    }
  });

  // Y axis max
  ctx.fillStyle = '#888';
  ctx.font = '10px Inter, sans-serif';
  ctx.fillText(maxCount.toString(), 2, 18);
  ctx.fillText('0', 2, chartHeight + 10);
}
