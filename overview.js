/* IFSD Response Hub — Overview map, dashboard enrichment, response workspace
   and expert decision. Loaded after app.js and uses its globals
   (currentCase, caseDirty, fields, show, openCase, caseRequest, escapeHtml).

   Cases come from the local database (/api/cases). Teams, parts warehouses,
   ETAs, weather and EHM indicators are DEMO values derived deterministically
   from the case so every screen shows the same picture. Nothing here makes a
   decision: the expert records it in the decision panel. */

/* ---------- Reference data (demo) ---------- */
const AIRPORTS = {
 SNN:['Shannon',52.70,-8.92], DUB:['Dublin',53.43,-6.27], LHR:['London Heathrow',51.47,-0.45], LGW:['London Gatwick',51.15,-0.18],
 MAN:['Manchester',53.35,-2.28], EDI:['Edinburgh',55.95,-3.37], FRA:['Frankfurt',50.04,8.56], BER:['Berlin',52.37,13.50],
 MUC:['Munich',48.35,11.79], HAM:['Hamburg',53.63,9.99], DUS:['Düsseldorf',51.29,6.77], MAD:['Madrid',40.49,-3.57],
 LIS:['Lisbon',38.77,-9.13], CDG:['Paris CDG',49.01,2.55], AMS:['Amsterdam',52.31,4.76], BRU:['Brussels',50.90,4.48],
 CPH:['Copenhagen',55.62,12.65], OSL:['Oslo',60.19,11.10], ARN:['Stockholm',59.65,17.92], HEL:['Helsinki',60.32,24.95],
 WAW:['Warsaw',52.17,20.97], PRG:['Prague',50.10,14.26], VIE:['Vienna',48.11,16.57], ZRH:['Zurich',47.46,8.55],
 FCO:['Rome',41.80,12.25], IST:['Istanbul',41.26,28.74], KEF:['Keflavík',63.98,-22.60], YQX:['Gander',48.94,-54.57],
 BOS:['Boston',42.36,-71.01], JFK:['New York JFK',40.64,-73.78], DXB:['Dubai',25.25,55.36]
};
const PLACE_NAMES = {
 shannon:'SNN', dublin:'DUB', heathrow:'LHR', gatwick:'LGW', london:'LHR', manchester:'MAN', edinburgh:'EDI',
 frankfurt:'FRA', berlin:'BER', munich:'MUC', 'münchen':'MUC', hamburg:'HAM', 'düsseldorf':'DUS', dusseldorf:'DUS',
 madrid:'MAD', lisbon:'LIS', lissabon:'LIS', paris:'CDG', amsterdam:'AMS', brussels:'BRU', 'brüssel':'BRU',
 copenhagen:'CPH', kopenhagen:'CPH', oslo:'OSL', stockholm:'ARN', helsinki:'HEL', warsaw:'WAW', warschau:'WAW',
 prague:'PRG', prag:'PRG', vienna:'VIE', wien:'VIE', zurich:'ZRH', 'zürich':'ZRH', rome:'FCO', rom:'FCO',
 istanbul:'IST', keflavik:'KEF', 'keflavík':'KEF', reykjavik:'KEF', 'reykjavík':'KEF', gander:'YQX',
 boston:'BOS', 'new york':'JFK', dubai:'DXB'
};
const HUBS = [ // demo field-service hubs
 {name:'Demo Field Service Hub Berlin', team:'Team North-East · 3 engineers', lat:52.30, lng:13.40},
 {name:'Demo Field Service Hub London', team:'Team UK · 4 engineers', lat:51.50, lng:-0.60},
 {name:'Demo Field Service Hub Madrid', team:'Team Iberia · 2 engineers', lat:40.40, lng:-3.70},
 {name:'Demo Field Service Hub Copenhagen', team:'Team Nordic · 2 engineers', lat:55.65, lng:12.50},
 {name:'Demo Field Service Hub Dubai', team:'Team Middle East · 3 engineers', lat:25.20, lng:55.30},
 {name:'Demo Field Service Hub Boston', team:'Team Americas · 3 engineers', lat:42.40, lng:-71.10}
];
const WAREHOUSES = [ // demo spare-part stores
 {name:'Demo Parts Warehouse Frankfurt', lat:50.10, lng:8.70},
 {name:'Demo Parts Warehouse London', lat:51.40, lng:-0.30},
 {name:'Demo Parts Warehouse Madrid', lat:40.45, lng:-3.55},
 {name:'Demo Parts Warehouse Dubai', lat:25.30, lng:55.45},
 {name:'Demo Parts Warehouse Boston', lat:42.30, lng:-71.00}
];
// Symptom families detected from the report text. Actions/parts are demo suggestions, not engineering advice.
const SYMPTOMS = [
 {key:'vibration', label:'Vibration', re:/vibrat/i, action:'Borescope inspection & vibration survey', parts:['Fan blade set','Vibration sensor kit']},
 {key:'oil-pressure', label:'Oil pressure', re:/oil[- ]pressure|öldruck/i, action:'Oil system diagnostics', parts:['Oil pressure transmitter','Oil pump']},
 {key:'oil-consumption', label:'Oil consumption / leak', re:/oil (?:quantity|loss|leak|top-up|consumption)|ölverlust|ölstand/i, action:'Leak check & oil consumption trend', parts:['Oil seal kit','Oil filter']},
 {key:'egt', label:'High EGT', re:/\bEGT\b|exhaust gas temp/i, action:'EGT trend review & hot-section borescope', parts:['Thermocouple harness','HPT blade set']},
 {key:'surge', label:'Compressor surge', re:/surge|\bbangs?\b|thrust oscillat/i, action:'Compressor inspection', parts:['Variable stator vane kit','Bleed valve']},
 {key:'bird', label:'Bird strike', re:/bird|vogel/i, action:'Bird-strike inspection (fan & core)', parts:['Fan blade set','Acoustic liner panel']},
 {key:'fuel', label:'Fuel system', re:/fuel|kraftstoff|treibstoff/i, action:'Fuel system check', parts:['Fuel metering unit','Fuel filter']},
 {key:'indication', label:'Indication / sensor', re:/indication|sensor|display/i, action:'Sensor & indication troubleshooting', parts:['EGT sensor','Harness kit']},
 {key:'smoke', label:'Smoke / odour / fire warning', re:/smoke|odou?r|smell|fire|rauch|feuer/i, action:'Contamination & fire-zone inspection', parts:['Bearing seal kit','Fire detector element']},
 {key:'flameout', label:'Flameout / relight', re:/flamed? ?-?out|relight|restart|loss of combustion/i, action:'Combustion & ignition check', parts:['Igniter plug set','Fuel nozzle']}
];
const EHM_SIGNALS = [['EGT',/\bEGT\b|exhaust gas temp/i],['Vibration',/vibrat/i],['Oil pressure',/oil[- ]pressure|öldruck/i],['Oil quantity',/oil (?:quantity|loss|leak|top-up|consumption)|ölstand/i],['Fuel flow',/fuel[- ]flow/i]];
const PRIORITY_COLORS = {0:'#9A9A9A',1:'#D0302F',2:'#DE9E00',3:'#2E8B57',4:'#2F7FB0',5:'#2F7FB0'};
const DECISION_LABELS = {'approve-plan':'Response plan approved','request-information':'Information requested','escalate-engineering':'Escalated to engineering','monitor-only':'Monitor only'};
const hasLeaflet = typeof L !== 'undefined';

