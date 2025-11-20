const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'frontend', 'public');
const exts = new Set(['.html','.css','.js']);
function score(str){ const m=str.match(/[Ã�]|imA3|InA-cio|caracterA-st|PreA|DescriA|LocalizaA|matrA|VocA|NA�o/g); return m?m.length:0; }
function fixText(buf){
  // strip UTF-8 BOM if present
  if (buf[0]===0xEF && buf[1]===0xBB && buf[2]===0xBF) buf = buf.slice(3);
  let t = buf.toString('utf8');
  // remove stray literal CRLF markers and stray `n before head close
  t = t.replace(/`n\s*<\/head>/g,'</head>').replace(/\\r\\n/g,'\r\n');
  const cand = Buffer.from(t,'latin1').toString('utf8');
  if (score(cand) < score(t)) t = cand; // pick better
  const pairs = [
    [/XImA3veis/g,'XImóveis'],[/ImA3veis/g,'Imóveis'],[/imA3veis/g,'imóveis'],
    [/ImA3vel/g,'Imóvel'],[/imA3vel/g,'imóvel'],[/InA-cio/g,'Início'],
    [/caracterA-sticas/g,'características'],[/PreA\u0015o|PreA�o/g,'Preço'],
    [/DescriA\u0015A�o|DescriA�o/g,'Descrição'],[/LocalizaA\u0015A�o|LocalizaA�o/g,'Localização'],
    [/matrA-cula/g,'matrícula'],[/VocA� jA�/g,'Você já'],[/NA�o/g,'Não'],
    [/In�cio/g,'Início'],[/Im�veis/g,'Imóveis'],[/im�veis/g,'imóveis'],[/im�vel/g,'imóvel'],
  ];
  for (const [rg,to] of pairs) t = t.replace(rg,to);
  return t;
}
function process(file){
  const ext = path.extname(file);
  if (!exts.has(ext)) return;
  const buf = fs.readFileSync(file);
  const out = fixText(buf);
  fs.writeFileSync(file, out, {encoding:'utf8', flag:'w'}); // Node writes without BOM
}
(function walk(dir){
  for (const e of fs.readdirSync(dir)){
    const f = path.join(dir,e); const st = fs.statSync(f);
    if (st.isDirectory()) walk(f); else process(f);
  }
})(ROOT);
console.log('normalized');
