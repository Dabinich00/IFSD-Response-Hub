const views=document.querySelectorAll('.view');const nav=[...document.querySelectorAll('nav button')];
let currentCase=null;
let caseDirty=false;
let caseSaving=false;

function show(id){views.forEach(v=>v.classList.remove('active'));nav.forEach(b=>b.classList.remove('active'));document.getElementById(id).classList.add('active');nav.find(b=>b.dataset.view===id)?.classList.add('active')}
nav.forEach(b=>b.onclick=()=>{show(b.dataset.view);if(b.dataset.view==='cases')loadCases()});
document.querySelectorAll('.tabs button').forEach((b,index)=>{if(index===0)b.classList.add('active');b.onclick=()=>{document.querySelectorAll('.tabs button').forEach(x=>x.classList.remove('active'));b.classList.add('active')}});

const fields=[
 {key:'caseId',label:'Case ID',readonly:true},
 {key:'source',label:'Source',type:'source'},
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
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){setRecorderStatus('Recording is not supported in this browser.','error');return;}
  try{
   const stream=await navigator.mediaDevices.getUserMedia({audio:true});
   const preferredType=['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(type=>MediaRecorder.isTypeSupported(type));
   mediaRecorder=new MediaRecorder(stream,preferredType?{mimeType:preferredType}:undefined);audioChunks=[];
   mediaRecorder.ondataavailable=event=>{if(event.data.size)audioChunks.push(event.data)};
   mediaRecorder.onstop=()=>transcribeRecording(stream);
   mediaRecorder.start();recordingStartedAt=Date.now();updateRecordingTimer();recordingTimerId=setInterval(updateRecordingTimer,500);
   startRecordingButton.disabled=true;stopRecordingButton.disabled=false;setRecorderStatus('Recording','recording');
  }catch(error){setRecorderStatus(error.name==='NotAllowedError'?'Allow microphone access to record.':'Unable to start recording.','error');}
 };

 stopRecordingButton.onclick=()=>{
  if(mediaRecorder?.state==='recording'){mediaRecorder.stop();clearInterval(recordingTimerId);stopRecordingButton.disabled=true;setRecorderStatus('Processing recording...','working');}
 };
}

function setRecorderStatus(message,state='idle'){
 const status=document.getElementById('recorderStatus');if(!status)return;
 status.textContent=message;status.dataset.state=state;
 setButtonBusy(stopRecordingButton,state==='working','Processing...','Stop & transcribe');
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
  if(!response.ok)throw new Error(result.error||'Transkription fehlgeschlagen');
  const jobId=result.job_id;
  if(!jobId)throw new Error('Bitte Python-Server neu starten und Seite neu laden.');
  
  let failures=0;
  while(true){
   await new Promise(resolve=>setTimeout(resolve,1000));
   let poll;
   try{
    poll=await fetch(`/api/transcriptions/${jobId}`,{cache:'no-store',signal:AbortSignal.timeout(10000)});
    result=await poll.json();failures=0;
   }catch(error){
    if(++failures>=5)throw new Error('Verbindung zum Server verloren. Bitte Server prüfen.');
    setRecorderStatus('Processing recording...','working');continue;
   }
   if(!poll.ok||result.status==='error')throw new Error(result.error||'Transkription fehlgeschlagen');
   if(result.status==='done')break;
   setRecorderStatus('Processing recording...','working');
  }
  document.getElementById('sourceText').value=result.text;
  updateExtractionButton();
  setRecorderStatus('Recording ready.','success');
 }catch(error){console.error('Transcription failed:',error);setRecorderStatus(friendlyProcessingError(error,'recording'),'error');}
 finally{startRecordingButton.disabled=false;mediaRecorder=null;audioChunks=[];}
}

