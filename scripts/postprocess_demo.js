#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname,'..','frontend','public','assets','demo-properties.json');
function load(){ try { return JSON.parse(fs.readFileSync(FILE,'utf8')); } catch { return [] } }
function save(arr){ fs.writeFileSync(FILE, JSON.stringify(arr,null,2), 'utf8'); }
function norm(s){ return (s||'').toLowerCase(); }
function fixCity(p){
  const t = norm(p.title)+' '+norm(p.description);
  const set = (city,state)=>{ p.city = city; p.state = state; };
  if (/luzi.nia|luziânia/.test(t)) return set('Luziânia','GO');
  if (/jardim ing.*/.test(t) || /ing.\/?go/.test(t)) return set('Jardim Ingá','GO');
  if (/alex.nia|alexânia/.test(t)) return set('Alexânia','GO');
  if (/águas claras|aguas claras/.test(t)) return set('Águas Claras','DF');
  if (/vicente pires/.test(t)) return set('Vicente Pires','DF');
  if (/sobradinho/.test(t)) return set('Sobradinho','DF');
  if (/taguatinga/.test(t)) return set('Taguatinga','DF');
  if (/guar[áa]/.test(t)) return set('Guará','DF');
  if (/asa sul|asa norte|sudoeste|noroeste|cruzeiro|lago sul|lago norte/.test(t)) return set('Brasília','DF');
  if (/gama/.test(t)) return set('Gama','DF');
  // keep existing if not Gama
  if (String(p.city||'').toUpperCase()==='GAMA') p.city='Brasília', p.state='DF';
}
const arr = load(); arr.forEach(fixCity); save(arr); console.log('Postprocess cities done:', arr.map(x=>x.city+','+x.state).join(' | '));