let allCases = [];          // active cases from /api/cases (list view)
let overviewLoaded = false;
let dashMap, respMap, respLayer;
const mapLayers = {};

/* ---------- Derivations ---------- */
function locate(text){
 const value=String(text||'');
 const code=(value.match(/\(([A-Z]{3})\)/)||value.match(/\b([A-Z]{3})\b/)||[])[1];
 if(code&&AIRPORTS[code])return airport(code);
 const lower=value.toLowerCase();
 const name=Object.keys(PLACE_NAMES).find(n=>lower.includes(n));
 return name?airport(PLACE_NAMES[name]):null;
}
function airport(code){const [name,lat,lng]=AIRPORTS[code];return {iata:code,name,lat,lng}}
function priorityLevel(p){return Number((String(p||'').match(/^([1-5])/)||[])[1]||0)}
// A term counts only in a sentence that does not negate it ("no shutdown occurred",
// "with no reported oil-pressure change", "not an in-flight shutdown").
function mentions(c,re){return mentionsText(`${c.problemNotes||''}.\n${c.originalText||''}`,re)} // mentionsText: app.js
function symptomsOf(c){return SYMPTOMS.filter(s=>mentions(c,s.re))}
function isShutdown(c){return mentions(c,/shut ?down|shut the engine down|abgeschaltet|\bIFSD\b/i)}
function km(a,b){
 const r=Math.PI/180,dLat=(b.lat-a.lat)*r,dLng=(b.lng-a.lng)*r;
 const h=Math.sin(dLat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dLng/2)**2;
 return 6371*2*Math.asin(Math.sqrt(h));
}
function nearest(list,point){return list.map(x=>({...x,distance:km(point,x)})).sort((a,b)=>a.distance-b.distance)[0]}
function duration(hours){const h=Math.floor(hours),m=Math.round((hours-h)*60/5)*5;return h?`${h} h ${String(m).padStart(2,'0')} min`:`${m} min`}
function demoWeather(loc){
 const options=['Clear · wind 8 kt','Rain showers · wind 19 kt','Low cloud · wind 11 kt','Gusty crosswind 27 kt'];
 const seed=[...(loc?.iata||'')].reduce((s,ch)=>s+ch.charCodeAt(0),0);
 return options[seed%options.length];
}
function missingFieldsOf(c){
 return fields.filter(f=>(f.required||f.expected)&&(!c[f.key]||c[f.key]==='Pending')).map(f=>f.label);
}
function completenessOf(c){
 const relevant=fields.filter(f=>f.required||f.expected);
 return Math.round((relevant.length-missingFieldsOf(c).length)/relevant.length*100);
}
function resourcesFor(c){
 const loc=locate(c.aircraftLocation);
 if(!loc)return [];
 const hub=nearest(HUBS,loc), store=nearest(WAREHOUSES,loc);
 const hubHours=hub.distance<60?hub.distance/70+0.5:hub.distance/700+2.5;
 const partHours=store.distance<60?store.distance/60+1.5:store.distance/600+3;
 const engineType=(c.engine1||c.engine2)?'assigned engine':'engine type';
 return [
  {id:'partner',type:'team',name:`Demo Service Partner ${loc.name}`,detail:'On-site line maintenance at the aircraft location',eta:'35 min',lat:loc.lat+0.08,lng:loc.lng+0.12},
  {id:'hub',type:'team',name:hub.name,detail:`${hub.team} · ${Math.round(hub.distance)} km`,eta:duration(hubHours),lat:hub.lat,lng:hub.lng},
  {id:'specialist',type:'specialist',name:'Engine specialist (remote)',detail:`Remote support for the ${engineType}`,eta:'immediately',lat:null,lng:null},
  {id:'parts',type:'part',name:store.name,detail:`${(symptomsOf(c)[0]?.parts||['Generic inspection kit']).join(', ')} · ${Math.round(store.distance)} km`,eta:duration(partHours),lat:store.lat,lng:store.lng}
 ];
}
function similarCases(c){
 const mine=new Set(symptomsOf(c).map(s=>s.key));
 const engines=new Set([c.engine1,c.engine2].filter(Boolean));
 return allCases.filter(o=>o.caseId&&o.caseId!==c.caseId).map(o=>{
  const theirs=new Set(symptomsOf(o).map(s=>s.key));
  const shared=[...mine].filter(k=>theirs.has(k)).length, union=new Set([...mine,...theirs]).size;
  let score=union?0.55*shared/union:0;const why=[];
  if(shared)why.push(symptomsOf(o).filter(s=>mine.has(s.key)).map(s=>s.label).join(', '));
  if(c.aircraftId&&o.aircraftId===c.aircraftId){score+=0.2;why.push('same aircraft')}
  if([o.engine1,o.engine2].some(e=>e&&engines.has(e))){score+=0.2;why.push('same engine')}
  if(c.aircraftLocation&&o.aircraftLocation===c.aircraftLocation)score+=0.05;
  return {record:o,score:Math.min(score,0.99),why};
 }).filter(x=>x.score>=0.2).sort((a,b)=>b.score-a.score).slice(0,3);
}

