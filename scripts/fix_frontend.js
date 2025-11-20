const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'frontend', 'public');
const exts = new Set(['.html', '.css', '.js']);

function score(str){
  const bad = /Ã|Â|\uFFFD|imA3|XImA3|InA-cio|caracterA-st|PreA|A\?rea|DescriA|LocalizaA|NA�o|VocA�|mA|A�o|A�|\\r\\n/g;
  const m = str.match(bad);
  return m ? m.length : 0;
}

function fixMojibake(text){
  text = text.replace(/\\r\\n/g, '\r\n');
  const cand = Buffer.from(text, 'latin1').toString('utf8');
  if (score(cand) < score(text)) text = cand;
  const repl = [
    [/XImA3veis/g, 'XImóveis'], [/imA3veis/g, 'imóveis'], [/imA3vel/g, 'imóvel'],
    [/InA-cio/g, 'Início'], [/caracterA-sticas/g, 'características'],
    [/PreA\u0015o/g, 'Preço'], [/PreA�o/g, 'Preço'], [/A\?rea/g, 'Área'],
    [/DescriA\u0015A�o/g, 'Descrição'], [/LocalizaA\u0015A�o/g, 'Localização'],
    [/NA�o/g, 'Não'], [/VocA� jA�/g, 'Você já'],
    [/ImobiliA�ria/g, 'Imobiliária'], [/JurA-dico/g, 'Jurídico']
  ];
  for (const [rg, to] of repl) text = text.replace(rg, to);
  return text;
}

function processFile(file){
  const raw = fs.readFileSync(file);
  let text = raw.toString('utf8');
  const fixed = fixMojibake(text);
  if (fixed !== text) {
    fs.writeFileSync(file, fixed, 'utf8');
    console.log('fixed', path.relative(ROOT, file));
  }
}

function walk(dir){
  for (const entry of fs.readdirSync(dir)){
    const full = path.join(dir, entry);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full);
    else if (exts.has(path.extname(full))) processFile(full);
  }
}

function patchBusca(){
  const file = path.join(ROOT, 'busca.html');
  let t = fs.readFileSync(file, 'utf8');
  t = t.replace(/<script\s+defer\s+src="js\/layout.js"><\/script>`n<\/head>/g, '<script defer src="js/layout.js"></script>\n</head>');
  t = t.replace(/<title>[\s\S]*?<\/title>/, '<title>XImóveis - Buscar</title>');
  t = t.replace(/<label for="f_city">Cidade<\/label>\\r\\n\s*<select id="f_city"/g, '<label for="f_city">Cidade</label>\n            <select id="f_city"');
  // Replace loadDataset body to fetch from API
  t = t.replace(/async function loadDataset\([\s\S]*?\{[\s\S]*?\}/, function(){
    return (
      'async function loadDataset(){\n' +
      '  const API = window.API_BASE || ((window.location.origin && window.location.origin !== \'null\') ? window.location.origin : \'http://localhost:3000\');\n' +
      '  try { const r = await fetch(' + "`${API}/imoveis?sort=priceDesc`" + '); if (!r.ok) throw new Error(\'api\'); return await r.json(); } catch { return []; }\n' +
      '}'
    );
  }());
  fs.writeFileSync(file, t, 'utf8');
}

function patchIndex(){
  const file = path.join(ROOT, 'index.html');
  let t = fs.readFileSync(file, 'utf8');
  t = t.replace(/<title>[\s\S]*?<\/title>/, '<title>XImóveis - Início</title>');
  t = t.replace(/<script defer src="js\/layout.js"><\/script>`n<\/head>/g, '<script defer src="js/layout.js"></script>\n</head>');
  t = t.replace(/imA3veis/g, 'imóveis').replace(/imA3vel/g, 'imóvel').replace(/caracterA-sticas/g, 'características');
  t = t.replace(/document\.addEventListener\([\s\S]*?\);/g, 'document.addEventListener("DOMContentLoaded", ()=>{ if (window.XAuthUI) XAuthUI.applyNav(); loadFeatured(); initMap(); });');
  fs.writeFileSync(file, t, 'utf8');
}

function patchLogin(){
  const file = path.join(ROOT, 'login.html');
  let t = fs.readFileSync(file, 'utf8');
  t = t.replace(/<title>[\s\S]*?<\/title>/, '<title>XImóveis - Entrar</title>');
  t = t.replace(/<script defer src="js\/layout\.js"><\/script>`n<\/head>/g, '<script defer src="js/layout.js"></script>\n</head>');
  fs.writeFileSync(file, t, 'utf8');
}

walk(ROOT);
patchBusca();
patchIndex();
patchLogin();
console.log('Done.');
