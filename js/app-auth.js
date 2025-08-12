<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Super Admin · Companies</title>
  <link href="bootstrap/css/bootstrap.min.css" rel="stylesheet"/>
  <style>
    body{background:#f6f7fb;}
    .page-card{border:0;border-radius:16px;box-shadow:0 6px 24px rgba(26,26,44,.06)}
  </style>
</head>
<body>
<div class="container py-4">
  <div class="d-flex justify-content-between align-items-center mb-3">
    <h1 class="h4 mb-0">Super Admin — Companies</h1>
    <div class="d-flex gap-2">
      <a class="btn btn-outline-secondary btn-sm" href="login.html">Login</a>
      <a class="btn btn-outline-secondary btn-sm" href="dashboard.html">Dashboard</a>
    </div>
  </div>

  <!-- Create company -->
  <div class="card page-card mb-4">
    <div class="card-body">
      <h5 class="card-title">Create Company</h5>
      <form id="createForm" class="row g-3">
        <div class="col-md-4">
          <label class="form-label">Company Name</label>
          <input class="form-control" id="name" required>
        </div>
        <div class="col-md-4">
          <label class="form-label">Account Number</label>
          <input class="form-control" id="acct" required>
        </div>
        <div class="col-md-4">
          <label class="form-label">Logo URL</label>
          <input class="form-control" id="logo" placeholder="https://.../logo.png">
        </div>
        <div class="col-12">
          <button class="btn btn-primary" type="submit">Create</button>
        </div>
      </form>
    </div>
  </div>

  <!-- List companies -->
  <div class="card page-card">
    <div class="card-body">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <h5 class="card-title mb-0">All Companies</h5>
        <small class="text-muted">Click “Set Active” to brand the console to a company.</small>
      </div>
      <div class="table-responsive">
        <table class="table align-middle" id="tenantsTable">
          <thead>
            <tr><th>Name</th><th>Account</th><th>Logo</th><th>Active?</th><th class="text-end">Actions</th></tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
  </div>
</div>

<script src="bootstrap/js/bootstrap.min.js"></script>
<script src="js/app-auth.js"></script>
<script>
  // Super Admin only; bootstrap creates a super session in dev if none
  RBAC.bootstrapForSuperAdmin();
  if (!RBAC.isSuper()) { alert('Super Admin only'); window.location.replace('login.html'); }

  const tbody = document.querySelector('#tenantsTable tbody');

  function render() {
    const tenants = RBAC.getTenants();
    const active  = RBAC.getActiveTenantId();
    tbody.innerHTML = '';
    tenants.forEach(t => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${t.name}</td>
        <td>${t.accountId}</td>
        <td><img src="${t.logoUrl || 'images/Koobs_Logo_Green_.png'}" alt="logo" style="height:28px"></td>
        <td>${active===t.id ? '<span class="badge bg-success">Active</span>' : ''}</td>
        <td class="text-end">
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-secondary" data-active="${t.id}">Set Active</button>
            <button class="btn btn-outline-primary" data-edit="${t.id}">Edit</button>
            <a class="btn btn-outline-dark" href="admin-invite.html?tenantId=${t.id}">Open Admin</a>
          </div>
        </td>`;
      tbody.appendChild(tr);
    });
  }

  render();

  // Create company
  document.getElementById('createForm').addEventListener('submit', (e)=>{
    e.preventDefault();
    try {
      const id = RBAC.createTenant({ name: name.value.trim(), accountId: acct.value.trim(), logoUrl: logo.value.trim() });
      RBAC.setActiveTenant(id);
      e.target.reset();
      render();
      alert('Company created.');
    } catch (err) { alert(err.message); }
  });

  // Table actions
  tbody.addEventListener('click', (e)=>{
    const btnActive = e.target.closest('[data-active]');
    const btnEdit   = e.target.closest('[data-edit]');
    if (btnActive) {
      RBAC.setActiveTenant(btnActive.getAttribute('data-active'));
      render();
    }
    if (btnEdit) {
      const id = btnEdit.getAttribute('data-edit');
      const t  = RBAC.getTenants().find(x=>x.id===id);
      const newName = prompt('Company name:', t.name);         if (newName==null) return;
      const newAcct = prompt('Account number:', t.accountId);  if (newAcct==null) return;
      const newLogo = prompt('Logo URL:', t.logoUrl || '');    if (newLogo==null) return;
      RBAC.updateTenant(id, { name: newName, accountId: newAcct, logoUrl: newLogo });
      render();
    }
  });
</script>
</body>
</html>