/* ---------- Leaflet helpers ---------- */
// Online: OpenStreetMap tiles. Offline (tiles fail to load): bundled Natural Earth land outlines.
let landData=null;
async function landGeoJson(){
 if(!landData)landData=fetch('vendor/world-land-110m.geojson').then(r=>{if(!r.ok)throw new Error(r.status);return r.json()});
 return landData;
}
function baseMap(id,view,zoom){
 const map=L.map(id,{worldCopyJump:true,minZoom:1}).setView(view,zoom);
 const tiles=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:12}).addTo(map);
 let offline=false;
 const goOffline=async()=>{
  if(offline)return;offline=true;
  map.removeLayer(tiles);
  map.getContainer().classList.add('offline-map');
  try{
   const land=await landGeoJson();
   L.geoJSON(land,{interactive:false,style:{color:'#C9CFD4',weight:.7,fillColor:'#FAFAFA',fillOpacity:1}}).addTo(map).bringToBack();
   map.attributionControl.addAttribution('Offline map · Natural Earth');
  }catch{map.attributionControl.addAttribution('Offline – map background unavailable')}
 };
 let errors=0,loaded=0;
 tiles.on('tileload',()=>loaded++);
 tiles.on('tileerror',()=>{if(++errors>=3&&loaded===0)goOffline()});
 if(navigator.onLine===false)goOffline();
 window.addEventListener('offline',goOffline);
 return map;
}
function shapeIcon(kind){return L.divIcon({className:'',iconSize:[16,16],iconAnchor:[8,8],html:`<i class="mk mk-${kind}"></i>`})}
function mapUnavailable(id){
 const el=document.getElementById(id);
 if(el)el.innerHTML='<p class="map-offline">Map unavailable — the map library or tiles need an internet connection. All other functions keep working.</p>';
}

