const fs=require('fs');
const path=require('path');
const ROOT=path.join(__dirname,'..','frontend','public');
const files=[];(function walk(d){for(const e of fs.readdirSync(d)){const f=path.join(d,e);const s=fs.statSync(f);if(s.isDirectory()) walk(f); else if(/\.html$/i.test(f)) files.push(f)}})(ROOT);
function replaceNonScript(html, replacer){
  return html.replace(/(<script\b[\s\S]*?<\/script>)/gi, m=>`§§SCRIPT§§${Buffer.from(m).toString('base64')}§§END§§`)
             .replace(/\\n/g,'\n').replace(/\\r\\n/g,'\r\n')
             .replace(/§§SCRIPT§§([A-Za-z0-9+/=]+)§§END§§/g,(m,b64)=>Buffer.from(b64,'base64').toString('utf8'));
}
function fixHeader(html){
  // Ensure header texts
  html = html.replace(/>In.?cio</g,'>Início<').replace(/XIm.?veis/g,'XImóveis').replace(/im.?veis/g,'imóveis');
  return html;
}
for(const f of files){ let t=fs.readFileSync(f,'utf8'); const before=t; t=replaceNonScript(t); t=fixHeader(t); if(t!==before){ fs.writeFileSync(f,t,'utf8'); console.log('fixed',path.basename(f)); } }
console.log('done-fix-headers');