let extractionBusy=false;
let lastAppliedText=null;
let extractionViewVersion=0;
const extractionButton=document.getElementById('extract');
const extractionStatus=document.getElementById('extractionStatus');
const retryExtraction=document.getElementById('retryExtraction');
function normalizedSource(){return document.getElementById('sourceText').value.replace(/\r\n?/g,'\n').trim()}
function updateExtractionButton(){
 setButtonBusy(extractionButton,extractionBusy,'Processing...','Create Case');
 extractionButton.disabled=extractionBusy||caseSaving||!normalizedSource()||normalizedSource()===lastAppliedText;
}
document.getElementById('sourceText').addEventListener('input',()=>{retryExtraction.hidden=true;updateExtractionButton()});
async function extractionRequest(path,options={}){
 if(location.protocol==='file:')throw new Error('Open http://127.0.0.1:8000 after starting the Python server.');
 const response=await fetch(path,{...options,cache:'no-store',signal:AbortSignal.timeout(15000)});
 let result;
 try{result=await response.json()}catch{throw new Error('Unable to process the message. Please restart the application.')}
 if(!response.ok)throw new Error(result.error||'Analysis request failed.');
 return result;
}
async function analyzeText(retry=false){
 if(extractionBusy||caseSaving)return;
 const text=normalizedSource();
 if(!text||text===lastAppliedText)return;
 if(!canReplaceCase())return;
 const version=extractionViewVersion;
 const source=/phone|telefon/i.test(document.querySelector('.tabs button.active')?.textContent||'')?'Phone Transcript':'Email';
 extractionBusy=true;retryExtraction.hidden=true;updateExtractionButton();
 document.getElementById('toResponse').disabled=true;
 document.querySelectorAll('[data-case-field]').forEach(input=>input.disabled=true);
 extractionStatus.textContent='Processing...';
 
 try{
  const job=await extractionRequest('/api/extractions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,retry})});
  let result;
  for(;;){
   result=await extractionRequest(`/api/extractions/${job.job_id}`);
   if(result.status==='error'){retryExtraction.hidden=false;throw new Error(result.error)}
   if(result.status==='done')break;
   extractionStatus.textContent='Processing...';
   await new Promise(resolve=>setTimeout(resolve,1000));
  }
  if(version!==extractionViewVersion||normalizedSource()!==text){extractionStatus.textContent='The message changed. Select Create Case to process the updated text.';return;}
  currentCase={...result.fields,caseId:'',source,priority:calculatePriority(result.fields.requestedDepartureDate),originalText:text};
  lastAppliedText=text;caseDirty=true;
  renderCase(currentCase);renderAlerts(currentCase);
  document.getElementById('originalText').value=text;
  document.getElementById('intake').classList.add('case-created');
  syncDashboard(currentCase,text);
  document.getElementById('toResponse').disabled=false;
  document.getElementById('saveStatus').textContent='';
  extractionStatus.textContent='Case ready for review.';
 }catch(error){console.error('Case analysis failed:',error);extractionStatus.textContent=friendlyProcessingError(error,'message');}
 finally{
  extractionBusy=false;updateExtractionButton();
  document.getElementById('toResponse').disabled=!currentCase;
  document.querySelectorAll('[data-case-field]').forEach(input=>input.disabled=false);
 }
}
extractionButton.onclick=()=>analyzeText(false);
retryExtraction.onclick=()=>{if(window.confirm('Try processing this message again?'))analyzeText(true)};
updateExtractionButton();

function parseCaseDate(value){
 if(!value)return null;
 const text=value.trim();
 let match=text.match(/^(\d{4})-(\d{2})-(\d{2})(.*)$/);
 let year,month,day,suffix;
 if(match){[,year,month,day,suffix]=match}
 else{
  match=text.match(/^(\d{1,2})\s*[.,/]\s*(\d{1,2})\s*[.,/]\s*(\d{4}|\d{2})(.*)$/);
  if(!match)return null;
  [,day,month,year,suffix]=match;
  if(year.length===2)year='20'+year;
 }
 year=Number(year);month=Number(month)-1;day=Number(day);
 const date=new Date(year,month,day);
 if(date.getFullYear()!==year||date.getMonth()!==month||date.getDate()!==day)return null;
 suffix=suffix.trim().replace(/^T/,'').replace(/^at /i,'');
 if(suffix&&!/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?(?:\s*(?:Z|[A-Z]{2,5}|[+-](?:[01]\d|2[0-3]):?[0-5]\d))?$/.test(suffix))return null;
 return {date,text:`${String(day).padStart(2,'0')}.${String(month+1).padStart(2,'0')}.${String(year).padStart(4,'0')}${suffix?' '+suffix:''}`};
}

function calculatePriority(requestedDepartureDate,referenceDate=new Date()){
 const parsed=parseCaseDate(requestedDepartureDate);
 if(!parsed)return 'Pending';
 const requested=parsed.date;
 // Calendar months from today; clamp month-end dates (Jan 31 -> Feb 28/29).
 const levels=['1 - Most urgent','2 - Urgent','3 - Medium','4 - Low'];
 for(let months=1;months<=4;months++){
  const boundary=new Date(referenceDate.getFullYear(),referenceDate.getMonth()+months,1);
  const lastDay=new Date(boundary.getFullYear(),boundary.getMonth()+1,0).getDate();
  boundary.setDate(Math.min(referenceDate.getDate(),lastDay));
  if(requested<=boundary)return levels[months-1];
 }
 return '5 - Lowest';
}

function renderCase(data){
 for(const key of ['eventTime','requestedDepartureDate']){
  const parsed=parseCaseDate(data[key]);
  if(parsed)data[key]=parsed.text;
 }
 document.getElementById('fields').innerHTML=fields.map(field=>fieldMarkup(field,data[field.key])).join('');
 document.querySelectorAll('[data-case-field]').forEach(input=>{
  input.oninput=()=>{
   caseDirty=true;
   input.removeAttribute('aria-invalid');
   document.getElementById('saveStatus').textContent='';
   currentCase[input.dataset.caseField]=input.value;
   if(input.dataset.caseField==='requestedDepartureDate'){
    currentCase.priority=calculatePriority(input.value);
    document.querySelector('[data-case-field="priority"]').value=currentCase.priority;
   }
   renderAlerts(currentCase,document.getElementById('originalText').value);
   syncDashboard(currentCase,document.getElementById('originalText').value);
  };
  if(['eventTime','requestedDepartureDate'].includes(input.dataset.caseField)){
   input.placeholder='DD.MM.YYYY (HH:MM timezone)';
   input.onblur=()=>{
    const parsed=parseCaseDate(input.value);
    if(parsed){input.value=parsed.text;currentCase[input.dataset.caseField]=parsed.text;}
   };
  }
 });
}

function fieldMarkup(field,value){
 const safeValue=escapeHtml(value||'');
 if(field.type==='source')return `<div class="field"><small>Source</small><select data-case-field="source">${['Email','Phone Transcript'].map(source=>`<option${source===value?' selected':''}>${source}</option>`).join('')}</select></div>`;
 if(field.type==='priority'){
  const options=['Pending',...priorityLevels.filter(Boolean)].map(level=>`<option value="${escapeHtml(level)}"${level===(value||'Pending')?' selected':''}>${escapeHtml(level)}</option>`).join('');
  return `<div class="field"><small>${field.label}${field.required?' *':''}</small><select data-case-field="${field.key}">${options}</select></div>`;
 }
 if(field.type==='textarea')return `<div class="field field-wide"><small>${field.label}${field.required?' *':''}</small><textarea data-case-field="${field.key}">${safeValue}</textarea></div>`;
 return `<div class="field"><small>${field.label}${field.required?' *':''}</small><input data-case-field="${field.key}" value="${safeValue}" ${field.key==='caseId'?'placeholder="Assigned on first save"':''} ${field.readonly?'readonly':''}></div>`;
}

function renderAlerts(data){
 const alerts=[];
 fields.filter(field=>field.expected).forEach(field=>{
  if(!data[field.key]||data[field.key]==='Pending')alerts.push(`${field.label} missing`);
 });
 if(!data.requestedDepartureDate)alerts.push('Requested departure date missing - priority cannot be calculated');
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
 extractionViewVersion++;lastAppliedText=null;
 currentCase=data;caseDirty=false;
 renderCase(data);renderAlerts(data);
 document.getElementById('originalText').value=data.originalText||'';
 document.getElementById('sourceText').value=data.originalText||'';
 document.getElementById('intake').classList.add('case-created');
 document.getElementById('toResponse').disabled=false;
 document.getElementById('saveStatus').textContent='';
 syncDashboard(data,data.originalText||'');
 show('intake');
 updateExtractionButton();
}

document.getElementById('newCase').onclick=()=>{
 if(extractionBusy||caseSaving||!canReplaceCase())return;
 const blank=Object.fromEntries(fields.map(field=>[field.key,'']));
 openCase({...blank,source:'Email',priority:'Pending',originalText:''});
 caseDirty=true;
};

document.getElementById('toResponse').onclick=async()=>{
 if(!currentCase||caseSaving||extractionBusy)return;
 const status=document.getElementById('saveStatus');
 if(!currentCase.problemNotes?.trim()){
  status.textContent='Please fill in Problem / Notes.';
  const input=document.querySelector('[data-case-field="problemNotes"]');
  input.setAttribute('aria-invalid','true');input.focus();return;
 }
 caseSaving=true;
 document.getElementById('toResponse').disabled=true;
 document.getElementById('extract').disabled=true;
 document.querySelectorAll('[data-case-field]').forEach(input=>input.disabled=true);
 setButtonBusy(document.getElementById('toResponse'),true,'Saving...','Save Case');
 status.textContent='';
 try{
  const id=currentCase.caseId;
  currentCase=await caseRequest(id?`/${encodeURIComponent(id)}`:'',id?'PUT':'POST',currentCase);
  caseDirty=false;
  renderCase(currentCase);renderAlerts(currentCase);
  syncDashboard(currentCase,currentCase.originalText||'');
  status.textContent=`Saved ${currentCase.caseId}`;
 }catch(error){console.error('Save failed:',error);status.textContent=/date/i.test(error.message)?'Please enter a valid date as DD.MM.YYYY, or leave it empty.':/another window|changed/i.test(error.message)?'This case has changed. Reopen it before saving.':'Unable to confirm saving. Check Saved Cases before trying again.'}
 finally{
  caseSaving=false;
  setButtonBusy(document.getElementById('toResponse'),false,'Saving...','Save Case');
  document.getElementById('toResponse').disabled=false;
  updateExtractionButton();
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
    if(extractionBusy||caseSaving)return;
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
     if(extractionBusy||caseSaving)return;
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


function setButtonBusy(button,busy,label,normalLabel){
 if(!button)return;
 button.classList.toggle('is-loading',busy);
 button.setAttribute('aria-busy',String(busy));
 button.textContent=busy?label:normalLabel;
}

function friendlyProcessingError(error,kind){
 const message=String(error.message||'');
 if(/no speech|keine sprache/i.test(message))return 'No speech detected. Please record again.';
 if(/sign in|login/i.test(message))return 'Text processing is unavailable. Please try again later.';
 if(/limit|quota/i.test(message))return 'Processing is temporarily unavailable. Please try again later.';
 if(/timed out|timeout|abort/i.test(message))return 'Processing took too long. Please try again.';
 if(/fetch|connection|server|verbindung|erreichbar|Python/i.test(message))return 'Unable to connect. Check that the application is running.';
 return kind==='recording'?'Unable to process the recording. Please try again.':'Unable to process the message. Please try again.';
}