/* ---------- Overview ---------- */
function initOverviewMap(){
 if(!hasLeaflet){mapUnavailable('dashMap');return}
 dashMap=baseMap('dashMap',[46,-4],3);
 ['case','team','part'].forEach(k=>{mapLayers[k]=L.layerGroup().addTo(dashMap)});
 HUBS.forEach(h=>L.marker([h.lat,h.lng],{icon:shapeIcon('team')}).bindPopup(`<b>${escapeHtml(h.name)}</b><br>${escapeHtml(h.team)}<br><small>Demo resource</small>`).addTo(mapLayers.team));
 WAREHOUSES.forEach(w=>L.marker([w.lat,w.lng],{icon:shapeIcon('part')}).bindPopup(`<b>${escapeHtml(w.name)}</b><br><small>Demo resource</small>`).addTo(mapLayers.part));
 document.querySelectorAll('[data-layer]').forEach(toggle=>toggle.addEventListener('change',()=>{
  toggle.dataset.layer.split(',').forEach(layer=>{
   if(layer==='weather'){document.querySelector('.map-weather').classList.toggle('on',toggle.checked);return}
   if(toggle.checked)mapLayers[layer].addTo(dashMap);else dashMap.removeLayer(mapLayers[layer]);
  });
 }));
}
function renderOverviewMarkers(){
 if(!dashMap)return;
 mapLayers.case.clearLayers();
 const perLocation={};
 allCases.forEach(c=>{
  const loc=locate(c.aircraftLocation);if(!loc)return;
  const n=perLocation[loc.iata]=(perLocation[loc.iata]||0)+1;
  // Spread several cases at the same airport on a small ring so each stays clickable.
  const angle=n*2.4, radius=n===1?0:0.35+0.12*Math.floor(n/6);
  const level=priorityLevel(c.priority);
  const marker=L.circleMarker([loc.lat+radius*Math.sin(angle),loc.lng+radius*1.5*Math.cos(angle)],{
   radius:level===1?9:7,color:c.decision?'#ffffff':'#262626',weight:c.decision?2.5:2,fillColor:PRIORITY_COLORS[level],fillOpacity:1
  });
  marker.bindPopup(`<div class="map-pop"><b>${escapeHtml(c.caseId)}</b>
   <span>${escapeHtml(c.customer||'Customer open')} · ${escapeHtml(c.aircraftId||'Aircraft open')}</span>
   <span>${escapeHtml(loc.name)} (${loc.iata}) · ${escapeHtml(c.priority||'Pending')}</span>
   <span>${escapeHtml((c.problemNotes||'').replace('[SYNTHETIC DEMO] ','').slice(0,90))}…</span>
   <span>Decision: ${escapeHtml(DECISION_LABELS[c.decision]||'open')}</span>
   <button type="button" class="popup-open" data-response="${escapeHtml(c.caseId)}">Response &amp; resources →</button>
   <button type="button" class="popup-open alt" data-dashboard="${escapeHtml(c.caseId)}">Incident dashboard</button></div>`);
  marker.on('popupopen',e=>{
   const el=e.popup.getElement();
   el.querySelector('[data-response]').onclick=()=>openCaseInResponse(c.caseId);
   el.querySelector('[data-dashboard]').onclick=()=>openCaseIn('dashboard',c.caseId);
  });
  marker.addTo(mapLayers.case);
 });
}
function renderOverviewStats(){
 const counts={1:0,2:0,3:0,4:0,5:0,0:0};
 allCases.forEach(c=>counts[priorityLevel(c.priority)]++);
 const open=allCases.filter(c=>!c.decision);
 document.getElementById('statActive').textContent=allCases.length;
 document.getElementById('statOpen').textContent=open.length;
 document.getElementById('priorityList').innerHTML=[1,2,3,4,5,0].map(p=>
  `<li><i class="dot p${p===5?4:p}"></i><b>${p||'–'}</b><em>${counts[p]} ${p?'':'pending '}case${counts[p]===1?'':'s'}</em></li>`).join('');
 const urgent=open.filter(c=>priorityLevel(c.priority)===1);
 const noLocation=allCases.filter(c=>!locate(c.aircraftLocation)).length;
 const incomplete=allCases.filter(c=>missingFieldsOf(c).length>0).length;
 const family={};allCases.forEach(c=>symptomsOf(c).forEach(s=>family[s.label]=(family[s.label]||0)+1));
 const top=Object.entries(family).sort((a,b)=>b[1]-a[1])[0];
 const list=urgent.slice(0,3).map(c=>`<a href="#" data-case="${escapeHtml(c.caseId)}">${escapeHtml(c.caseId.slice(-6))}</a>`).join(', ');
 document.getElementById('recoList').innerHTML=`<span>Recommendations</span>
  <ul class="reco"><li>${urgent.length} priority-1 case${urgent.length===1?'':'s'} without expert decision${urgent.length?`: ${list}${urgent.length>3?' …':''}`:''}</li>
  <li>${incomplete} case${incomplete===1?'':'s'} with missing intake information${noLocation?`, ${noLocation} without location`:''}</li>
  ${top?`<li>Most frequent symptom: ${escapeHtml(top[0])} in ${top[1]} cases. Check for a fleet pattern.</li>`:''}</ul>`;
 document.querySelectorAll('#recoList [data-case]').forEach(a=>a.onclick=e=>{e.preventDefault();openCaseInResponse(a.dataset.case)});
}
async function loadOverview(){
 const empty=document.getElementById('overviewEmpty');
 try{
  allCases=await caseRequest('?deleted=0');
  overviewLoaded=true;
  empty.hidden=allCases.length>0;
  empty.innerHTML='No saved cases yet. Create one in <b>Intake</b> or load the 50 synthetic demo cases with <code>python3 seed_demo_cases.py</code>.';
 }catch(error){
  allCases=[];
  empty.hidden=false;
  empty.textContent=error.message;
 }
 renderOverviewMarkers();renderOverviewStats();
 if(dashMap)setTimeout(()=>dashMap.invalidateSize(),60);
}

