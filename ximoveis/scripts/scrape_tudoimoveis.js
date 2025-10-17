#!/usr/bin/env node
// Scrape titles, descriptions, attributes and images from TudoImoveis DF
// Outputs:
// - frontend/public/assets/demo-properties.json
// - frontend/public/assets/property-images.json (merged)

const fs = require('fs');
const path = require('path');

const BASE = 'https://www.tudoimoveisdf.com.br';
const LIST_URL = `${BASE}/comprar`;
const OUT_DIR = path.join(__dirname, '..', 'frontend', 'public', 'assets');
const OUT_IMAGES = path.join(OUT_DIR, 'properties');
const OUT_MAP_JSON = path.join(OUT_DIR, 'property-images.json');
const OUT_DEMO_JSON = path.join(OUT_DIR, 'demo-properties.json');

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 demo-scraper' } });
  if (!res.ok) throw new Error(`fetch ${url} ${res.status}`);
  return await res.text();
}

function uniq(arr) { return Array.from(new Set(arr)); }
function onlyDigits(s) { return (s || '').replace(/\D+/g, ''); }
function toNumberBRL(s) {
  const d = onlyDigits(s);
  return d ? Number(d) / 100 : null;
}

function pickAllImages(html) {
  const rx = /(?:src|data-src)\s*=\s*\"([^\"]+\.(?:jpg|jpeg|webp|png))(?:\?[^\"]*)?\"/gi;
  const out = [];
  let m;
  while ((m = rx.exec(html))) out.push(m[1]);
  return uniq(out)
    .map(u => (u.startsWith('//') ? 'https:' + u : u.startsWith('/') ? BASE + u : u))
    .filter(u => !/(logo|favicon|sprite|banner|icone|icon|topo|header|footer|\/images\/|fotorama|background)/i.test(u));
}

function extractDetailLinks(listHtml) {
  const rx = /href=\"(\/comprar\/[^\"#?]+)\"/gi;
  const links = [];
  let m; while ((m = rx.exec(listHtml))) links.push(m[1]);
  return uniq(links).map(u => (u.startsWith('/') ? BASE + u : u));
}

function parseTextBetween(html, tag) {
  const rx = new RegExp(`<${tag}[^>]*>([\s\S]*?)<\/${tag}>`, 'i');
  const m = rx.exec(html);
  return m ? m[1].replace(/<[^>]+>/g, '').trim() : '';
}

function parseMeta(html, name) {
  const rx = new RegExp(`<meta[^>]+(?:name|property)=\"${name}\"[^>]+content=\"([^\"]*)\"`, 'i');
  const m = rx.exec(html);
  return m ? m[1].trim() : '';
}

function parseAttributes(html) {
  // Extremely heuristic parsing based on common listing terms
  const txt = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const num = (re) => { const m = re.exec(txt); return m ? Number(m[1]) : null; };
  return {
    bedrooms: num(/(\d+)\s*(?:quarto|qtos|dorm)/i) || 0,
    bathrooms: num(/(\d+)\s*(?:banheiro|banh)/i) || 0,
    suites: num(/(\d+)\s*(?:su[iÃƒÂ­]te)/i) || 0,
    parking_spaces: num(/(\d+)\s*(?:vaga|garagem)/i) || 0,
    area_m2: num(/(\d+[\.,]?\d*)\s*m(?:Ã‚Â²|2)/i) || null,
  };
}

function guessType(title) {
  const t = title.toLowerCase();
  if (/(apart|apto|studio|kit)/.test(t)) return 'APARTMENT';
  if (/(casa|sobrado|mansÃƒÂ£o)/.test(t)) return 'HOUSE';
  if (/(lote|terreno)/.test(t)) return 'LAND';
  return 'APARTMENT';
}

function guessPurpose(title) {
  const t = title.toLowerCase();
  if (/alug/.test(t)) return 'RENT';
  return 'SALE';
}

