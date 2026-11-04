const views=document.querySelectorAll('.view');const nav=[...document.querySelectorAll('nav button')];
let currentCase=null;
let caseDirty=false;
let caseSaving=false;

function show(id){views.forEach(v=>v.classList.remove('active'));nav.forEach(b=>b.classList.remove('active'));document.getElementById(id).classList.add('active');nav.find(b=>b.dataset.view===id)?.classList.add('active');if(typeof onViewShown==='function')onViewShown(id)}
nav.forEach(b=>b.onclick=()=>{show(b.dataset.view);if(b.dataset.view==='cases')loadCases()});
document.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>show(b.dataset.open)));
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
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){setRecorderStatus('This browser cannot record audio','error');return;}
  try{
   const stream=await navigator.mediaDevices.getUserMedia({audio:true});
   const preferredType=['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(type=>MediaRecorder.isTypeSupported(type));
   mediaRecorder=new MediaRecorder(stream,preferredType?{mimeType:preferredType}:undefined);audioChunks=[];
   mediaRecorder.ondataavailable=event=>{if(event.data.size)audioChunks.push(event.data)};
   mediaRecorder.onstop=()=>transcribeRecording(stream);
   mediaRecorder.start();recordingStartedAt=Date.now();updateRecordingTimer();recordingTimerId=setInterval(updateRecordingTimer,500);
   startRecordingButton.disabled=true;stopRecordingButton.disabled=false;setRecorderStatus('Recording','recording');
  }catch(error){setRecorderStatus(error.name==='NotAllowedError'?'Microphone access denied':'Recording not possible','error');}
 };

 stopRecordingButton.onclick=()=>{
  if(mediaRecorder?.state==='recording'){mediaRecorder.stop();clearInterval(recordingTimerId);stopRecordingButton.disabled=true;setRecorderStatus('Transcribing …','working');}
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
  let result=await response.json();
  if(!response.ok)throw new Error(result.error||'Transcription failed');
  const jobId=result.job_id;
  if(!jobId)throw new Error('Restart the Python server and reload the page.');
  const started=Date.now();
  let failures=0;
  while(true){
   await new Promise(resolve=>setTimeout(resolve,1000));
   let poll;
   try{
    poll=await fetch(`/api/transcriptions/${jobId}`,{cache:'no-store',signal:AbortSignal.timeout(10000)});
    result=await poll.json();failures=0;
   }catch(error){
    if(++failures>=5)throw new Error('Lost connection to the server. Check that it is running.');
    setRecorderStatus('Reconnecting …','working');continue;
   }
   if(!poll.ok||result.status==='error')throw new Error(result.error||'Transcription failed');
   if(result.status==='done')break;
   const stage=result.status==='loading'?'Loading speech model (first use downloads it)':result.status==='queued'?'Queued':'Transcribing';
   setRecorderStatus(`${stage} · ${result.model} · ${Math.floor((Date.now()-started)/1000)} s`,'working');
  }
  document.getElementById('sourceText').value=result.text;
  setRecorderStatus(`Transcribed · ${result.language||'auto'}`,'success');
 }catch(error){setRecorderStatus(error.message.includes('Failed to fetch')?'Local server not reachable':error.message,'error');}
 finally{startRecordingButton.disabled=false;mediaRecorder=null;audioChunks=[];}
}

// Local AI extraction (Ollama via server.py) with the rule-based extractor as fallback.
let extractionInfo={method:'rules',detail:''};
let aiAvailable=null;
async function aiExtract(text){
 if(location.protocol==='file:')throw new Error('server not running');
 const response=await fetch('/api/extract',{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({text}),signal:AbortSignal.timeout(150000)});
 const result=await response.json();
 if(!response.ok)throw new Error(result.error||'AI extraction failed');
 return result;
}
function setExtractStatus(message,state='idle'){
 const el=document.getElementById('extractStatus');if(!el)return;
 el.textContent=message;el.dataset.state=state;el.hidden=!message;
}
async function refreshAiStatus(){
 if(location.protocol==='file:'){setExtractStatus('Rule-based extraction (start server.py for local AI)');return}
 try{
  const s=await(await fetch('/api/extract/status',{cache:'no-store',signal:AbortSignal.timeout(5000)})).json();
  aiAvailable=!!s.available;
  setExtractStatus(s.available?`Local AI ready · ${s.model}`:'Rule-based extraction · local AI (Ollama) not running',s.available?'success':'idle');
 }catch{aiAvailable=false;setExtractStatus('Rule-based extraction','idle')}
}
refreshAiStatus();