/* ---------- Opening cases from map / list ---------- */
async function openCaseIn(view,caseId){
 if(caseSaving||(caseDirty&&currentCase?.caseId!==caseId&&!window.confirm('Discard unsaved changes to the current case?')))return;
 try{
  const data=await caseRequest(`/${encodeURIComponent(caseId)}`);
  openCase(data);         // fills intake + dashboard (from app.js)
  show(view);
 }catch(error){alert(error.message)}
}
function openCaseInResponse(caseId){return openCaseIn('response',caseId)}

/* ---------- Incident dashboard enrichment ---------- */
function renderDashboardExtras(c){
 const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v};
 const loc=locate(c.aircraftLocation), symptoms=symptomsOf(c), res=resourcesFor(c);
 const index=allCases.findIndex(o=>o.caseId===c.caseId);
 set('dashboardCounter',index>=0?String(index+1).padStart(3,'0'):'new');
 const lvl=priorityLevel(c.priority),pill=document.getElementById('dashboardLevel');pill.dataset.level=lvl;pill.textContent=lvl?`P${lvl}`:'–';
 const notes=(c.problemNotes||'').replace('[SYNTHETIC DEMO] ','');
 set('dashboardNotes',notes?(notes.length>170?`${notes.slice(0,167)}…`:notes):'No problem description yet.');
 if(symptoms.length||isShutdown(c))set('dashboardProblem',`${isShutdown(c)?'IFSD · ':''}${symptoms[0]?.label||'Engine shutdown'}`);
 set('dashboardTrip',loc?`${loc.name} (${loc.iata})`:(c.aircraftLocation||'Location open'));
 set('dashboardAction',symptoms[0]?.action||(isShutdown(c)?'Shutdown assessment':'Initial assessment'));
 set('dashboardField',res.find(r=>r.id==='hub')?.name.replace('Demo Field Service Hub ','Team ')||'Assign after location is known');
 document.getElementById('dashboardParts').innerHTML=(symptoms[0]?.parts||['To be determined']).map(escapeHtml).join('<br>');
 set('dashboardSymptom',symptoms.length?symptoms.length:'!');
 set('wxLocation',loc?.iata||'—');set('wxText',loc?demoWeather(loc):'Location open');
 set('apAircraft',c.aircraftId||'Aircraft open');set('apLocation',loc?.iata||'—');
}
document.getElementById('dashboardHistory').onclick=()=>show('response');

