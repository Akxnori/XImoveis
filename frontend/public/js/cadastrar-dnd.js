// Reordenação por arrastar no cadastrar.html e envio na ordem
(function(){
  const API = (window.API_BASE && /^https?:\/\//i.test(window.API_BASE)) ? window.API_BASE : 'http://localhost:3000';

  function byId(id){ return document.getElementById(id); }

  function setup(){
    const photosInput = byId('photos');
    const previewBox = byId('photoPreview');
    const form = byId('formImovel');
    const msgEl = byId('msg');
    if (!photosInput || !previewBox || !form) return;

    let photoOrder = [];
    let revokeQueue = [];
    let dragFrom = null;

    function render(){
      revokeQueue.forEach(url=> URL.revokeObjectURL(url));
      revokeQueue = [];
      previewBox.innerHTML = '';
      const files = photosInput.files || [];
      const max = Math.min(files.length, 50);
      if (!photoOrder.length || photoOrder.some(i=> i>=max)) photoOrder = Array.from({length:max}, (_,i)=> i);
      photoOrder.forEach((fileIdx, orderIdx)=>{
        const f = files[fileIdx]; if (!f) return;
        const url = URL.createObjectURL(f);
        revokeQueue.push(url);
        const card = document.createElement('div');
        card.setAttribute('draggable','true');
        card.dataset.order = String(orderIdx);
        card.style.border = '1px solid var(--border)';
        card.style.borderRadius = '8px';
        card.style.overflow = 'hidden';
        const img = document.createElement('img');
        img.src = url; img.alt = f.name; img.style.width='100%'; img.style.height='140px'; img.style.objectFit='cover';
        const cap = document.createElement('div');
        cap.style.display='flex'; cap.style.alignItems='center'; cap.style.justifyContent='space-between'; cap.style.gap='8px';
        cap.style.fontSize='12px'; cap.style.padding='6px 8px'; cap.style.whiteSpace='nowrap'; cap.style.textOverflow='ellipsis'; cap.style.overflow='hidden';
        const nm = document.createElement('span'); nm.textContent=f.name;
        const badge = document.createElement('strong'); badge.textContent = orderIdx===0 ? 'Capa' : ''; badge.style.color='#2563eb';
        cap.appendChild(nm); cap.appendChild(badge);
        card.appendChild(img); card.appendChild(cap);
        previewBox.appendChild(card);
      });
    }

    // Intercepta change antigo e substitui por nosso preview + ordem
    photosInput.addEventListener('change', (e)=>{
      e.stopImmediatePropagation();
      const files = photosInput.files || [];
      if (files.length > 50) {
        alert('Você só pode enviar até 50 fotos.');
        const dt = new DataTransfer();
        for (let i=0;i<50;i++) dt.items.add(files[i]);
        photosInput.files = dt.files;
      }
      const max = Math.min((photosInput.files||[]).length, 50);
      photoOrder = Array.from({length:max}, (_,i)=> i);
      render();
    }, true); // capture para bloquear listener anterior

    // DnD
    previewBox.addEventListener('dragstart', (e)=>{
      const card = e.target && e.target.closest('div[draggable="true"]');
      if (!card) return;
      dragFrom = Number(card.dataset.order);
      e.dataTransfer.effectAllowed = 'move';
    });
    previewBox.addEventListener('dragover', (e)=>{
      if (e.target && e.target.closest('div[draggable="true"]')) e.preventDefault();
    });
    previewBox.addEventListener('drop', (e)=>{
      const toCard = e.target && e.target.closest('div[draggable="true"]');
      if (!toCard || dragFrom==null) return;
      const toIdx = Number(toCard.dataset.order);
      if (toIdx===dragFrom) { dragFrom=null; return; }
      const files = photosInput.files || [];
      const max = Math.min(files.length, 50);
      if (!photoOrder.length) photoOrder = Array.from({length:max}, (_,i)=> i);
      const moved = photoOrder.splice(dragFrom,1)[0];
      photoOrder.splice(toIdx,0,moved);
      dragFrom = null;
      render();
    });

    // Intercepta submit para enviar na ordem definida
    form.addEventListener('submit', async (e)=>{
      e.stopImmediatePropagation();
      e.preventDefault();
      const fd = new FormData(form);
      if (photosInput && photosInput.files && photosInput.files.length){
        const files = photosInput.files;
        const max = Math.min(files.length, 50);
        if (!photoOrder.length) photoOrder = Array.from({length:max}, (_,i)=> i);
        photoOrder.slice(0,max).forEach(idx=>{ const f = files[idx]; if (f) fd.append('photos', f); });
      }
      try {
        const r = await fetch(`${API}/imoveis/cadastrar`, { method:'POST', headers:{ Authorization: `Bearer ${sessionStorage.getItem('authToken')||''}` }, body: fd });
        const ok = r.ok;
        if (msgEl) msgEl.textContent = ok ? 'Enviado com sucesso para revisão.' : 'Falha ao enviar.';
        if (ok){ form.reset(); photoOrder=[]; previewBox.innerHTML=''; }
      } catch(err){ if (msgEl) msgEl.textContent = err.message || 'Erro no envio.'; }
    }, true); // capture bloqueia listener antigo

    // Render inicial (caso input já tenha arquivos via histórico)
    if (photosInput.files && photosInput.files.length) render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();
})();