document.getElementById('extract').onclick=async()=>{
 if(caseSaving||!canReplaceCase())return;
 const sourceText=document.getElementById('sourceText').value.trim();
 if(!sourceText){document.getElementById('saveStatus').textContent='Enter a message first.';return;}
 const activeTab=document.querySelector('.tabs button.active')?.textContent||'E-Mail / Text';
 const button=document.getElementById('extract');
 const data=extractCase(sourceText,activeTab);
 button.disabled=true;
 if(aiAvailable!==true)await refreshAiStatus();
 if(aiAvailable)setExtractStatus('Extracting with local AI …','working');
 try{
  if(!aiAvailable)throw new Error('local AI not running');
  const ai=await aiExtract(sourceText);
  let used=0;
  for(const [key,value] of Object.entries(ai.fields||{})){
   if(!value)continue;
   if((key==='requestedDepartureDate'||key==='eventTime')&&data[key]&&!/\d{4}-\d{2}-\d{2}/.test(value))continue;
   data[key]=value;used++;
  }
  extractionInfo={method:'ai',detail:ai.model};
  setExtractStatus(`Extracted with local AI · ${ai.model} · ${used} field(s) · verify before saving`,'success');
 }catch(error){
  extractionInfo={method:'rules',detail:error.message};
  setExtractStatus('Rule-based extraction (local AI not available)','idle');
 }finally{button.disabled=false}
 data.originalText=sourceText;
 const suggestion=suggestPriority(data);
 data.priority=suggestion.priority;
 data.assistantSuggestions=priorityNote(suggestion)+(extractionInfo.method==='ai'?`\nFields extracted with local AI (${extractionInfo.detail}); verify against the original message.`:'');
 priorityManual=false;
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
 document.getElementById('toAnalysis').disabled=false;
};

function extractCase(text,activeTab){
 const m=(regex,fallback='')=>(text.match(regex)||[])[1]?.trim()||fallback;
 const requestedDepartureDate=extractRequestedDeparture(text);
 // Labelled emails first ("Customer: …"), then free speech ("… from Demo Baltic Wings").
 const customer=m(/\bCustomer:\s*([^\n\r]+)/i)
  ||m(/\b((?:Demo\s)?[A-Z][a-z]+(?:\s[A-Z][a-z]+)?\s(?:Air|Airways|Airlines|Wings|Connect|Aviation))\b/)
  ||m(/\b(Lufthansa|British Airways|Emirates|Qatar Airways|LHA|BA)\b/i);
 const aircraftLocation=extractAircraftLocation(text);
 const id='([A-Z0-9]+(?:-[A-Z0-9]+)+)';
 const engine=n=>m(new RegExp(`\\bEngine\\s*${n}(?:\\s*Number|\\s*No\\.?|\\s*ID|\\s*serial(?: number)?)?\\s*:\\s*([A-Z0-9-]{4,24})\\b`,'i'))
  ||m(new RegExp(`\\b[Ee]ngine\\s*${n}\\s*(?:serial(?: number)?|number|no\\.?|ID|is)\\s*:?\\s*${id}`));
 return {
  caseId:'',
  source:/phone|telefon/i.test(activeTab)?'Phone Transcript':'Email',
  customer:normalizeCustomer(customer),
  aircraftId:m(/\b(?:Aircraft ID|Aircraft|Registration|Tail(?: number)?):\s*([A-Z0-9-]{4,12})\b/i)
   ||m(new RegExp(`\\b(?:[Aa]ircraft|[Rr]egistration|[Tt]ail(?: number)?|[Mm]aschine|[Ff]lugzeug|[Kk]ennzeichen)\\s+(?:is\\s+|ist\\s+)?${id}`))
   ||m(/\b([A-Z]-[A-Z]{4}|N[0-9][0-9A-Z]{2,5}|G-[A-Z]{4})\b/),
  aircraftLocation,
  eventTime:extractEventDateTime(text),
  requestedDepartureDate,
  ...engines(text,engine,id),
  problemNotes:extractProblemNotes(text),
  assistantSuggestions:'',
  priority:calculatePriority(requestedDepartureDate)
 };
}

/* ---------- Explainable priority suggestion ----------
   Combines engineering severity (from the report) with turnaround pressure
   (requested departure). The more urgent of the two wins. It is a suggestion:
   the reviewer can change the Priority field, which is then kept. */
