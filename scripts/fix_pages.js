const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'frontend', 'public');
const exts = new Set(['.html', '.css', '.js']);
const header = `\n  <header>\n    <a class="logo" href="index.html"><img src="assets/logo.png" alt="XImóveis" style="height:28px"/></a>\n    <nav>\n      <a href="index.html">Início</a>\n      <a href="busca.html">Buscar</a>\n      <a href="mapa.html">Mapa</a>\n      <a href="cadastrar.html" class="nav-auth nav-agent">Cadastrar</a>\n      <a href="meus-imoveis.html" class="nav-auth nav-agent">Meus imóveis</a>\n      <a href="admin.html" class="nav-auth nav-admin">Admin</a>\n      <a href="login.html" id="authLink" class="nav-guest">Entrar</a>\n    </nav>\n  </header>`;
const footer = `\n  <footer>© XImóveis. Todos os direitos reservados.</footer>`;

function score(str){
  const m = str.match(/[ÃÂ�]|imA3|InA-cio|caracterA-st|PreA|DescriA|LocalizaA|matrA|NA�o|VocA/g);
  return m ? m.length : 0;
}
function fixEncoding(text){
  // remove literais \r\n e `n em head
  text = text.replace(/`n<\/head>/g, '</head>').replace(/\\r\\n/g, '\r\n');
  const cand = Buffer.from(text, 'latin1').toString('utf8');
  if (score(cand) < score(text)) text = cand;
  // substituições pontuais
  const pairs = [
    [/XImA3veis/g,'XImóveis'],[/imA3veis/g,'imóveis'],[/imA3vel/g,'imóvel'],
    [/InA-cio/g,'Início'],[/caracterA-sticas/g,'características'],[/PreA\u0015o|PreA�o/g,'Preço'],
    [/DescriA\u0015A�o|DescriA�o/g,'Descrição'],[/LocalizaA\u0015A�o|LocalizaA�o/g,'Localização'],
    [/matrA-cula/g,'matrícula'],[/NA�o/g,'Não'],[/VocA� jA�/g,'Você já']
  ];
  for (const [rg,to] of pairs) text = text.replace(rg,to);
  return text;
}
function processFile(file){
  const ext = path.extname(file);
  if (!exts.has(ext)) return;
  let t = fs.readFileSync(file,'utf8');
  const before = t;
  t = fixEncoding(t);
  // remover layout.js e placeholders de header/footer
  t = t.replace(/<script\s+defer\s+src="js\/layout\.js"><\/script>/g,'');
  t = t.replace(/<header data-app-header><\/header>/g, header);
  t = t.replace(/<footer data-app-footer><\/footer>/g, footer);
  if (before !== t) fs.writeFileSync(file,t,'utf8');
}
function walk(dir){
  for (const e of fs.readdirSync(dir)){
    const full = path.join(dir,e);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full); else processFile(full);
  }
}

function patchBuscar(){
  const file = path.join(ROOT,'busca.html');
  if (!fs.existsSync(file)) return;
  let t = fs.readFileSync(file,'utf8');
  // título
  t = t.replace(/<title>[\s\S]*?<\/title>/,'<title>XImóveis - Buscar</title>');
  // dataset -> API
  t = t.replace(/async function loadDataset\([\s\S]*?\{[\s\S]*?\}/, `async function loadDataset(){\n  const API = window.API_BASE || ((window.location.origin && window.location.origin !== 'null') ? window.location.origin : 'http://localhost:3000');\n  try { const r = await fetch(\`${'$'}{API}/imoveis?sort=priceDesc\`); if (!r.ok) throw new Error('api'); return await r.json(); } catch { return []; }\n}`);
  // corrigir label cidade quebrada com CRLF literal
  t = t.replace(/<label for=\"f_city\">Cidade<\/label>\\r\\n\s*<select id=\"f_city\"/g, '<label for="f_city">Cidade</label>\n            <select id="f_city"');
  fs.writeFileSync(file,t,'utf8');
}

function patchIndex(){
  const file = path.join(ROOT,'index.html');
  if (!fs.existsSync(file)) return;
  let t = fs.readFileSync(file,'utf8');
  t = t.replace(/<title>[\s\S]*?<\/title>/,'<title>XImóveis - Início</title>');
  // garantir chamada única
  t = t.replace(/document\.addEventListener\([\s\S]*?\);/,'document.addEventListener("DOMContentLoaded", ()=>{ try{ if (window.XAuthUI) XAuthUI.applyNav(); }catch{} loadFeatured(); initMap(); });');
  fs.writeFileSync(file,t,'utf8');
}

walk(ROOT);
patchBuscar();
patchIndex();
console.log('ok');
