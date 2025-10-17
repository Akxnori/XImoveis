// Auth UI helpers: toggle nav and expose auth
(function(){
  function getUser(){ try { return JSON.parse(localStorage.getItem('authUser')||'null'); } catch { return null } }
  function getToken(){ try { return localStorage.getItem('authToken') || null; } catch { return null } }
  function getAuth(){ return { user: getUser(), token: getToken() }; }
  function isLogged(){ return !!getUser(); }
  function applyNav(){
    try {
      const user = getUser();
      const logged = !!user;
      // Mostrar menus sempre (conforme pedido), apenas troca o comportamento do botão Entrar/Sair
      document.querySelectorAll('.nav-auth').forEach(el=> el.style.display = '');
      document.querySelectorAll('.nav-agent').forEach(el=> el.style.display = '');
      document.querySelectorAll('.nav-admin').forEach(el=> el.style.display = '');
      // Keep the guest link always visible, but switch behavior
      const authLink = document.getElementById('authLink');
      if (authLink) {
        if (logged) {
          authLink.textContent = 'Sair';
          authLink.href = '#';
          authLink.onclick = function(ev){ ev.preventDefault(); logout(); location.href = 'index.html'; };
          authLink.classList.remove('nav-guest');
        } else {
          authLink.textContent = 'Entrar';
          authLink.href = 'login.html';
          authLink.onclick = null;
          if (!authLink.classList.contains('nav-guest')) authLink.classList.add('nav-guest');
        }
      }
    } catch{}
  }
  function logout(){ try { localStorage.removeItem('authToken'); localStorage.removeItem('authUser'); } catch{} }
  window.XAuthUI = { getUser, getToken, getAuth, isLogged, applyNav, logout };
})();