let priorityManual=false;
const PRIORITY_NAMES=['Pending','1 - Most urgent','2 - Urgent','3 - Medium','4 - Low','5 - Lowest'];
const SEVERITY_RULES=[
 [/fire warning|engine fire|\bfire\b|feuer|brand/i,1,'fire warning reported'],
 [/flamed? ?-?out|loss of combustion/i,1,'flameout reported'],
 [/shut ?down|shut the engine down|abgeschaltet|\bIFSD\b/i,1,'in-flight shutdown reported'],
 [/surge|\bbangs?\b/i,2,'suspected compressor surge'],
 [/bird/i,2,'bird strike reported'],
 [/thrust loss|lost thrust|loss of thrust|rollback/i,2,'thrust loss reported'],
 [/oil[- ]pressure|vibrat|\bEGT\b|smoke|odou?r/i,3,'abnormal engine indication'],
];
// True if a sentence mentions the term without negating it ("no shutdown occurred").
function mentionsText(text,re){
 return String(text||'').split(/(?<=[.!?;])\s+|\n+/).some(s=>{
  const hit=s.match(re);if(!hit)return false;
  return !/\b(no|not|without|kein(e|en)?|nicht)\b[^,]{0,40}$/i.test(s.slice(0,hit.index));
 });
}
function suggestPriority(data){
 const text=`${data.problemNotes||''}\n${data.originalText||''}`;
 const reasons=[];let level=6;
 const rule=SEVERITY_RULES.find(([re])=>mentionsText(text,re));
 if(rule){
  let sev=rule[1];
  const onGround=/ground run|ground (check|test|inspection)|after landing|during taxi|on the ground/i.test(text)&&!/in flight|in-flight|cruise|climb|descent|takeoff|take-off|approach/i.test(text);
  if(onGround&&sev<3){sev=3;reasons.push(`severity ${sev}: ${rule[2]}, but on the ground`)}
  else reasons.push(`severity ${sev}: ${rule[2]}`);
  level=Math.min(level,sev);
 }
 const turnaround=calculatePriority(data.requestedDepartureDate);
 if(/^[1-5]/.test(turnaround)){
  const t=Number(turnaround[0]);level=Math.min(level,t);
  const days=Math.round((new Date(`${data.requestedDepartureDate.match(/\d{4}-\d{2}-\d{2}/)[0]}T00:00:00`)-new Date().setHours(0,0,0,0))/86400000);
  reasons.push(`turnaround ${t}: departure requested ${days<0?`${-days} day(s) ago`:days===0?'today':`in ${days} day(s)`}`);
 }else reasons.push('no requested departure date');
 return {priority:level<6?PRIORITY_NAMES[level]:'Pending',reasons};
}
function priorityNote(s){return `Priority suggestion: ${s.priority} — ${s.reasons.join('; ')}. Review and adjust if needed.`}

function engines(text,engine,id){
 let e1=engine(1),e2=engine(2);
 if(!e1&&!e2){
  const serial=(text.match(new RegExp(`\\b(?:[Tt]riebwerks?(?:nummer|seriennummer)?|[Ee]ngine (?:serial|number)|ESN)\\s*:?\\s*${id}`))||[])[1];
  if(serial){const pos=(text.match(/\b(?:engine|triebwerk)\s*([12])\b/i)||[])[1];if(pos==='2')e2=serial;else e1=serial;}
 }
 return {engine1:e1,engine2:e2};
}

function relativeDeparture(text){
 // Spoken requests: "back in service tomorrow", "brauchen es übermorgen wieder", "ready in 3 days"
 if(!/\b(?:back in service|in service|depart\w*|return to service|ready|fly again|need|wieder|brauchen|abflug|einsatzbereit)/i.test(text))return '';
 const day=new Date();
 if(/übermorgen|day after tomorrow/i.test(text))day.setDate(day.getDate()+2);
 else if(/\btomorrow\b|(?:^|[^ü\w])morgen\b/i.test(text))day.setDate(day.getDate()+1);
 else if(/\bin\s+(\d+)\s+(?:days?|tagen)\b/i.test(text))day.setDate(day.getDate()+Number(text.match(/\bin\s+(\d+)\s+(?:days?|tagen)\b/i)[1]));
 else if(!/\btoday\b|\bheute\b/i.test(text))return '';
 if(/\d{4}-\d{2}-\d{2}/.test(text)&&/(?:depart(?:ure)? again|requested departure|return to service)\D{0,40}\d{4}-\d{2}-\d{2}/i.test(text))return '';
 return day.toISOString().slice(0,10);
}

