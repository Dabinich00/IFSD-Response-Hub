const views=document.querySelectorAll('.view');const nav=[...document.querySelectorAll('nav button')];
let currentCase=null;
let caseSourceText='';
let missingItems=[];
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
  'Ort':/Nordatlantik/i.test(t)?'Nordatlantik':'nicht erkannt',
  'Route':'nicht erkannt',
  'Kunde':m(/\b(LHA|Lufthansa|BA|British Airways|Emirates|Qatar Airways)\b/i,'nicht erkannt'),
  'Problem':m(/\b(engine shutdown|in-flight shutdown|bird strike|smoke|fire|vibration(?:en)?)\b/i,'IFSD event')
 };
 const routeMatch=t.match(/von\s+([A-Za-zÄÖÜäöüß -]+?)\s+nach\s+([A-Za-zÄÖÜäöüß -]+?)(?:\.|,|$)/i);
 if(routeMatch)data.Route=`${routeMatch[1].trim()} → ${routeMatch[2].trim()}`;
 if(/^LH/i.test(data.Flugnummer))data.Kunde='LHA';
 if(/^BA/i.test(data.Flugnummer))data.Kunde='BA';
 renderCaseFields(data);
 missingItems=['Ölstand / Oil-System-Informationen','vollständiger EHM-Datensatz','bestätigtes Crew Statement'];
 renderMissingItems();
 currentCase=data;
 caseSourceText=t;
 syncDashboard(data,t);
 document.getElementById('saveCase').disabled=false;
 document.getElementById('createFollowUp').disabled=false;
 setCaseStatus('Case erstellt','ready');
 document.getElementById('followUpPanel').hidden=true;
 document.getElementById('toResponse').disabled=false;
};
document.getElementById('toResponse').onclick=()=>show('response');

function renderCaseFields(data){
 const fields=document.getElementById('fields');
 fields.replaceChildren();
 Object.entries(data).forEach(([key,value])=>{
  const wrapper=document.createElement('label');wrapper.className='field';
  const caption=document.createElement('small');caption.textContent=key;
  const input=document.createElement('input');input.value=value;input.dataset.caseKey=key;
  wrapper.append(caption,input);fields.append(wrapper);
 });
}

function renderMissingItems(){
 const missing=document.getElementById('missing');missing.replaceChildren();
 if(!missingItems.length){
  const complete=document.createElement('div');complete.className='complete-message';complete.textContent='✓ Alle angeforderten Pflichtinformationen wurden ergänzt.';missing.append(complete);
 }else{
  missingItems.forEach(item=>{
   const label=document.createElement('label');label.className='miss';
   const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.value=item;
   label.append(checkbox,document.createTextNode(item));missing.append(label);
  });
 }
 updateCompleteness();
}

function setCaseStatus(message,state){
 const status=document.getElementById('caseStatus');status.textContent=message;status.dataset.state=state;
}

document.getElementById('saveCase').onclick=()=>{
 if(!currentCase)return;
 document.querySelectorAll('[data-case-key]').forEach(input=>currentCase[input.dataset.caseKey]=input.value.trim()||'nicht erkannt');
 syncDashboard(currentCase,caseSourceText);setCaseStatus('Änderungen gespeichert','saved');
};

document.getElementById('createFollowUp').onclick=()=>{
 const selected=[...document.querySelectorAll('#missing input:checked')].map(input=>input.value);
 if(!selected.length){setCaseStatus('Bitte fehlende Angaben auswählen','warning');return;}
 const flight=currentCase?.Flugnummer||'dem gemeldeten Flug';
 document.getElementById('followUpText').value=`Betreff: Fehlende Informationen zu Case ${currentCase['Case-ID']}\n\nBitte senden Sie uns für ${flight} noch folgende Informationen:\n${selected.map(item=>`• ${item}`).join('\n')}\n\nVielen Dank. Die fachliche Bewertung erfolgt durch einen autorisierten Experten.`;
 document.getElementById('receivedInfo').value='';document.getElementById('followUpPanel').hidden=false;
 setCaseStatus('Rückfrage ausstehend','waiting');textDashboardStatus(`Follow-up pending · ${flight}`);
};

document.getElementById('applyReceivedInfo').onclick=()=>{
 const answer=document.getElementById('receivedInfo').value.trim();
 const selected=[...document.querySelectorAll('#missing input:checked')].map(input=>input.value);
 if(!answer||!selected.length){setCaseStatus('Antwort und Angaben erforderlich','warning');return;}
 missingItems=missingItems.filter(item=>!selected.includes(item));caseSourceText=`${caseSourceText}\nErgänzung: ${answer}`;
 renderMissingItems();document.getElementById('followUpPanel').hidden=true;syncDashboard(currentCase,caseSourceText);setCaseStatus('Ergänzung übernommen','saved');
};

function updateCompleteness(){
 const completeness=Math.round(((3-missingItems.length)/3)*18+82);
 document.getElementById('completenessValue').textContent=`${completeness}%`;
 document.getElementById('responseMissing').innerHTML=missingItems.length?missingItems.map(item=>`<p>${item}</p>`).join(''):'<p>Keine offenen angeforderten Angaben</p>';
}

function textDashboardStatus(value){document.getElementById('dashboardSyncStatus').textContent=value;}

function syncDashboard(data,sourceText){
 const text=(id,value)=>document.getElementById(id).textContent=value;
 const route=data.Route==='nicht erkannt'?(data.Ort==='nicht erkannt'?'Route offen':data.Ort):data.Route.replace(/\s+/g,' ').trim();
 const problem=data.Problem.replace(/\b\w/g,c=>c.toUpperCase());
 text('dashboardCase',data['Case-ID'].replace('IFSD-2026-',''));
 text('dashboardTrip',route);
 text('dashboardType',data.Triebwerk);
 text('dashboardCustomer',data.Kunde);
 text('dashboardProblem',problem);
 text('dashboardLevel',data.Priorität==='CRITICAL'?'1':'2');
 textDashboardStatus(`Synced from intake · ${data.Flugnummer}`);
 text('dashboardNotes',sourceText.length>150?`${sourceText.slice(0,147)}…`:sourceText);
 const cityCodes={'New York':'JFK','Frankfurt':'FRA','Berlin':'BER','München':'MUC','Munich':'MUC','Shannon':'SNN','Boston':'BOS'};
 if(data.Route!=='nicht erkannt'){
  const [origin,destination]=data.Route.split('→').map(value=>value.trim());
  document.querySelectorAll('.route-origin').forEach(element=>element.textContent=cityCodes[origin]||origin.slice(0,3).toUpperCase());
  document.querySelectorAll('.route-destination').forEach(element=>element.textContent=cityCodes[destination]||destination.slice(0,3).toUpperCase());
 }
 document.getElementById('dashboardLevel').classList.toggle('review',data.Priorität!=='CRITICAL');
}

const dashboardClock=document.getElementById('dashboardClock');
function updateDashboardClock(){
 const now=new Date();
 const time=now.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
 const date=now.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'});
 dashboardClock.textContent=`${time}  ${date}`;
}
updateDashboardClock();
setInterval(updateDashboardClock,30000);