/* ---------- Response workspace ---------- */
function ensureRespMap(){
 if(respMap||!hasLeaflet)return;
 respMap=baseMap('respMap',[50,-5],4);
 respLayer=L.layerGroup().addTo(respMap);
}
function renderResponse(){
 const c=currentCase;
 const title=document.getElementById('respTitle'), meta=document.getElementById('respMeta'), pr=document.getElementById('respPriority');
 document.getElementById('decisionPanel').hidden=!c;
 if(!c){document.getElementById('respPriorityWhy').textContent='';pr.dataset.level='';title.textContent='No case selected';meta.textContent='Create a case in Intake or pick a marker on the Overview map.';pr.textContent='–';return}
 const loc=locate(c.aircraftLocation), level=priorityLevel(c.priority), symptoms=symptomsOf(c), missing=missingFieldsOf(c), res=resourcesFor(c);
 title.textContent=`${c.caseId||'Unsaved case'} · ${c.customer||'Customer open'}`;
 meta.textContent=[c.aircraftId||'Aircraft open',[c.engine1,c.engine2].filter(Boolean).join(' / ')||'Engine numbers open',
  loc?`on ground at ${loc.name} (${loc.iata})`:(c.aircraftLocation||'location open'),c.eventTime||'event time open'].join(' · ');
 pr.textContent=level?`P${level} ${c.priority.replace(/^\d\s*-\s*/,'')}`:'Priority pending';
 pr.dataset.level=level;
 const suggestion=suggestPriority(c); // app.js
 document.getElementById('respPriorityWhy').textContent=`System suggestion: ${suggestion.priority} — ${suggestion.reasons.join(' · ')}`+
  (c.priority&&c.priority!==suggestion.priority?` · recorded priority differs: ${c.priority}`:'');

 document.getElementById('respEhm').innerHTML=EHM_SIGNALS.map(([name,re])=>mentions(c,re)
  ?`<p>${name} <span class="red">reported abnormal</span></p>`:`<p>${name} <span class="muted">no report</span></p>`).join('')+
  `<p class="hint">${isShutdown(c)?'Shutdown reported. ':''}Derived from the report text. A live EHM feed is not connected in this prototype.</p>`;

 document.getElementById('respCompleteness').textContent=`${completenessOf(c)}%`;
 document.getElementById('respMissing').innerHTML=missing.length?missing.map(m=>`<p>⚠ ${escapeHtml(m)} missing</p>`).join(''):'<p>All intake fields present ✓</p>';

 const similar=similarCases(c);
 document.getElementById('respSimilar').innerHTML=similar.length?similar.map(s=>
  `<p><a href="#" data-case="${escapeHtml(s.record.caseId)}">${escapeHtml(s.record.caseId)}</a> · ${Math.round(s.score*100)}%<br><small>${escapeHtml(s.why.join(' · '))}</small></p>`).join('')
  :`<p>${allCases.length?'No similar saved case found.':'No saved cases to compare yet.'}</p>`;
 document.querySelectorAll('#respSimilar [data-case]').forEach(a=>a.onclick=e=>{e.preventDefault();openCaseInResponse(a.dataset.case)});

 const assigned=new Set((c.assignedResources||'').split(';').map(s=>s.trim()).filter(Boolean));
 document.getElementById('respResources').innerHTML=res.length?res.map(r=>
  `<label class="resource"><input type="checkbox" value="${escapeHtml(r.name)}"${assigned.has(r.name)?' checked':''}><span><b>${escapeHtml(r.name)}</b><br>${escapeHtml(r.detail)} · ETA ${escapeHtml(r.eta)}</span></label>`).join('')
  :'<p>⚠ Aircraft location unknown — resources can be suggested once the location is captured.</p>';

 const steps=[];
 if(missing.length)steps.push(`Request missing information: ${missing.slice(0,3).join(', ')}${missing.length>3?' …':''}`);
 steps.push(symptoms.length?`${symptoms[0].action}${symptoms.length>1?` (also check: ${symptoms.slice(1).map(s=>s.label).join(', ')})`:''}`:'Clarify the reported problem with the customer');
 if(res.length)steps.push(`Confirm availability of ${res[0].name} and ${res[1].name}`);
 if(similar.length)steps.push(`Review similar case ${similar[0].record.caseId}`);
 steps.push('Record the expert decision below');
 document.getElementById('respSteps').innerHTML=steps.map(s=>`<li>${escapeHtml(s)}</li>`).join('');

 renderRespMap(c,loc,res);
 renderDecision(c);
}
function renderRespMap(c,loc,res){
 if(!hasLeaflet){mapUnavailable('respMap');return}
 ensureRespMap();
 respLayer.clearLayers();
 if(!loc){respMap.setView([50,-5],3);return}
 const pts=[[loc.lat,loc.lng]];
 L.circleMarker([loc.lat,loc.lng],{radius:10,color:'#262626',weight:3,fillColor:PRIORITY_COLORS[priorityLevel(c.priority)],fillOpacity:1})
  .bindPopup(`<b>${escapeHtml(c.aircraftId||'Aircraft')}</b><br>${escapeHtml(loc.name)} (${loc.iata})`).addTo(respLayer);
 res.filter(r=>r.lat!==null).forEach(r=>{
  L.marker([r.lat,r.lng],{icon:shapeIcon(r.type==='part'?'part':'team')}).bindPopup(`<b>${escapeHtml(r.name)}</b><br>${escapeHtml(r.detail)}<br>ETA ${escapeHtml(r.eta)}`).addTo(respLayer);
  L.polyline([[r.lat,r.lng],[loc.lat,loc.lng]],{color:'#262626',weight:1.2,dashArray:'4 6'}).addTo(respLayer);
  pts.push([r.lat,r.lng]);
 });
 respMap.fitBounds(pts,{padding:[40,40],maxZoom:7});
 setTimeout(()=>respMap.invalidateSize(),60);
}

