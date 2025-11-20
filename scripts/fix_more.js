const fs=require('fs');
const path=require('path');
const ROOT=path.join(__dirname,'..','frontend','public');
const files=[];(function walk(d){for(const e of fs.readdirSync(d)){const f=path.join(d,e);const s=fs.statSync(f);if(s.isDirectory()) walk(f); else if(/\.(html|js|css)$/.test(f)) files.push(f)}})(ROOT);
const repl=[
  [/Im?veis/g,'Imóveis'],[/im?veis/g,'imóveis'],[/Im?vel/g,'Imóvel'],[/im?vel/g,'imóvel'],
  [/In?cio/g,'Início'],[/Pre?o/g,'Preço'],[/m?nimo/g,'mínimo'],[/m?ximo/g,'máximo'],
  [/descri?Ã§Ã£o|descri?Ã£o|descri?o/g,'descrição'],[/A?es/g,'Ações'],[/Certidao/g,'Certidão'],
  [/Localiza?Ã§Ã£o|Localiza?Ã§Ã£o|Localiza?o/g,'Localização'],[/XIm?veis/g,'XImóveis']
];
for(const f of files){let t=fs.readFileSync(f,'utf8');let u=t;for(const [rg,to] of repl) u=u.replace(rg,to);if(u!==t){fs.writeFileSync(f,u,'utf8');console.log('fixed',path.relative(ROOT,f))}}
