// Auth UI helpers: API base + toggle nav
(function(){
  const DEFAULT_API_BASE = 'http://localhost:3000';
  function pickApiBase() {
    const o = (window.location && window.location.origin) || '';
    if (typeof window.API_BASE === 'string' && /^https?:\/\//i.test(window.API_BASE)) return window.API_BASE;
    if (o && /^https?:\/\//i.test(o)) return o;
    return DEFAULT_API_BASE;
  }
  window.API_BASE = pickApiBase();

  function getUser(){ try { return JSON.parse(sessionStorage.getItem('authUser') || 'null'); } catch { return null; } }
  function getToken(){ try { return sessionStorage.getItem('authToken') || null; } catch { return null; } }
  function getAuth(){ return { user: getUser(), token: getToken() }; }
  function isLogged(){ return !!getUser(); }

  function hideAll(sel){
    try { document.querySelectorAll(sel).forEach(el => el.style.setProperty('display','none','important')); }
    catch(e){}
  }
  function showAll(sel){
    try { document.querySelectorAll(sel).forEach(el => el.style.setProperty('display','inline','important')); }
    catch(e){}
  }

  function applyNav(){
    try {
      const user = getUser();
      const role = (user && String(user.role||'').toUpperCase()) || '';
      hideAll('.nav-auth'); hideAll('.nav-agent'); hideAll('.nav-admin');
      if (user && (role==='BROKER' || role==='AGENCY')) { showAll('.nav-auth'); showAll('.nav-agent'); }
      if (user && role==='ADMIN') { showAll('.nav-admin'); }

      const authLink = document.getElementById('authLink');
      if (authLink) {
        if (user) {
          authLink.textContent = 'Sair'; authLink.href = '#';
          authLink.onclick = (ev)=>{ ev.preventDefault(); logout(); location.href='index.html'; };
          authLink.classList.remove('nav-guest');
        } else {
          authLink.textContent = 'Entrar'; authLink.href = 'login.html'; authLink.onclick = null;
          if (!authLink.classList.contains('nav-guest')) authLink.classList.add('nav-guest');
        }
      }

      try {
        const path = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
        document.querySelectorAll('header nav a').forEach(a=>{
          const href = String(a.getAttribute('href')||'').toLowerCase();
          if (href === path) { a.classList.add('active'); a.setAttribute('aria-current','page'); }
          else { a.classList.remove('active'); a.removeAttribute('aria-current'); }
        });
      } catch {}
    } catch{}
  }

  function logout(){ try { sessionStorage.removeItem('authToken'); sessionStorage.removeItem('authUser'); } catch{} }
  window.XAuthUI = { getUser, getToken, getAuth, isLogged, applyNav, logout };
})();

