<!-- js/app-auth.js -->
<script>
/**
 * Front-end multi-tenant + roles (demo).
 * Tenants live in localStorage.tenants = [{id,name,accountId,logoUrl}]
 * Users   live in localStorage.users   = [{id,tenantId,name,email,role,status}]
 * Session in localStorage.session      = {userId, tenantId}
 *
 * ✨ NEW:
 * - accessibleTenants(): list of companies the current user can access
 * - renderCompanySwitcher(selectEl): populates a <select> to switch active company
 * - shows 'Super Admin' features if RBAC.isSuper() (can manage all companies)
 */
const RBAC = (() => {
  // Roles
  const ROLES = {
    SUPER_ADMIN: 'super_admin',
    OWNER: 'owner',
    ADMIN: 'admin',
    MANAGER: 'manager',
    AGENT: 'agent',
    VIEWER: 'viewer'
  };

  // Permissions map
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
    ACTIVE_TENANT: 'activeTenantId',
    TENANTS      : 'tenants',
    USERS        : 'users',
    SESSION      : 'session', // {userId, tenantId}
  };

  // ---------- helpers ----------
  const _read  = (k, fallback) => JSON.parse(localStorage.getItem(k) || JSON.stringify(fallback));
  const _write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const _uuid  = () => 'id-' + Math.random().toString(36).slice(2,10);

  // ---------- bootstrap (dev convenience) ----------
  function bootstrapForSuperAdmin() {
    // If no session, create some seed data and sign in as super admin (dev only)
    if (!_read(K.SESSION, null)) {
      const tenants = _read(K.TENANTS, []);
      const users   = _read(K.USERS, []);
      if (tenants.length === 0) {
        const t1 = _uuid();
        tenants.push({ id: t1, name: 'Koobs Café', accountId: '494675', logoUrl: 'images/Koobs_Logo_Green_.png' });
        users.push({ id: _uuid(), tenantId: t1, name: 'Owner', email: 'owner@koobs.test', role: ROLES.OWNER, status: 'active' });
        _write(K.TENANTS, tenants); _write(K.USERS, users);
      }
      // Super admin session (works outside tenant context, but we set an active one to brand UI)
      const activeId = _read(K.ACTIVE_TENANT, _read(K.TENANTS, [])[0]?.id || null);
      _write(K.SESSION, { userId: 'super', tenantId: activeId });
      localStorage.setItem('super', 'true');
    }
  }

  function isSuper() { return localStorage.getItem('super') === 'true'; }

  // ---------- tenants ----------
  function getTenants() { return _read(K.TENANTS, []); }
  function getActiveTenantId() { return _read(K.ACTIVE_TENANT, null); }
  function setActiveTenant(tenantId) { _write(K.ACTIVE_TENANT, tenantId); /* keep session tenant aligned if logged in */ const s=session(); if (s) _write(K.SESSION,{...s,tenantId}); }
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
  function getUsers(tenantId) { return _read(K.USERS, []).filter(u => u.tenantId === tenantId); }

  function login({ email, password, tenantId }) {
    if (password !== '1234') return { ok:false, error:'Invalid credentials' };
    // Super admin special email (optional): super@local logs into super context
    if (email === 'super@local') {
      localStorage.setItem('super','true');
      _write(K.SESSION, { userId: 'super', tenantId: tenantId || getTenants()[0]?.id || null });
      return { ok:true, user: { id:'super', name:'Super Admin', email, role: ROLES.SUPER_ADMIN } };
    }
    const user = getUsers(tenantId).find(u => u.email === email && u.status !== 'disabled');
    if (!user) return { ok:false, error:'User not found for this company' };
    localStorage.removeItem('super');
    _write(K.SESSION, { userId: user.id, tenantId });
    return { ok:true, user };
  }

  function logout() { localStorage.removeItem(K.SESSION); localStorage.removeItem('super'); }

  function session() { return _read(K.SESSION, null); }

  function currentUser() {
    const s = session(); if (!s) return null;
    if (s.userId === 'super') return { id:'super', name:'Super Admin', email:'super@local', role:ROLES.SUPER_ADMIN };
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

  // ---------- Branding ----------
  function applyBranding() {
    const t = getTenant();
    if (!t) return;
    document.querySelectorAll('[data-brand-logo]').forEach(el => { el.src = t.logoUrl || 'images/Koobs_Logo_Green_.png'; el.alt = t.name || 'Logo'; });
    document.querySelectorAll('[data-brand-name]').forEach(el => { el.textContent = t.name || 'Company'; });
    // Title: "Page · Company"
    if (t.name) {
      const base = document.title.split('·')[0].trim();
      document.title = `${base} · ${t.name}`;
    }
  }

  // ---------- Multi-company access ----------
  /**
   * Returns companies this user can access.
   * - super admin => all tenants
   * - normal user => any tenant where a user record exists for their email
   */
  function accessibleTenants() {
    const me = currentUser();
    const tenants = getTenants();
    if (!me) return [];
    if (isSuper()) return tenants;

    // collect by same email across tenants (each membership is a user row)
    const email = me.email;
    const memberships = _read(K.USERS, []).filter(u => u.email === email).map(u => u.tenantId);
    const ids = Array.from(new Set(memberships));
    return tenants.filter(t => ids.includes(t.id));
  }

  /**
   * Populate a <select> element with accessible tenants and keep it in sync.
   * Pass either the element or a selector.
   */
  function renderCompanySwitcher(selectOrSelector, { autoHideIfSingle=true } = {}) {
    const el = (typeof selectOrSelector === 'string') ? document.querySelector(selectOrSelector) : selectOrSelector;
    if (!el) return;
    const list = accessibleTenants();
    const active = getTenant()?.id || getActiveTenantId();

    el.innerHTML = '';
    list.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id; opt.textContent = `${t.name} — ${t.accountId}`;
      if (t.id === active) opt.selected = true;
      el.appendChild(opt);
    });

    // Hide if only one option and autoHide is on
    if (autoHideIfSingle && list.length <= 1) {
      el.closest('[data-company-switcher-wrap]')?.classList.add('d-none');
    } else {
      el.closest('[data-company-switcher-wrap]')?.classList.remove('d-none');
    }

    el.onchange = () => {
      setActiveTenant(el.value);
      applyBranding();
      location.reload(); // simplest: reload page to refresh data context
    };
  }

  return {
    ROLES, can, requireAuth, currentUser,
    getTenants, getTenant, createTenant, updateTenant,
    getUsers, inviteUser, updateUser, deleteUser,
    getActiveTenantId, setActiveTenant,
    login, logout, session, isSuper, applyBranding,
    accessibleTenants, renderCompanySwitcher,
    bootstrapForSuperAdmin
  };
})();
</script>
