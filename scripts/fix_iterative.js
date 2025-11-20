const fs=require('fs'); const path=require('path');
const ROOT=path.join(__dirname,'..','frontend','public'); const exts=new Set(['.html','.css','.js']);
function score(s){ const m=s.match(/[Ã�]|imA3|InA-cio|caracterA-st|PreA|DescriA|LocalizaA|matrA|VocA|NA�o/g); return m?m.length:0; }
function normalize(buf){ let t=buf; // strip leading BOM/FFFD
 while(t.length>=3 && ((t[0]===0xEF&&t[1]===0xBB&&t[2]===0xBF)||(t[0]===0xEF&&t[1]===0xBF&&t[2]===0xBD))) t=t.slice(3);
 let s=t.toString('utf8').replace(/`n\s*<\/head>/g,'</head>').replace(/\\r\\n/g,'\r\n');
 let best=s, bestScore=score(s);
 for(let i=0;i<3;i++){ const cand=Buffer.from(best,'latin1').toString('utf8'); const sc=score(cand); if(sc<bestScore){ best=cand; bestScore=sc; } else break; }
 const pairs=[[/(In�cio|InÃƒÂ­cio)/g,'Início'],[/XImA3veis|XImÃƒÂ³veis/g,'XImóveis'],[/imA3veis|imÃƒÂ³veis/g,'imóveis'],[/ImA3vel|ImÃƒÂ³vel/g,'Imóvel'],[/imA3vel|imÃƒÂ³vel/g,'imóvel']];
 for(const [rg,to] of pairs) best=best.replace(rg,to);
 return best;
}
(function walk(d){ for(const e of fs.readdirSync(d)){ const f=path.join(d,e); const s=fs.statSync(f); if(s.isDirectory()) walk(f); else if(exts.has(path.extname(f))){ const out=normalize(fs.readFileSync(f)); fs.writeFileSync(f,out,'utf8'); } } })(ROOT);
console.log('iterative-fix-done');
