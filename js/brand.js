<!-- js/brand.js -->
<script>
/**
 * Tiny multi-tenant helper (front-end demo).
 * Stores one active tenant in localStorage:
 *   { accountId, company, logoUrl }
 */
const Brand = (() => {
  const TENANT_KEY = 'tenant';
  const AUTH_KEY = 'isLoggedIn';
  const USER_KEY = 'loggedUser';

  const get = () => JSON.parse(localStorage.getItem(TENANT_KEY) || 'null');
  const set = (t) => localStorage.setItem(TENANT_KEY, JSON.stringify(t));
  const clear = () => localStorage.removeItem(TENANT_KEY);
  const isConfigured = () => !!get();

  function configure({ accountId, company, logoUrl }) {
    set({ accountId: (accountId || '').trim(), company: (company || '').trim(), logoUrl: (logoUrl || '').trim() });
  }

  /** Apply branding to any elements with data attributes */
  function apply() {
    const t = get();
    if (!t) return;
    document.querySelectorAll('[data-brand-name]').forEach(el => { el.textContent = t.company || 'Your Company'; });
    document.querySelectorAll('[data-brand-logo]').forEach(el => {
      const fallback = 'images/Koobs_Logo_Green_.png';
      el.src = t.logoUrl || fallback;
      el.alt = t.company || 'Logo';
    });
    // Page title: "Page · Company"
    if (t.company) {
      const parts = document.title.split('·')[0].trim();
      document.title = `${parts} · ${t.company}`;
    }
  }

  // Simple demo auth helpers (client-side only!)
  const login = (username) => { localStorage.setItem(AUTH_KEY, 'true'); localStorage.setItem(USER_KEY, username); };
  const logout = () => { localStorage.removeItem(AUTH_KEY); localStorage.removeItem(USER_KEY); };
  const isLoggedIn = () => localStorage.getItem(AUTH_KEY) === 'true';

  return { get, set, clear, isConfigured, configure, apply, login, logout, isLoggedIn };
})();
</script>
