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

const dashboardClock=document.getElementById('dashboardClock');
function updateDashboardClock(){
 const now=new Date();
 const time=now.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
 const date=now.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'});
 dashboardClock.textContent=`${time}  ${date}`;
}
updateDashboardClock();
setInterval(updateDashboardClock,30000);

// Interactive layers and case selection for the demo Geo Resource Map.
const worldMap=document.querySelector('.world-map');
const casePopover=document.getElementById('casePopover');
const caseDetails={
 'Case 003':['Trent XWB','1','in progress'],
 'Case 005':['Trent 1000','1','awaiting parts'],
 'Case 006':['Trent 7000','4','monitoring'],
 'Case 007':['Trent 700','2','team assigned'],
 'Case 009':['Pearl 15','3','under review'],
 'Case 011':['Trent 900','4','monitoring'],
 'Case 012':['Trent XWB','4','data intake']
};

document.querySelectorAll('.marker.case').forEach(marker=>marker.addEventListener('click',()=>{
 const [engine,priority,status]=caseDetails[marker.dataset.case];
 casePopover.querySelector('b').textContent=marker.dataset.case;
 const rows=casePopover.querySelectorAll('span');
 rows[0].textContent=`Engine: ${engine}`;
 rows[1].textContent=`Priority: ${priority}`;
 rows[2].textContent=`Status: ${status}`;
 casePopover.style.left=`min(${marker.style.getPropertyValue('--x')}, calc(100% - 210px))`;
 casePopover.style.top=`max(14px, calc(${marker.style.getPropertyValue('--y')} - 105px))`;
}));

document.querySelectorAll('[data-layer]').forEach(toggle=>toggle.addEventListener('change',()=>{
 const layers=toggle.dataset.layer.split(',');
 if(layers.includes('weather')) worldMap.classList.toggle('weather-on',toggle.checked);
 layers.filter(layer=>layer!=='weather').forEach(layer=>{
  document.querySelectorAll(`.marker.${layer}`).forEach(marker=>marker.classList.toggle('layer-hidden',!toggle.checked));
 });
}));

document.querySelectorAll('[data-open-response]').forEach(button=>button.addEventListener('click',()=>show('response')));