/* ---------- Expert decision (human-in-the-loop) ---------- */
function renderDecision(c){
 document.querySelectorAll('input[name="decision"]').forEach(r=>r.checked=r.value===c.decision);
 document.getElementById('decisionBy').value=c.decisionBy||'';
 document.getElementById('decisionNote').value=c.decisionNote||'';
 const state=document.getElementById('decisionState');
 state.textContent=c.decision?`${DECISION_LABELS[c.decision]} · ${c.decisionBy}${c.decidedAt?` · ${new Date(c.decidedAt).toLocaleString('de-DE')}`:''}`:'Awaiting expert';
 state.classList.toggle('done',!!c.decision);
 updateFollowup();
 document.getElementById('decisionStatus').textContent=c.caseId?'':'Save the case in Intake first — the decision is stored with the saved case.';
}
function followupText(c){
 const missing=missingFieldsOf(c);
 return `Subject: Additional information required – ${c.caseId||'new IFSD case'}${c.aircraftId?` (${c.aircraftId})`:''}\n\n`+
  `Dear ${c.customer||'customer'},\n\nto continue the assessment of the reported engine event, please send us:\n`+
  [...missing,'Confirmed crew statement','EHM data extract around the event time'].map(m=>`• ${m}`).join('\n')+
  `\n\nThank you.\nIFSD Response Team (demo)`;
}
function updateFollowup(){
 const chosen=document.querySelector('input[name="decision"]:checked')?.value;
 const box=document.getElementById('followupBox');
 box.hidden=chosen!=='request-information'||!currentCase;
 if(!box.hidden&&!document.getElementById('followupText').dataset.edited)document.getElementById('followupText').value=followupText(currentCase);
}
document.querySelectorAll('input[name="decision"]').forEach(r=>r.addEventListener('change',updateFollowup));
document.getElementById('followupText').addEventListener('input',e=>e.target.dataset.edited='1');
document.getElementById('copyFollowup').onclick=async()=>{
 const text=document.getElementById('followupText').value;
 try{await navigator.clipboard.writeText(text);document.getElementById('decisionStatus').textContent='Follow-up request copied.'}
 catch{document.getElementById('followupText').select();document.getElementById('decisionStatus').textContent='Select and copy the text manually.'}
};
document.getElementById('saveDecision').onclick=async()=>{
 const status=document.getElementById('decisionStatus');
 if(!currentCase){status.textContent='No case selected.';return}
 if(!currentCase.caseId){status.textContent='Save the case in Intake first — the decision is stored with the saved case.';return}
 const decision=document.querySelector('input[name="decision"]:checked')?.value;
 const decisionBy=document.getElementById('decisionBy').value.trim();
 if(!decision){status.textContent='Choose a decision.';return}
 if(!decisionBy){status.textContent='Enter the name of the authorized expert.';return}
 const assignedResources=[...document.querySelectorAll('#respResources input:checked')].map(i=>i.value).join('; ');
 if(decision==='approve-plan'&&!assignedResources){status.textContent='Select at least one resource to approve a response plan.';return}
 let note=document.getElementById('decisionNote').value.trim();
 if(decision==='request-information'&&!note)note='Follow-up sent:\n'+document.getElementById('followupText').value;
 const button=document.getElementById('saveDecision');button.disabled=true;status.textContent='Saving…';
 try{
  currentCase=await caseRequest(`/${encodeURIComponent(currentCase.caseId)}`,'PUT',
   {...currentCase,decision,decisionBy,decisionNote:note,assignedResources,decidedAt:new Date().toISOString()});
  caseDirty=false;
  renderCase(currentCase);renderAlerts(currentCase);syncDashboard(currentCase,currentCase.originalText||'');
  await refreshCases();
  renderResponse();
  status.textContent=`Decision recorded for ${currentCase.caseId}.`;
 }catch(error){status.textContent=`Decision not saved: ${error.message}`}
 finally{button.disabled=false}
};

/* ---------- Hooks used by app.js ---------- */
async function refreshCases(){try{allCases=await caseRequest('?deleted=0')}catch{allCases=[]}renderOverviewMarkers();renderOverviewStats()}
function onCaseSaved(){refreshCases().then(()=>{if(document.getElementById('response').classList.contains('active'))renderResponse()})}
function onViewShown(id){
 if(id==='overview'){loadOverview()}
 if(id==='response'){(overviewLoaded?Promise.resolve():refreshCases().then(()=>{overviewLoaded=true})).then(renderResponse)}
}
document.getElementById('toAnalysis').onclick=()=>show('response');

/* ---------- Boot ---------- */
(function boot(){
 const iso=d=>d.toISOString().slice(0,10);
 const today=new Date(), tomorrow=new Date(Date.now()+86400000);
 const source=document.getElementById('sourceText');
 source.value=source.value.replace('{{TODAY}}',iso(today)).replace('{{TOMORROW}}',iso(tomorrow));
 updateDashboardClock();
 initOverviewMap();
 loadOverview();
 renderResponse();
})();
