<!-- js/app-auth.js -->
<script>
/**
 * Simple front-end multi-tenant + roles (demo only).
 * Replace with real API later; keep the same method names.
 */
const RBAC = (() => {
  // Roles
  const ROLES = {
    SUPER_ADMIN: 'super_admin',   // your staff
    OWNER: 'owner',               // customer account owner
    ADMIN: 'admin',
    MANAGER: 'manager',
    AGENT: 'agent',
    VIEWER: 'viewer'
  };

  // Permissions map (extend as needed)
  const PERMS = {
    'tenant:create' : [ROLES.SUPER_ADMIN],
    'tenant:update' : [ROLES.SUPER_ADMIN, ROLES.OWNER, ROLES.ADMIN],
    'user:invite'   : [ROLES.OWNER, ROLES.ADMIN],
    'user:update'   : [ROLES.OWNER, ROLES.ADMIN],
    'user:delete'   : [ROLES.OWNER, ROLES.ADMIN],
    'orders:view'   : [ROLES.OWNER, ROLES.ADMIN, ROLES.MANAGER, ROLES.AGENT, ROLES.VIEWER],
    'customers:view': [ROLES.OWNER, ROLES.ADMIN, ROLES.MANAGER, ROLES.AGENT, ROLES.VIEWER],
    'reports:view'  : [ROLES.OWNER, ROLES.ADMIN, ROLES.MANAGER],
    'settings:view' : [ROLES.OWNER, ROLES.ADMIN],
  };

  // Storage keys
  const K = {
    ACTIVE_TENANT: 'activeTenantId', // id string
    TENANTS      : 'tenants',        // [{id, name, accountId, logoUrl}]
    USERS        : 'users',          // [{id, tenantId, name, email, role, status}]
    SESSION      : 'session',        // {userId, tenantId}
  };

  // ---------- helpers ----------
  const _read = (k, fallback) => JSON.parse(localStorage.getItem(k) || JSON.stringify(fallback));
  const _write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const _uuid = () => 'id-' + Math.random().toString(36).slice(2,10);

  // ---------- tenant ----------
  function bootstrapForSuperAdmin() {
    // Create a demo super admin session if nothing exists (dev convenience)
    if (!_read(K.SESSION, null)) {
      const tenants = _read(K.TENANTS, []);
      const users   = _read(K.USERS, []);
      if (tenants.length === 0) {
        const tid = _uuid();
        tenants.push({ id: tid, name: 'Koobs Café', accountId: '494675', logoUrl: 'images/Koobs_Logo_Green_.png' });
        users.push({ id: _uuid(), tenantId: tid, name: 'Owner', email: 'owner@example.com', role: ROLES.OWNER, status: 'active' });
        _write(K.TENANTS, tenants); _write(K.USERS, users);
      }
      // Super admin works outside tenant; you can still set active tenant when viewing one.
      _write(K.SESSION, { userId: 'super', tenantId: _read(K.ACTIVE_TENANT, tenants[0]?.id) });
      localStorage.setItem('super', 'true'); // flag
    }
  }

  function isSuper() { return localStorage.getItem('super') === 'true'; }

  function getTenants() { return _read(K.TENANTS, []); }
  function getUsers(tenantId) { return _read(K.USERS, []).filter(u => u.tenantId === tenantId); }
  function getActiveTenantId() { return _read(K.ACTIVE_TENANT, null); }
  function setActiveTenant(tenantId) { _write(K.ACTIVE_TENANT, tenantId); }
  function getTenant(tenantId = getActiveTenantId()) { return getTenants().find(t => t.id === tenantId) || null; }

  function createTenant({ name, accountId, logoUrl }) {
    requirePerm('tenant:create');
    const tenants = getTenants();
    const id = _uuid();
    tenants.push({ id, name, accountId, logoUrl });
    _write(K.TENANTS, tenants);
    return id;
  }

  function updateTenant(tenantId, patch) {
    requirePerm('tenant:update');
    const tenants = getTenants();
    const i = tenants.findIndex(t => t.id === tenantId);
    if (i >= 0) { tenants[i] = { ...tenants[i], ...patch }; _write(K.TENANTS, tenants); }
  }

  // ---------- users/auth ----------
  function login({ email, password, tenantId }) {
    // DEMO: any password '1234' works; we just find the user in this tenant
    if (password !== '1234') return { ok:false, error:'Invalid credentials' };
    const user = getUsers(tenantId).find(u => u.email === email && u.status !== 'disabled');
    if (!user) return { ok:false, error:'User not found' };
    _write(K.SESSION, { userId: user.id, tenantId });
    return { ok:true, user };
  }

  function logout() { localStorage.removeItem(K.SESSION); localStorage.removeItem('super'); }

  function session() { return _read(K.SESSION, null); }
  function currentUser() {
    const s = session(); if (!s) return null;
    if (s.userId === 'super') return { id:'super', name:'Super Admin', role:ROLES.SUPER_ADMIN };
    return _read(K.USERS, []).find(u => u.id === s.userId) || null;
  }

  function requireAuth() {
    if (!session()) window.location.replace('login.html');
  }

  function inviteUser({ tenantId, name, email, role }) {
    requirePerm('user:invite');
    const users = _read(K.USERS, []);
    users.push({ id: _uuid(), tenantId, name, email, role, status: 'active' });
    _write(K.USERS, users);
  }

  function updateUser(userId, patch) {
    requirePerm('user:update');
    const users = _read(K.USERS, []);
    const i = users.findIndex(u => u.id === userId);
    if (i >= 0) { users[i] = { ...users[i], ...patch }; _write(K.USERS, users); }
  }

  function deleteUser(userId) {
    requirePerm('user:delete');
    const users = _read(K.USERS, []).filter(u => u.id !== userId);
    _write(K.USERS, users);
  }

  // ---------- RBAC ----------
  function can(perm, role = (currentUser()?.role)) {
    const allowed = PERMS[perm] || [];
    return !!role && allowed.includes(role);
  }
  function requirePerm(perm) {
    if (!can(perm)) throw new Error('Forbidden: missing permission ' + perm);
  }

  // ---------- branding for header ----------
  function applyBranding() {
    const t = getTenant();
    if (!t) return;
    document.querySelectorAll('[data-brand-logo]').forEach(el => { el.src = t.logoUrl || 'images/Koobs_Logo_Green_.png'; el.alt = t.name; });
    document.querySelectorAll('[data-brand-name]').forEach(el => { el.textContent = t.name || 'Company'; });
    // Page title: "Page · Company"
    if (t.name) { const base = document.title.split('·')[0].trim(); document.title = `${base} · ${t.name}`; }
  }

  return {
    ROLES, can, requireAuth, currentUser,
    getTenants, getTenant, createTenant, updateTenant,
    getUsers, inviteUser, updateUser, deleteUser,
    getActiveTenantId, setActiveTenant,
    login, logout, session, isSuper, applyBranding, bootstrapForSuperAdmin
  };
})();
</script>
