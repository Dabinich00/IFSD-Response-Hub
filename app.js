const views=document.querySelectorAll('.view');const nav=[...document.querySelectorAll('nav button')];
let currentCase=null;
let caseDirty=false;
let caseSaving=false;

function show(id){views.forEach(v=>v.classList.remove('active'));nav.forEach(b=>b.classList.remove('active'));document.getElementById(id).classList.add('active');nav.find(b=>b.dataset.view===id)?.classList.add('active')}
nav.forEach(b=>b.onclick=()=>{show(b.dataset.view);if(b.dataset.view==='cases')loadCases()});
document.querySelectorAll('.tabs button').forEach((b,index)=>{if(index===0)b.classList.add('active');b.onclick=()=>{document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active'));b.classList.add('active')}});

const fields=[
 {key:'caseId',label:'Case ID',readonly:true},
 {key:'source',label:'Source',type:'source',required:true},
 {key:'customer',label:'Customer',expected:true},
 {key:'aircraftId',label:'Aircraft ID',expected:true},
 {key:'aircraftLocation',label:'Aircraft Location',expected:true},
 {key:'priority',label:'Priority',type:'priority',expected:true},
 {key:'eventTime',label:'Event Time',expected:true},
 {key:'requestedDepartureDate',label:'Requested Departure Date',expected:true},
 {key:'engine1',label:'Engine 1 Number',expected:true},
 {key:'engine2',label:'Engine 2 Number',expected:true},
 {key:'problemNotes',label:'Problem / Notes',type:'textarea',required:true},
 {key:'assistantSuggestions',label:'Assistant Suggestions',type:'textarea'}
];
const priorityLevels=['','1 - Most urgent','2 - Urgent','3 - Medium','4 - Low','5 - Lowest'];

let mediaRecorder=null;
let audioChunks=[];
let recordingStartedAt=0;
let recordingTimerId=null;
const startRecordingButton=document.getElementById('startRecording');
const stopRecordingButton=document.getElementById('stopRecording');

if(startRecordingButton&&stopRecordingButton){
 startRecordingButton.onclick=async()=>{
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){setRecorderStatus('Browser unterstützt keine Aufnahme','error');return;}
  try{
   const stream=await navigator.mediaDevices.getUserMedia({audio:true});
   const preferredType=['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(type=>MediaRecorder.isTypeSupported(type));
   mediaRecorder=new MediaRecorder(stream,preferredType?{mimeType:preferredType}:undefined);audioChunks=[];
   mediaRecorder.ondataavailable=event=>{if(event.data.size)audioChunks.push(event.data)};
   mediaRecorder.onstop=()=>transcribeRecording(stream);
   mediaRecorder.start();recordingStartedAt=Date.now();updateRecordingTimer();recordingTimerId=setInterval(updateRecordingTimer,500);
   startRecordingButton.disabled=true;stopRecordingButton.disabled=false;setRecorderStatus('Aufnahme läuft','recording');
  }catch(error){setRecorderStatus(error.name==='NotAllowedError'?'Mikrofon nicht freigegeben':'Aufnahme nicht möglich','error');}
 };

 stopRecordingButton.onclick=()=>{
  if(mediaRecorder?.state==='recording'){mediaRecorder.stop();clearInterval(recordingTimerId);stopRecordingButton.disabled=true;setRecorderStatus('Transkription läuft …','working');}
 };
}

function setRecorderStatus(message,state='idle'){
 const status=document.getElementById('recorderStatus');if(!status)return;
 status.textContent=message;status.dataset.state=state;
}

function updateRecordingTimer(){
 const timer=document.getElementById('recordingTimer');if(!timer)return;
 const seconds=Math.floor((Date.now()-recordingStartedAt)/1000);
 timer.textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
}

async function transcribeRecording(stream){
 stream.getTracks().forEach(track=>track.stop());
 try{
  const audioBlob=new Blob(audioChunks,{type:mediaRecorder.mimeType||'audio/webm'});
  const language=document.getElementById('transcriptionLanguage').value;
  const response=await fetch(`/api/transcribe${language?`?language=${language}`:''}`,{method:'POST',headers:{'Content-Type':audioBlob.type},body:audioBlob});
  const result=await response.json();
  if(!response.ok)throw new Error(result.error||'Transkription fehlgeschlagen');
  document.getElementById('sourceText').value=result.text;
  setRecorderStatus(`Fertig · ${result.language||'auto'}`,'success');
 }catch(error){setRecorderStatus(error.message.includes('Failed to fetch')?'Lokaler Whisper-Server nicht erreichbar':error.message,'error');}
 finally{startRecordingButton.disabled=false;mediaRecorder=null;audioChunks=[];}
}

document.getElementById('extract').onclick=()=>{
 if(caseSaving||!canReplaceCase())return;
 const sourceText=document.getElementById('sourceText').value.trim();
 if(!sourceText){document.getElementById('saveStatus').textContent='Enter a message first.';return;}
 const activeTab=document.querySelector('.tabs button.active')?.textContent||'E-Mail / Text';
 const data=extractCase(sourceText,activeTab);
 currentCase=data;
 currentCase.originalText=sourceText;
 caseDirty=true;
 document.getElementById('saveStatus').textContent='Not saved. Case ID will be assigned when saving.';
 renderCase(data);
 renderAlerts(data,sourceText);
 document.getElementById('originalText').value=sourceText||'No source text provided.';
 document.getElementById('intake').classList.add('case-created');
 syncDashboard(data,sourceText);
 document.getElementById('toResponse').disabled=false;
};

function extractCase(text,activeTab){
 const m=(regex,fallback='')=>(text.match(regex)||[])[1]?.trim()||fallback;
 const requestedDepartureDate=extractRequestedDeparture(text);
 const customer=m(/\bCustomer:\s*([^\n\r]+)/i)||m(/\b(Lufthansa|British Airways|Emirates|Qatar Airways|LHA|BA)\b/i);
 const aircraftLocation=extractAircraftLocation(text);
 return {
  caseId:'',
  source:/phone|telefon/i.test(activeTab)?'Phone Transcript':'Email',
  customer:normalizeCustomer(customer),
  aircraftId:m(/\b(?:Aircraft ID|Aircraft|Registration|Tail(?: number)?):\s*([A-Z0-9-]{4,12})\b/i)||m(/\b([A-Z]-[A-Z0-9]{4}|N[0-9A-Z]{4,6}|G-[A-Z0-9]{4})\b/i),
  aircraftLocation,
  eventTime:extractEventDateTime(text),
  requestedDepartureDate,
  engine1:m(/\bEngine\s*1(?:\s*Number|\s*No\.?|\s*ID)?\s*:\s*([A-Z0-9-]{4,24})\b/i),
  engine2:m(/\bEngine\s*2(?:\s*Number|\s*No\.?|\s*ID)?\s*:\s*([A-Z0-9-]{4,24})\b/i),
  problemNotes:extractProblemNotes(text),
  assistantSuggestions:'',
  priority:calculatePriority(requestedDepartureDate)
 };
}

function extractRequestedDeparture(text){
 return mDate(/\b(?:depart(?:ure)? again|next departure|requested departure|ready for departure|return to service)\D{0,40}(\d{4}-\d{2}-\d{2}(?:\s+at\s+\d{1,2}:\d{2}\s*UTC)?)\b/i,text)
  ||mDate(/\b(\d{4}-\d{2}-\d{2}(?:\s+at\s+\d{1,2}:\d{2}\s*UTC)?)\b/i,text);
}

function mDate(regex,text){return (text.match(regex)||[])[1]?.trim()||''}

function extractEventDateTime(text){
 const eventMatch=text.match(/\b(?:event|shutdown|reported|occurred)\D{0,60}(\d{4}-\d{2}-\d{2})\D{0,20}(\d{1,2}:\d{2}\s*UTC)\b/i);
 if(eventMatch)return `${eventMatch[1]} ${eventMatch[2]}`;
 return mDate(/\b(?:event|shutdown|reported|occurred)\D{0,60}(\d{1,2}:\d{2}\s*UTC)\b/i,text)
  ||mDate(/\b(\d{1,2}:\d{2}\s*UTC)\b/i,text);
}

function extractAircraftLocation(text){
 const diverted=(text.match(/\bdiverted to\s+([A-Za-z -]+?)(?:\.|,| and|$)/i)||[])[1];
 const onGround=(text.match(/\b(?:on ground|located|currently)\s+(?:in|at|there\s*in)?\s*([A-Za-z -]+?)(?:\.|,| and|$)/i)||[])[1];
 return (diverted||onGround||'').trim();
}

function normalizeCustomer(value){
 const v=(value||'').trim();
 if(/^LHA$/i.test(v))return 'Lufthansa';
 if(/^BA$/i.test(v))return 'British Airways';
 return v;
}

function extractProblemNotes(text){
 const sentences=text.split(/(?<=[.!?])\s+/).filter(Boolean);
 const relevant=sentences.filter(s=>/\b(shutdown|IFSD|vibration|EGT|oil|failure|failed|AOG|ground)\b/i.test(s));
 return (relevant.slice(0,2).join(' ')||sentences[0]||'').trim();
}

function calculatePriority(requestedDepartureDate){
 if(!requestedDepartureDate)return 'Pending';
 const dateMatch=requestedDepartureDate.match(/\d{4}-\d{2}-\d{2}/);
 if(!dateMatch)return 'Pending';
 const requested=new Date(`${dateMatch[0]}T00:00:00`);
 const today=new Date();
 today.setHours(0,0,0,0);
 const days=Math.round((requested-today)/86400000);
 if(days<=1)return '1 - Most urgent';
 if(days<=3)return '2 - Urgent';
 if(days<=14)return '3 - Medium';
 if(days<=30)return '4 - Low';
 return '5 - Lowest';
}

function renderCase(data){
 document.getElementById('fields').innerHTML=fields.map(field=>fieldMarkup(field,data[field.key])).join('');
 document.querySelectorAll('[data-case-field]').forEach(input=>{
  input.oninput=()=>{
   caseDirty=true;
   currentCase[input.dataset.caseField]=input.value;
   if(input.dataset.caseField==='requestedDepartureDate'){
    currentCase.priority=calculatePriority(input.value);
    document.querySelector('[data-case-field="priority"]').value=currentCase.priority;
   }
   renderAlerts(currentCase,document.getElementById('originalText').value);
   syncDashboard(currentCase,document.getElementById('originalText').value);
  };
 });
}

function fieldMarkup(field,value){
 const safeValue=escapeHtml(value||'');
 if(field.type==='source')return `<div class="field"><small>Source *</small><select data-case-field="source">${['Email','Phone Transcript'].map(source=>`<option${source===value?' selected':''}>${source}</option>`).join('')}</select></div>`;
 if(field.type==='priority'){
  const options=['Pending',...priorityLevels.filter(Boolean)].map(level=>`<option value="${escapeHtml(level)}"${level===(value||'Pending')?' selected':''}>${escapeHtml(level)}</option>`).join('');
  return `<div class="field"><small>${field.label}${field.required?' *':''}</small><select data-case-field="${field.key}">${options}</select></div>`;
 }
 if(field.type==='textarea')return `<div class="field field-wide"><small>${field.label}${field.required?' *':''}</small><textarea data-case-field="${field.key}">${safeValue}</textarea></div>`;
 return `<div class="field"><small>${field.label}${field.required?' *':''}</small><input data-case-field="${field.key}" value="${safeValue}" ${field.key==='caseId'?'placeholder="Assigned on first save"':''} ${field.readonly?'readonly':''}></div>`;
}

function renderAlerts(data){
 const alerts=[];
 fields.filter(field=>field.required||field.expected).forEach(field=>{
  if(!data[field.key]||data[field.key]==='Pending')alerts.push(`${field.label} missing`);
 });
 if(!data.requestedDepartureDate)alerts.push('Requested departure date missing - priority cannot be calculated');
 alerts.push('Human review required before case submission');
 alerts.push('Saving requires Source and Problem / Notes. Other missing details can be added later.');
 document.getElementById('missing').innerHTML=alerts.map(alert=>`<div class="miss">⚠ ${escapeHtml(alert)}</div>`).join('');
}

function syncDashboard(data,sourceText){
 const text=(id,value)=>document.getElementById(id).textContent=value||'Open';
 const affectedEngine=/engine\s*1/i.test(data.problemNotes)?data.engine1||'Engine 1':/engine\s*2/i.test(data.problemNotes)?data.engine2||'Engine 2':'Engine open';
 const problem=(data.problemNotes||'Case created').replace(/\b\w/g,c=>c.toUpperCase());
 text('dashboardCase',data.caseId||'Unsaved');
 text('dashboardTrip',data.aircraftLocation||'Location open');
 text('dashboardType',affectedEngine);
 text('dashboardCustomer',data.customer);
 text('dashboardProblem',problem.length>28?`${problem.slice(0,25)}...`:problem);
 text('dashboardLevel',/^[1-5]/.test(data.priority)?data.priority.charAt(0):'?');
 text('dashboardSyncStatus',`Synced from intake · ${data.aircraftId||'Aircraft ID open'}`);
 text('dashboardNotes',sourceText.length>150?`${sourceText.slice(0,147)}…`:sourceText);
 document.getElementById('dashboardLevel').classList.toggle('review',!String(data.priority).startsWith('1'));
}

function escapeHtml(value){
 return String(value).replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[character]));
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

function canReplaceCase(){
 return !caseDirty||window.confirm('Discard unsaved changes to the current case?');
}
window.addEventListener('beforeunload',event=>{
 if(caseDirty){event.preventDefault();event.returnValue='';}
});

async function caseRequest(path='',method='GET',payload){
 if(location.protocol==='file:')throw new Error('Start python server.py and open http://127.0.0.1:8000 to use saved cases.');
 const response=await fetch(`/api/cases${path}`,{
  method,cache:'no-store',signal:AbortSignal.timeout(15000),
  ...(payload?{headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}:{})
 });
 let data;
 try{data=await response.json()}catch{throw new Error('Restart the Python server to enable the case database.')}
 if(!response.ok)throw new Error(data.error||'Case request failed.');
 return data;
}

function openCase(data){
 currentCase=data;caseDirty=false;
 renderCase(data);renderAlerts(data);
 document.getElementById('originalText').value=data.originalText||'';
 document.getElementById('sourceText').value=data.originalText||'';
 document.getElementById('intake').classList.add('case-created');
 document.getElementById('toResponse').disabled=false;
 document.getElementById('saveStatus').textContent=data.caseId?`Loaded ${data.caseId}. Changes require Save Case.`:'New case. ID will be assigned when saving.';
 syncDashboard(data,data.originalText||'');
 show('intake');
}

document.getElementById('newCase').onclick=()=>{
 if(caseSaving||!canReplaceCase())return;
 const blank=Object.fromEntries(fields.map(field=>[field.key,'']));
 openCase({...blank,source:'Email',priority:'Pending',originalText:''});
 caseDirty=true;
};

document.getElementById('toResponse').onclick=async()=>{
 if(!currentCase||caseSaving)return;
 const status=document.getElementById('saveStatus');
 if(!currentCase.problemNotes?.trim()){status.textContent='Problem / Notes is required before saving.';return;}
 caseSaving=true;
 document.getElementById('toResponse').disabled=true;
 document.getElementById('extract').disabled=true;
 document.querySelectorAll('[data-case-field]').forEach(input=>input.disabled=true);
 status.textContent='Saving…';
 try{
  const id=currentCase.caseId;
  currentCase=await caseRequest(id?`/${encodeURIComponent(id)}`:'',id?'PUT':'POST',currentCase);
  caseDirty=false;
  renderCase(currentCase);renderAlerts(currentCase);
  syncDashboard(currentCase,currentCase.originalText||'');
  status.textContent=`Saved ${currentCase.caseId}`;
 }catch(error){status.textContent=`Save not confirmed: ${error.message} If the connection failed, check Saved Cases before retrying to avoid a duplicate.`}
 finally{
  caseSaving=false;
  document.getElementById('toResponse').disabled=false;
  document.getElementById('extract').disabled=false;
  document.querySelectorAll('[data-case-field]').forEach(input=>input.disabled=false);
 }
};

let listRequest=0;
async function loadCases(){
 const request=++listRequest;
 const status=document.getElementById('caseListStatus');
 const container=document.getElementById('caseList');
 status.textContent='Loading…';
 try{
  const query=new URLSearchParams({q:document.getElementById('caseSearch').value,deleted:document.getElementById('caseFilter').value});
  const records=await caseRequest(`?${query}`);
  if(request!==listRequest)return;
  status.textContent=records.length?`${records.length} case(s)`:'No cases found.';
  container.replaceChildren();
  for(const record of records){
   const card=document.createElement('article');
   const title=document.createElement('h3');title.textContent=record.caseId;
   const detail=document.createElement('p');detail.textContent=[record.customer||'Customer unknown',record.aircraftId||'Aircraft unknown',record.aircraftLocation||'Location unknown',record.priority||'Pending'].join(' · ');
   const notes=document.createElement('p');notes.textContent=record.problemNotes;
   const actions=document.createElement('div');actions.className='case-actions';
   const open=document.createElement('button');open.textContent=record.deletedAt?'Restore':'Open';
   open.onclick=async()=>{
    if(caseSaving)return;
    if(!record.deletedAt&&!canReplaceCase())return;
    open.disabled=true;
    try{
     if(record.deletedAt){await caseRequest(`/${encodeURIComponent(record.caseId)}/restore`,'POST',{revision:record.revision});await loadCases()}
     else{openCase(await caseRequest(`/${encodeURIComponent(record.caseId)}`))}
    }catch(error){status.textContent=error.message}
    finally{open.disabled=false}
   };
   actions.append(open);
   if(!record.deletedAt){
    const remove=document.createElement('button');remove.textContent='Move to trash';
    remove.onclick=async()=>{
     if(caseSaving)return;
     if(!window.confirm(`Move ${record.caseId} to trash? You can restore it later.`))return;
     if(currentCase?.caseId===record.caseId&&!canReplaceCase())return;
     remove.disabled=true;
     try{
      await caseRequest(`/${encodeURIComponent(record.caseId)}`,'DELETE',{revision:record.revision});
      if(currentCase?.caseId===record.caseId){currentCase=null;caseDirty=false;document.getElementById('fields').replaceChildren();document.getElementById('toResponse').disabled=true;document.getElementById('saveStatus').textContent='Case moved to trash.';}
      await loadCases();
     }catch(error){status.textContent=error.message}
     finally{remove.disabled=false}
    };
    actions.append(remove);
   }
   card.append(title,detail,notes,actions);container.append(card);
  }
 }catch(error){if(request===listRequest){container.replaceChildren();status.textContent=error.message}}
}
document.getElementById('refreshCases').onclick=loadCases;
document.getElementById('caseFilter').onchange=loadCases;
let searchTimer;
document.getElementById('caseSearch').oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(loadCases,250)};
