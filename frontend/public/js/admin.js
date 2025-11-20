// XImóveis - Painel Admin
(function(){
  const API = (window.API_BASE && /^https?:\/\//i.test(window.API_BASE)) ? window.API_BASE : 'http://localhost:3000';

  function getToken(){
    try {
      if (window.XAuthUI && typeof XAuthUI.getToken === 'function') {
        return XAuthUI.getToken();
      }
      return sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
    } catch { return null; }
  }
  function getUser(){
    try {
      if (window.XAuthUI && typeof XAuthUI.getUser === 'function') return XAuthUI.getUser();
      return JSON.parse(sessionStorage.getItem('authUser')||'null');
    } catch { return null; }
  }

  const el = {
    pendingBody: document.getElementById('tb-pending'),
    manageBody: document.getElementById('tb-manage'),
    usersBody: document.getElementById('tb-users'),
    modal: document.getElementById('modal'),
    mdTitle: document.getElementById('md-title'),
    mdContent: document.getElementById('md-content'),
    mdClose: document.getElementById('md-close'),
    toast: document.getElementById('toast'),
    panels: {
      pending: document.getElementById('panel-pending'),
      manage: document.getElementById('panel-manage'),
      users: document.getElementById('panel-users')
    },
    tabButtons: document.querySelectorAll('.tab-btn')
  };

  const fmt = {
    brl: (v)=> (v!=null ? Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) : ''),
    dt: (iso)=> { try { return new Date(iso).toLocaleString('pt-BR'); } catch { return ''; } }
  };

  const state = {
    manageLoaded: false,
    usersLoaded: false,
    manageCache: [],
    usersCache: []
  };

  function toast(msg){
    if (!el.toast) return;
    el.toast.textContent = msg;
    el.toast.classList.remove('hidden');
    clearTimeout(el.toast._t);
    el.toast._t = setTimeout(()=> el.toast.classList.add('hidden'), 2500);
  }

  function escapeHtml(str){
    return String(str||'').replace(/[&<>\"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
  }

  async function apiGet(path){
    const token = getToken();
    const r = await fetch(`${API}${path}`, { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
    if (!r.ok) throw new Error('Falha na API');
    return r.json();
  }

  async function apiSend(path, method, body){
    const token = getToken();
    const opts = { method, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type':'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(`${API}${path}`, opts);
    if (!r.ok) {
      const err = await r.json().catch(()=>({}));
      throw new Error(err.error || 'Erro na API');
    }
    return r.json().catch(()=>({ ok:true }));
  }

  async function fetchCertificateBlobUrl(id){
    try {
      const token = getToken();
      const r = await fetch(`${API}/admin/certidao/${id}`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!r.ok) return null;
      const blob = await r.blob();
      return URL.createObjectURL(blob);
    } catch { return null; }
  }

  function showPanel(name){
    Object.entries(el.panels).forEach(([key, panel])=>{
      if (!panel) return;
      panel.classList.toggle('hidden', key !== name);
    });
    el.tabButtons.forEach(btn=>{
      btn.classList.toggle('active', btn.dataset.panel === name);
    });
    if (name === 'manage' && !state.manageLoaded) { renderManage(); }
    if (name === 'users' && !state.usersLoaded) { renderUsers(); }
  }

  function statusBadge(status){
    const map = { PENDING:'Pendente', ACTIVE:'Ativo', REJECTED:'Rejeitado' };
    const label = map[String(status||'').toUpperCase()] || status || '';
    return `<span class="status-${String(status||'').toLowerCase()}">${label}</span>`;
  }

  async function renderPending(){
    try {
      const pend = await apiGet('/admin/properties/pending');
      if (!Array.isArray(pend) || !pend.length){
        el.pendingBody.innerHTML = '<tr><td colspan="6">Nenhum an&uacute;ncio pendente.</td></tr>';
        return;
      }
      el.pendingBody.innerHTML = pend.map(p=>{
        const cityUf = [p.city, p.state].filter(Boolean).join('/');
        return `
          <tr>
            <td>${p.id}</td>
            <td>${escapeHtml(p.title||'')}</td>
            <td>${escapeHtml(cityUf||'')}</td>
            <td>${fmt.brl(p.price)}</td>
            <td>${fmt.dt(p.created_at)}</td>
            <td>
              <button class="btn-outline" data-action="det" data-id="${p.id}">Detalhes</button>
              <button class="btn" data-action="apv" data-id="${p.id}">Aprovar</button>
              <button class="btn-outline" data-action="rej" data-id="${p.id}">Rejeitar</button>
            </td>
          </tr>`;
      }).join('');
    } catch(e){
      el.pendingBody.innerHTML = '<tr><td colspan="6">Erro ao carregar pendentes.</td></tr>';
    }
  }

  async function renderManage(){
    try {
      const list = await apiGet('/admin/properties');
      state.manageLoaded = true;
      state.manageCache = Array.isArray(list) ? list : [];
      if (!state.manageCache.length){
        el.manageBody.innerHTML = '<tr><td colspan="6">Nenhum an&uacute;ncio encontrado.</td></tr>';
        return;
      }
      el.manageBody.innerHTML = state.manageCache.map(p => {
        const cityUf = [p.city, p.state].filter(Boolean).join('/');
        return `
          <tr>
            <td>${p.id}</td>
            <td>${escapeHtml(p.title||'')}</td>
            <td>${statusBadge(p.status)}</td>
            <td>${escapeHtml(cityUf||'')}</td>
            <td>${fmt.brl(p.price)}</td>
            <td>
              <button class="btn-outline" data-action="det" data-id="${p.id}">Detalhes</button>
              <button class="btn-outline" data-action="edit" data-id="${p.id}">Editar</button>
              <button class="btn" style="background:#dc2626" data-action="del" data-id="${p.id}">Excluir</button>
            </td>
          </tr>`;
      }).join('');
    } catch (e) {
      el.manageBody.innerHTML = '<tr><td colspan="6">Falha ao carregar an&uacute;ncios.</td></tr>';
    }
  }

  async function renderUsers(){
    try {
      const list = await apiGet('/admin/users');
      state.usersLoaded = true;
      state.usersCache = Array.isArray(list) ? list : [];
      if (!state.usersCache.length){
        el.usersBody.innerHTML = '<tr><td colspan="7">Nenhum usu&aacute;rio encontrado.</td></tr>';
        return;
      }
      const roleLabel = (role)=>{
        const key = String(role||'').toUpperCase();
        if (key === 'ADMIN') return 'Administrador';
        if (key === 'AGENCY') return 'Imobiliária';
        if (key === 'BROKER') return 'Corretor';
        return key;
      };
      el.usersBody.innerHTML = state.usersCache.map(u=>{
        const role = roleLabel(u.role);
        const agency = u.agency_name ? escapeHtml(u.agency_name) : '-';
        return `
          <tr>
            <td>${u.id}</td>
            <td>${escapeHtml(u.name||'')}</td>
            <td>${escapeHtml(u.email||'')}</td>
            <td>${escapeHtml(u.phone||'-')}</td>
            <td>${role}</td>
            <td>${agency}</td>
            <td>${u.property_count||0}</td>
          </tr>`;
      }).join('');
    } catch (e) {
      el.usersBody.innerHTML = '<tr><td colspan="7">Falha ao carregar usu&aacute;rios.</td></tr>';
    }
  }

  function openModal(){ el.modal.classList.remove('hidden'); }
  function closeModal(){ el.modal.classList.add('hidden'); }

  async function showDetails(id){
    await buildDetails(id);
    openModal();
  }

  async function buildDetails(id){
    const data = await apiGet(`/admin/properties/${id}`);
    const item = data.property || {};
    const cert = data.certificate;
    const pdfUrl = cert ? await fetchCertificateBlobUrl(id) : null;
    const cityUf = [item.city, item.state].filter(Boolean).join('/');
    const addressParts = [];
    if (item.address) {
      const num = item.address_number ? `, ${escapeHtml(item.address_number)}` : '';
      addressParts.push(`${escapeHtml(item.address)}${num}`);
    }
    if (item.neighborhood) addressParts.push(escapeHtml(item.neighborhood));
    if (cityUf) addressParts.push(escapeHtml(cityUf));
    if (item.postal_code) addressParts.push(`CEP: ${escapeHtml(item.postal_code)}`);
    const addressBlock = addressParts.length ? addressParts.join(' · ') : 'N&atilde;o informado';

    el.mdTitle.textContent = `Im&oacute;vel #${item.id} - Detalhes`;
    el.mdContent.innerHTML = `
      <div class="grid" style="grid-template-columns: 320px 1fr; gap:16px;">
        <div>
          <div id="md-cover" style="width:100%; height:220px; border:1px solid var(--border); border-radius:10px; background:#f6f7f9; display:flex; align-items:center; justify-content:center; color:#6b7280;">Sem imagem</div>
        </div>
        <div>
          <h4>Im&oacute;vel</h4>
          <div class="mt-1"><strong>T&iacute;tulo:</strong> ${escapeHtml(item.title||'')}</div>
          <div class="mt-1"><strong>Valor:</strong> ${fmt.brl(item.price)}</div>
      <div class="mt-1"><strong>Finalidade:</strong> ${escapeHtml(String(item.purpose||''))}</div>
      <div class="mt-1"><strong>Tipo:</strong> ${escapeHtml(item.type||'')}</div>
      <div class="mt-1"><strong>Endereço:</strong> ${addressBlock}</div>
      <div class="mt-1"><strong>Quartos:</strong> ${Number(item.bedrooms)||0} &nbsp; <strong>Banheiros:</strong> ${Number(item.bathrooms)||0} &nbsp; <strong>Vagas:</strong> ${Number(item.parking_spaces)||0}</div>
      <div class="mt-1"><strong>Área útil:</strong> ${item.area_m2 ? `${item.area_m2} m²` : '-'}</div>
      <div class="mt-1"><strong>Status:</strong> ${String(item.status||'')}</div>
      <div class="mt-1"><strong>Data de envio:</strong> ${fmt.dt(item.created_at)}</div>
      ${item.lat!=null && item.lng!=null ? `<div class="mt-1"><strong>Localização:</strong> ${item.lat}, ${item.lng}</div>`:''}
          <div class="mt-2"><strong>Descri&ccedil;&atilde;o completa:</strong><br/>
            <div style="white-space:pre-wrap">${escapeHtml(item.description||'')}</div>
          </div>
        </div>
      </div>

      <div class="mt-3">
        <h4>Fotos do im&oacute;vel</h4>
        <div id="md-photos" class="grid" style="grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap:10px;"></div>
        <div class="mt-2">
          <button id="btn-save-cover" class="btn">Salvar capa</button>
        </div>
      </div>

      <div class="mt-3">
        <h4>Certid&atilde;o</h4>
        ${pdfUrl ? `
          <object data="${pdfUrl}" type="application/pdf" width="100%" height="420px">
            <iframe src="${pdfUrl}" width="100%" height="420px"></iframe>
          </object>
        ` : '<div>Nenhuma certid&atilde;o enviada.</div>'}
      </div>

      <div class="mt-3">
        <h4>Anota&ccedil;&otilde;es do administrador</h4>
        <textarea id="md-notes" rows="4" style="width:100%;"></textarea>
        <div class="mt-2">
          <button id="btn-save-notes" class="btn" data-id="${item.id}">Salvar anota&ccedil;&otilde;es</button>
        </div>
      </div>

      <div class="mt-3 space-between">
        <button class="btn-outline" data-action="back">Voltar</button>
        <div>
          <button class="btn" data-action="apv" data-id="${item.id}">Aprovar</button>
          <button class="btn-outline" data-action="rej" data-id="${item.id}">Rejeitar</button>
        </div>
      </div>
    `;

    await fillPhotoGallery(id, data, item);

    const btnSaveNotes = el.mdContent.querySelector('#btn-save-notes');
    if (btnSaveNotes) {
      btnSaveNotes.addEventListener('click', async ()=>{
        const val = (el.mdContent.querySelector('#md-notes')||{}).value || '';
        if (!val.trim()) { toast('Escreva uma anota&ccedil;&atilde;o.'); return; }
        try {
          await apiSend(`/admin/anotacao/${id}`, 'POST', { note: val });
          toast('Anota&ccedil;&atilde;o salva');
        } catch(e){ toast(e.message||'Falha ao salvar anot.'); }
      });
    }

    const backBtn = el.mdContent.querySelector('[data-action="back"]');
    if (backBtn) backBtn.addEventListener('click', closeModal);
    const approveBtn = el.mdContent.querySelector('[data-action="apv"]');
    if (approveBtn) approveBtn.addEventListener('click', ()=> approve(id));
    const rejectBtn = el.mdContent.querySelector('[data-action="rej"]');
    if (rejectBtn) rejectBtn.addEventListener('click', ()=> reject(id));
  }

  async function fillPhotoGallery(id, data, item){
    const box = el.mdContent.querySelector('#md-photos');
    if (!box) return;
    let photos = [];
    if (Array.isArray(data.photos) && data.photos.length) photos = data.photos;
    if (!photos.length && Array.isArray(item.photos)) photos = item.photos;
    if (!photos.length) {
      try {
        const arr = await apiGet(`/admin/properties/${id}/photos`);
        if (Array.isArray(arr)) photos = arr;
      } catch {}
    }
    photos = photos.map(u => {
      let url = String(u||'');
      if (!/^https?:\/\//i.test(url)) {
        url = `${API}${url.startsWith('/') ? url : `/files/${url}`}`;
      }
      const rel = url.replace(/^https?:\/\/[^/]+/i,'').replace(/^\/files\//,'');
      return { url, rel };
    });
    const coverBox = el.mdContent.querySelector('#md-cover');
    if (!photos.length) {
      box.innerHTML = '<div>Sem fotos enviadas.</div>';
      if (coverBox) coverBox.textContent = 'Sem imagem';
      return;
    }
    if (coverBox) {
      coverBox.innerHTML = `<img src="${photos[0].url}" alt="Capa" style="width:100%; height:220px; object-fit:cover; border-radius:10px;"/>`;
    }
    renderPhotoCards(photos, box);
    let dragIdx = null;
    box.addEventListener('dragstart', (e)=>{
      const card = e.target.closest('.photo-card');
      if (!card) return;
      dragIdx = Number(card.dataset.idx);
      e.dataTransfer.effectAllowed = 'move';
    });
    box.addEventListener('dragover', (e)=>{
      if (e.target.closest('.photo-card')) e.preventDefault();
    });
    box.addEventListener('drop', (e)=>{
      const card = e.target.closest('.photo-card');
      if (!card || dragIdx==null) return;
      const toIdx = Number(card.dataset.idx);
      if (toIdx === dragIdx) return;
      const moved = photos.splice(dragIdx,1)[0];
      photos.splice(toIdx,0,moved);
      dragIdx = null;
      renderPhotoCards(photos, box);
      const cover = el.mdContent.querySelector('#md-cover');
      if (cover) cover.innerHTML = `<img src="${photos[0].url}" alt="Capa" style="width:100%; height:220px; object-fit:cover; border-radius:10px;"/>`;
    }, { once:false });

    const saveBtn = el.mdContent.querySelector('#btn-save-cover');
    if (saveBtn) {
      saveBtn.addEventListener('click', async ()=>{
        try {
          const rel = photos[0]?.rel;
          if (!rel) throw new Error('Nenhuma foto selecionada');
          await apiSend(`/admin/properties/${id}/cover`, 'POST', { filename: rel });
          toast('Capa atualizada');
        } catch (e) {
          toast(e.message||'Erro ao salvar capa');
        }
      });
    }
  }

  function renderPhotoCards(photos, box){
    box.innerHTML = photos.map((p,i)=>`
      <div class="photo-card" draggable="true" data-idx="${i}" data-rel="${p.rel}" style="border:1px solid var(--border); border-radius:10px; overflow:hidden;">
        <img src="${p.url}" alt="Foto" style="width:100%; height:130px; object-fit:cover; display:block;"/>
        <div style="padding:6px 8px; font-size:12px; color:#6b7280;">${i===0?'Capa':''}</div>
      </div>`).join('');
  }

  async function approve(id){
    try {
      await apiSend(`/admin/properties/${id}/approve`, 'POST', { notes: 'Aprovado pelo admin' });
      toast('Im&oacute;vel aprovado');
      closeModal();
      renderPending();
      if (state.manageLoaded) renderManage();
    } catch(e){ toast(e.message||'Falha ao aprovar'); }
  }

  async function reject(id){
    const reason = prompt('Informe o motivo da rejei&ccedil;&atilde;o:') || 'Rejeitado pelo admin';
    try {
      await apiSend(`/admin/properties/${id}/reject`, 'POST', { reason });
      toast('Im&oacute;vel rejeitado');
      closeModal();
      renderPending();
      if (state.manageLoaded) renderManage();
    } catch(e){ toast(e.message||'Falha ao rejeitar'); }
  }

  async function openEditForm(id){
    const data = await apiGet(`/admin/properties/${id}`);
    const prop = data.property || {};
      el.mdTitle.textContent = `Editar imóvel #${id}`;
    const statusOptions = ['PENDING','ACTIVE','REJECTED'];
    const typeOptions = ['HOUSE','APARTMENT','LAND','STUDIO'];
    const purposeOptions = ['SALE','RENT'];
    const optionHtml = (opts, current) => opts.map(opt=>`<option value="${opt}" ${String(current||'').toUpperCase()===opt ? 'selected':''}>${opt}</option>`).join('');
    el.mdContent.innerHTML = `
      <form id="edit-form">
        <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(220px,1fr)); gap:12px;">
          <label>T&iacute;tulo<input type="text" name="title" value="${escapeHtml(prop.title||'')}" required /></label>
          <label>Pre&ccedil;o<input type="number" name="price" step="0.01" value="${prop.price!=null?prop.price:''}" /></label>
          <label>Status<select name="status">${optionHtml(statusOptions, prop.status)}</select></label>
          <label>Finalidade<select name="purpose">${optionHtml(purposeOptions, prop.purpose)}</select></label>
          <label>Tipo<select name="type">${optionHtml(typeOptions, prop.type)}</select></label>
          <label>Cidade<input type="text" name="city" value="${escapeHtml(prop.city||'')}" /></label>
          <label>UF<input type="text" name="state" maxlength="2" value="${escapeHtml(prop.state||'')}" /></label>
          <label>Bairro<input type="text" name="neighborhood" value="${escapeHtml(prop.neighborhood||'')}" /></label>
          <label>Endere&ccedil;o<input type="text" name="address" value="${escapeHtml(prop.address||'')}" /></label>
          <label>N&uacute;mero<input type="text" name="address_number" value="${escapeHtml(prop.address_number||'')}" /></label>
          <label>CEP<input type="text" name="postal_code" value="${escapeHtml(prop.postal_code||'')}" /></label>
        </div>
        <label class="mt-2">Descri&ccedil;&atilde;o<textarea name="description" rows="4" style="width:100%;">${escapeHtml(prop.description||'')}</textarea></label>
        <div class="mt-3 space-between">
          <button type="button" class="btn-outline" data-action="back">Cancelar</button>
          <button type="submit" class="btn">Salvar altera&ccedil;&otilde;es</button>
        </div>
      </form>
    `;
    const form = el.mdContent.querySelector('#edit-form');
    if (!form) return;
    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const body = {
        title: form.title.value.trim(),
        price: form.price.value ? Number(form.price.value) : null,
        status: form.status.value,
        purpose: form.purpose.value,
        type: form.type.value,
        city: form.city.value.trim(),
        state: form.state.value.trim().toUpperCase(),
        neighborhood: form.neighborhood.value.trim(),
        address: form.address.value.trim(),
        address_number: form.address_number.value.trim(),
        postal_code: form.postal_code.value.trim(),
        description: form.description.value.trim()
      };
      Object.keys(body).forEach(key=>{
        if (body[key]==='' || body[key]==null) delete body[key];
      });
      try {
        await apiSend(`/admin/properties/${id}`, 'PUT', body);
        toast('Im&oacute;vel atualizado');
        closeModal();
        renderManage();
        renderPending();
      } catch(e){ toast(e.message||'Falha ao atualizar'); }
    });
    const cancelBtn = el.mdContent.querySelector('[data-action="back"]');
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    openModal();
  }

  async function deleteProperty(id){
    if (!confirm('Deseja realmente excluir o im&oacute;vel #' + id + '?')) return;
    try {
      const token = getToken();
      const r = await fetch(`${API}/imoveis/${id}`, { method:'DELETE', headers:{ 'Authorization': `Bearer ${token}` } });
      if (!r.ok) {
        const err = await r.json().catch(()=>({}));
        throw new Error(err.error || 'Falha ao excluir');
      }
      toast('Im&oacute;vel removido');
      renderManage();
      renderPending();
    } catch(e){ toast(e.message||'Erro ao excluir'); }
  }

  function onPendingClick(ev){
    const btn = ev.target.closest('button[data-action]');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const act = btn.dataset.action;
    if (act === 'det') showDetails(id);
    if (act === 'apv') approve(id);
    if (act === 'rej') reject(id);
  }

  function onManageClick(ev){
    const btn = ev.target.closest('button[data-action]');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const act = btn.dataset.action;
    if (act === 'det') {
      window.open(`imovel.html?id=${id}`, '_blank');
      return;
    }
    if (act === 'edit') openEditForm(id);
    if (act === 'del') deleteProperty(id);
  }

  function ensureAdmin(){
    const user = getUser();
    if (!user || String(user.role||'').toUpperCase() !== 'ADMIN'){
      alert('Acesso restrito a administradores.');
      location.href = 'login.html';
      return false;
    }
    return true;
  }

  function initTabs(){
    el.tabButtons.forEach(btn=>{
      btn.addEventListener('click', ()=> showPanel(btn.dataset.panel));
    });
    showPanel('pending');
  }

  function init(){
    if (!ensureAdmin()) return;
    initTabs();
    renderPending();
    el.pendingBody.addEventListener('click', onPendingClick);
    if (el.manageBody) el.manageBody.addEventListener('click', onManageClick);
    if (el.mdClose) el.mdClose.addEventListener('click', closeModal);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
