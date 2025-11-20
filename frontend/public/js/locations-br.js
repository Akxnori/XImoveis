// Populate Brazilian UFs and cities using IBGE API, with sessionStorage cache
(function(){
  const API = 'https://servicodados.ibge.gov.br/api/v1/localidades';
  async function fetchJSON(url){
    const key = 'ibge:'+url;
    try { const c=sessionStorage.getItem(key); if(c) return JSON.parse(c); } catch {}
    const r = await fetch(url, { cache: 'force-cache' });
    if (!r.ok) throw new Error('network');
    const j = await r.json();
    try { sessionStorage.setItem(key, JSON.stringify(j)); } catch {}
    return j;
  }
  async function getUFs(){
    const list = await fetchJSON(API + '/estados?orderBy=nome');
    return list.map(s => ({ sigla: s.sigla, nome: s.nome }));
  }
  async function getCities(uf){
    if (!uf) return [];
    const list = await fetchJSON(API + `/estados/${uf}/municipios?orderBy=nome`);
    return list.map(c => c.nome);
  }
  async function populateUF(select, initialUF){
    select.innerHTML = '<option value="">UF</option>';
    try {
      const ufs = await getUFs();
      ufs.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u.sigla; opt.textContent = `${u.sigla} - ${u.nome}`; select.appendChild(opt);
      });
      if (initialUF) select.value = String(initialUF).toUpperCase();
    } catch {
      // minimal fallback
      'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ').forEach(sig=>{
        const opt=document.createElement('option'); opt.value=sig; opt.textContent=sig; select.appendChild(opt);
      });
      if (initialUF) select.value = String(initialUF).toUpperCase();
    }
  }
  async function populateCities(ufSelect, citySelect, initialCity){
    const uf = ufSelect.value;
    citySelect.innerHTML = '<option value="">Cidade</option>';
    citySelect.disabled = !uf;
    if (!uf) return;
    try {
      const cities = await getCities(uf);
      cities.forEach(name => { const opt=document.createElement('option'); opt.value=name; opt.textContent=name; citySelect.appendChild(opt); });
      if (initialCity) {
        citySelect.value = initialCity;
        if (!citySelect.value) {
          for (const o of citySelect.options) { if (o.textContent.toLowerCase()===String(initialCity).toLowerCase()) { citySelect.value=o.value; break; } }
        }
      }
    } catch {}
  }
  function attachLinked(ufId, cityId, initialUF, initialCity){
    const ufSelect = document.getElementById(ufId);
    const citySelect = document.getElementById(cityId);
    if (!ufSelect || !citySelect) return;
    populateUF(ufSelect, initialUF).then(()=> populateCities(ufSelect, citySelect, initialCity));
    ufSelect.addEventListener('change', ()=> populateCities(ufSelect, citySelect, ''));
  }
  window.LocationsBR = { attachLinked };
})();


