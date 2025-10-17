#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const DEMO = path.join(__dirname,'..','frontend','public','assets','demo-properties.json');
const MAP = path.join(__dirname,'..','frontend','public','assets','property-images.json');

function loadJson(p){ try { return JSON.parse(fs.readFileSync(p,'utf8')); } catch { return null } }
function saveJson(p, data){ fs.writeFileSync(p, JSON.stringify(data,null,2), 'utf8'); }

const all = loadJson(DEMO) || [];
const imgMap = loadJson(MAP) || {};

const isHouse = (p)=> String(p.type||'').toUpperCase()==='HOUSE' || /\bcasa\b/i.test(p.title||'') || /\bcasa\b/i.test(p.description||'');
const houses = all.filter(isHouse);

// Reatribui IDs sequenciais para simplificar (e sincroniza imagens)
let nextId = 1; const newMap = {};
for (const p of houses){
  const oldId = String(p.id);
  p.id = nextId++;
  if (imgMap[oldId]) newMap[String(p.id)] = imgMap[oldId];
}

saveJson(DEMO, houses);
saveJson(MAP, newMap);
console.log(`Kept ${houses.length} houses and remapped images.`);