function extractCityUF(html){
  const text = (parseMeta(html,'description') + ' ' + parseTextBetween(html,'p')).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  const rxCityUF = /([A-Za-zÁ-Úá-úçÇãõâêôîôûéíóúàèìòùñ\s]+)\s*\/\s*(DF|GO)/gi;
  let m, last=null; while ((m = rxCityUF.exec(text))) { last = { city: m[1].trim(), state: m[2].toUpperCase() }; }
  if (last) {
    let city = last.city.replace(/\s+/g,' ').toLowerCase();
    const map = new Map([
      ['brasilia','Brasília'],['brasília','Brasília'],['aguas claras','Águas Claras'],['águas claras','Águas Claras'],['jardim inga','Jardim Ingá'],['jardim ingá','Jardim Ingá'],['sao sebastiao','São Sebastião'],['são sebastião','São Sebastião']
    ]);
    city = map.get(city) || city.replace(/^\w|\s\w/g, s=>s.toUpperCase());
    return { city, state: last.state };
  }
  return null;
}function guessCityState(html) {
  const meta = parseMeta(html, 'og:locality');
  if (meta) return { city: meta, state: 'DF' };
  return { city: 'BrasÃƒÂ­lia', state: 'DF' };
}

async function download(url, outPath) {
  const res = await fetch(url);
  if (!res.ok) return false;
  const buff = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, buff);
  return true;
}

async function main() {
  fs.mkdirSync(OUT_IMAGES, { recursive: true });
  const listHtml = await fetchText(LIST_URL);
  const detailLinks = extractDetailLinks(listHtml).slice(0, 20);
  const props = [];
  let imageMap = {};
  if (fs.existsSync(OUT_MAP_JSON)) {
    try {
      const raw = fs.readFileSync(OUT_MAP_JSON, 'utf8').replace(/^\uFEFF/, '');
      imageMap = JSON.parse(raw || '{}');
    } catch { imageMap = {}; }
  }
  let idCounter = 1;
  for (const link of detailLinks) {
    try {
      const h = await fetchText(link);
      const title = parseMeta(h, 'og:title') || parseTextBetween(h, 'h1') || 'ImÃƒÂ³vel';
      const desc = parseMeta(h, 'description') || parseTextBetween(h, 'p') || '';
      const priceMatch = /(R\$\s?[\d\.]+,[\d]{2})/i.exec(h);
      const price = priceMatch ? toNumberBRL(priceMatch[1]) : null;
      const imgs = pickAllImages(h).slice(0, 8);
      const { bedrooms, bathrooms, suites, parking_spaces, area_m2 } = parseAttributes(h);
      const { city, state } = guessCityState(h);
      const type = guessType(title);
      const purpose = guessPurpose(title);

      const id = idCounter++;
      props.push({ id, title, description: desc, price, bedrooms, bathrooms, suites, parking_spaces, area_m2, city, state, purpose, type, certificate_verified: true, lat: -15.78 + Math.random()*0.2 - 0.1, lng: -47.93 + Math.random()*0.2 - 0.1 });

      const saved = [];
      for (let i=0; i<imgs.length; i++) {
        const url = imgs[i];
        const ext = path.extname(url.split('?')[0]) || '.jpg';
        const name = (i===0?'cover':String(i+1)) + ext;
        const out = path.join(OUT_IMAGES, String(id), name);
        try { const ok = await download(url, out); if (ok) saved.push(path.posix.join('assets/properties', String(id), name)); } catch {}
      }
      if (saved.length) imageMap[String(id)] = saved;
      if (props.length >= 10) break;
    } catch {}
  }

  fs.writeFileSync(OUT_DEMO_JSON, JSON.stringify(props, null, 2), 'utf8');
  fs.writeFileSync(OUT_MAP_JSON, JSON.stringify(imageMap, null, 2), 'utf8');
  console.log(`Scraped ${props.length} properties.`);
}

main().catch(e => { console.error(e); process.exit(1); });



