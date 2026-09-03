const views=document.querySelectorAll('.view');const nav=[...document.querySelectorAll('nav button')];
function show(id){views.forEach(v=>v.classList.remove('active'));nav.forEach(b=>b.classList.remove('active'));document.getElementById(id).classList.add('active');nav.find(b=>b.dataset.view===id)?.classList.add('active')}
nav.forEach(b=>b.onclick=()=>show(b.dataset.view));
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active'));b.classList.add('active')});
document.getElementById('extract').onclick=()=>{
 const t=document.getElementById('sourceText').value;
 const m=(r,f='nicht erkannt')=>(t.match(r)||[])[1]||f;
 const data={
  'Case-ID':'IFSD-2026-0903-017',
  'Priorität':/shutdown/i.test(t)?'CRITICAL':'REVIEW',
  'Flugnummer':m(/\b([A-Z]{2}\d{2,4})\b/i),
  'Flugzeug':m(/\b(Boeing\s+\d{3}(?:-\d+)?)\b/i),
  'Triebwerk':m(/\b(Trent\s+\d{3,4})\b/i),
  'Zeitpunkt':m(/\b(\d{1,2}:\d{2}\s*UTC)\b/i),
  'Flughöhe':m(/\b(FL\d{2,3})\b/i),
  'Ort':/Nordatlantik/i.test(t)?'Nordatlantik':'nicht erkannt'
 };
 document.getElementById('fields').innerHTML=Object.entries(data).map(([k,v])=>`<div class="field"><small>${k}</small><b>${v}</b></div>`).join('');
 const missing=['Ölstand / Oil-System-Informationen','vollständiger EHM-Datensatz','bestätigtes Crew Statement'];
 document.getElementById('missing').innerHTML=missing.map(x=>`<div class="miss">⚠ ${x}</div>`).join('');
 document.getElementById('toResponse').disabled=false;
};
document.getElementById('toResponse').onclick=()=>show('response');