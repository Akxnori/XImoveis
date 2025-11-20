const fs=require('fs');const path=require('path');
const ROOT=path.join(__dirname,'..','frontend','public');
const exts=new Set(['.html','.css','.js']);
function strip(buf){
  // remove leading BOMs and replacement chars U+FFFD (EF BF BD)
  let i=0; while(i+2<buf.length){ const a=buf[i],b=buf[i+1],c=buf[i+2]; if((a===0xEF&&b===0xBB&&c===0xBF)||(a===0xEF&&b===0xBF&&c===0xBD)){ i+=3; } else break; }
  return buf.slice(i);
}
(function walk(d){
  for(const e of fs.readdirSync(d)){
    const f=path.join(d,e); const s=fs.statSync(f);
    if(s.isDirectory()) walk(f); else if(exts.has(path.extname(f))){ const buf=fs.readFileSync(f); const out=strip(buf); if(out.length!==buf.length){ fs.writeFileSync(f,out); console.log('stripped',path.relative(ROOT,f)); } }
  }
})(ROOT);
console.log('stripped-done');