function extractRequestedDeparture(text){
 return relativeDeparture(text)||mDate(/\b(?:depart(?:ure)? again|next departure|requested departure|ready for departure|return to service)\D{0,40}(\d{4}-\d{2}-\d{2}(?:\s+at\s+\d{1,2}:\d{2}\s*UTC)?)\b/i,text)
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
 const german=(text.match(/\bnach\s+([A-ZÄÖÜ][\wäöüß-]+)\s+(?:ausgewichen|umgeleitet|gelandet|zurückgekehrt)/)||text.match(/\b(?:steht|befindet sich)\s+(?:\w+\s+){0,3}in\s+([A-ZÄÖÜ][\wäöüß-]+)/)||[])[1];
 if(german)return german;
 const labelled=(text.match(/\bAircraft location:\s*([^\n\r]+)/i)||[])[1];
 if(labelled)return labelled.trim();
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
 // Ignore header lines ("Customer: …", "Subject: …", dataset markers) so they are not merged into the notes.
 const body=text.split(/\r?\n/).filter(line=>!/^\s*(\[[^\]]+\]|(Subject|From|To|Date|Customer|Aircraft(?: ID| location)?|Registration|Tail(?: number)?|Engine\s*[12](?:\s*Number)?|Event time|Requested departure|Call transcript):)/i.test(line)).join(' ');
 const sentences=body.split(/(?<=[.!?])\s+/).filter(Boolean);
 const relevant=sentences.filter(s=>/shut ?down|\bIFSD\b|vibrat|\bEGT\b|\boil\b|fail|\bAOG\b|flame|surge|bird|smoke|odou?r|fire|thrust|abgeschaltet|ausgefallen|Vögel|Vogel|\bRauch|(?:^|\s)Öl|Schubverlust/i.test(s));
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
   if(input.dataset.caseField==='priority')priorityManual=true;
   if(['requestedDepartureDate','problemNotes'].includes(input.dataset.caseField)&&!priorityManual){
    currentCase.priority=suggestPriority(currentCase).priority;
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
 const suggestion=suggestPriority(data);
 const why=`<div class="priority-why"><b>Suggested priority: ${escapeHtml(suggestion.priority)}</b><span>${suggestion.reasons.map(escapeHtml).join(' · ')}</span>${data.priority&&data.priority!==suggestion.priority?`<em>Reviewer set ${escapeHtml(data.priority)}</em>`:''}</div>`;
 if(!data.requestedDepartureDate)alerts.push('Requested departure date missing - turnaround urgency cannot be calculated');
 alerts.push('Human review required before case submission');
 alerts.push('Saving requires Source and Problem / Notes. Other missing details can be added later.');
 document.getElementById('missing').innerHTML=why+alerts.map(alert=>`<div class="miss">⚠ ${escapeHtml(alert)}</div>`).join('');
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
 if(typeof renderDashboardExtras==='function')renderDashboardExtras(data);
}

function escapeHtml(value){
 return String(value).replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[character]));
}

function updateDashboardClock(){
 const now=new Date();
 const time=now.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
 const date=now.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'});
 document.querySelectorAll('.js-clock').forEach(clock=>clock.textContent=`${time}  ${date}`);
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
 currentCase=data;caseDirty=false;priorityManual=true; // keep the saved priority
 renderCase(data);renderAlerts(data);
 document.getElementById('originalText').value=data.originalText||'';
 document.getElementById('sourceText').value=data.originalText||'';
 document.getElementById('intake').classList.add('case-created');
 document.getElementById('toResponse').disabled=false;
 document.getElementById('toAnalysis').disabled=false;
 document.getElementById('saveStatus').textContent=data.caseId?`Loaded ${data.caseId}. Changes require Save Case.`:'New case. ID will be assigned when saving.';
 syncDashboard(data,data.originalText||'');
 show('intake');
}

document.getElementById('newCase').onclick=()=>{
 if(caseSaving||!canReplaceCase())return;
 const blank=Object.fromEntries(fields.map(field=>[field.key,'']));
 openCase({...blank,source:'Email',priority:'Pending',originalText:''});
 caseDirty=true;priorityManual=false;
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
  if(typeof onCaseSaved==='function')onCaseSaved(currentCase);
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
   const notes=document.createElement('p');const shortNotes=(record.problemNotes||'').replace('[SYNTHETIC DEMO] ','');notes.textContent=record.problemNotes.length>=160?shortNotes.replace(/\s+\S*$/,'')+' …':shortNotes;
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
   if(!record.deletedAt&&typeof openCaseInResponse==='function'){
    const respond=document.createElement('button');respond.textContent='Response';
    respond.onclick=()=>openCaseInResponse(record.caseId);
    actions.append(respond);
   }
   if(!record.deletedAt){
    const remove=document.createElement('button');remove.textContent='Move to trash';
    remove.onclick=async()=>{
     if(caseSaving)return;
     if(!window.confirm(`Move ${record.caseId} to trash? You can restore it later.`))return;
     if(currentCase?.caseId===record.caseId&&!canReplaceCase())return;
     remove.disabled=true;
     try{
      await caseRequest(`/${encodeURIComponent(record.caseId)}`,'DELETE',{revision:record.revision});
      if(currentCase?.caseId===record.caseId){currentCase=null;caseDirty=false;document.getElementById('fields').replaceChildren();document.getElementById('toResponse').disabled=true;document.getElementById('toAnalysis').disabled=true;document.getElementById('saveStatus').textContent='Case moved to trash.';}
      await loadCases();
      if(typeof onCaseSaved==='function')onCaseSaved(null);
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
