/* IFSD Response Hub — Forecast view.
   Early-warning indicators derived from the saved cases (repeat events per
   aircraft and engine, symptom trends, regional demand) plus clearly marked
   DEMO external signals (weather, news, social media). Nothing here is a
   validated prediction; it supports planning by authorized experts.
   Uses globals from app.js / overview.js: caseRequest, escapeHtml, symptomsOf,
   locate, nearest, WAREHOUSES, priorityLevel, openCaseInResponse. */

// Simulated external signals. In a real system these would come from weather,
// NOTAM/news and social-media feeds. They only raise attention for a symptom family.
const DEMO_SIGNALS = [
 {source:'Weather', title:'Strong crosswinds and icing expected over the North Atlantic', region:['SNN','DUB','LHR'], families:['indication','flameout'], level:'Elevated'},
 {source:'News', title:'Seasonal bird migration peak reported for Northern Europe', region:['CPH','AMS','HAM','BER'], families:['bird'], level:'High'},
 {source:'Social media', title:'Passenger posts mention smell in cabin on several regional flights', region:['FRA','MUC'], families:['smoke'], level:'Watch'}
];

function eventMonth(c){const m=String(c.eventTime||'').match(/(\d{4})-(\d{2})/);return m?`${m[1]}-${m[2]}`:null}
function monthLabel(key){const [y,m]=key.split('-');return new Date(Number(y),Number(m)-1,1).toLocaleDateString('en-GB',{month:'short'})}

async function renderForecast(){
 const root=document.getElementById('forecastBody');
 let cases=allCases;
 if(!cases.length){try{cases=await caseRequest('?deleted=0')}catch(error){root.innerHTML=`<p class="notice">${escapeHtml(error.message)}</p>`;return}}
 if(!cases.length){root.innerHTML='<p class="notice">The forecast needs saved cases. Create cases in Intake or load the demo data with <code>python3 seed_demo_cases.py</code>.</p>';return}

 // 1) Monthly case volume and symptom trend
 const months={};cases.forEach(c=>{const k=eventMonth(c);if(k)months[k]=(months[k]||0)+1});
 const keys=Object.keys(months).sort();
 const span=keys.slice(-6);
 const max=Math.max(1,...span.map(k=>months[k]));
 const recent=new Set(keys.slice(-3)), earlier=new Set(keys.slice(-6,-3));
 const fam={};
 cases.forEach(c=>{const k=eventMonth(c);symptomsOf(c).forEach(s=>{fam[s.key]=fam[s.key]||{label:s.label,parts:s.parts,recent:0,earlier:0,total:0};fam[s.key].total++;if(recent.has(k))fam[s.key].recent++;if(earlier.has(k))fam[s.key].earlier++;})});
 const avg=keys.length?cases.filter(c=>eventMonth(c)).length/keys.length:0;

 // 2) Repeat events per aircraft / engine (early warning)
 const groups={};
 cases.forEach(c=>{
  [['Aircraft',c.aircraftId],['Engine',c.engine1],['Engine',c.engine2]].forEach(([kind,id])=>{if(!id)return;const g=groups[id]=groups[id]||{kind,id,cases:[],fams:new Set()};g.cases.push(c);symptomsOf(c).forEach(s=>g.fams.add(s.label))});
 });
 const watch=Object.values(groups).filter(g=>g.cases.length>=2).sort((a,b)=>b.cases.length-a.cases.length||a.id.localeCompare(b.id)).slice(0,6);

 // 3) Regional demand and pre-positioning
 const regions={};
 cases.forEach(c=>{const loc=locate(c.aircraftLocation);if(!loc)return;const r=regions[loc.iata]=regions[loc.iata]||{loc,count:0,fams:{}};r.count++;symptomsOf(c).forEach(s=>r.fams[s.key]=(r.fams[s.key]||0)+1)});
 const signalFor=iata=>DEMO_SIGNALS.filter(s=>s.region.includes(iata));
 const regionRows=Object.values(regions).map(r=>{
  const topKey=Object.entries(r.fams).sort((a,b)=>b[1]-a[1])[0]?.[0];
  const sig=signalFor(r.loc.iata);
  const boosted=sig.some(s=>s.families.includes(topKey));
  return {...r,top:fam[topKey],sig,score:r.count+(sig.length?2:0)+(boosted?2:0)};
 }).sort((a,b)=>b.score-a.score).slice(0,5);

 const trend=Object.values(fam).map(f=>({...f,delta:f.recent-f.earlier})).sort((a,b)=>b.delta-a.delta||b.total-a.total);
 const rising=trend.filter(t=>t.delta>0).slice(0,3);

 root.innerHTML=`
 <div class="fc-grid">
  <article class="panel fc-volume">
   <h3>Case volume <small class="src">Saved cases</small></h3>
   <div class="fc-chart" role="img" aria-label="Cases per month">
    ${span.map(k=>`<div class="fc-bar"><span style="height:${Math.round(months[k]/max*100)}%"><b>${months[k]}</b></span></div>`).join('')}
   </div>
   <div class="fc-labels">${span.map(k=>`<em>${monthLabel(k)}</em>`).join('')}</div>
   <p class="fc-note">Average ${avg.toFixed(1)} cases per month over ${keys.length} month${keys.length===1?'':'s'}. Expect a similar load in the next month unless the signals below change it.</p>
  </article>
  <article class="panel">
   <h3>Rising symptoms <small class="src">Last 3 vs previous 3 months</small></h3>
   ${rising.length?`<ul class="fc-list">${rising.map(t=>`<li><b>${escapeHtml(t.label)}</b><span>${t.earlier} → ${t.recent} cases</span></li>`).join('')}</ul>`:'<p class="muted">No symptom family is rising.</p>'}
   <h3 class="spaced">Most frequent overall</h3>
   <ul class="fc-list">${trend.slice().sort((a,b)=>b.total-a.total).slice(0,3).map(t=>`<li><b>${escapeHtml(t.label)}</b><span>${t.total} cases</span></li>`).join('')}</ul>
  </article>
  <article class="panel">
   <h3>External signals <small class="src">Demo · not connected</small></h3>
   <ul class="fc-signals">${DEMO_SIGNALS.map(s=>`<li data-level="${escapeHtml(s.level)}"><span>${escapeHtml(s.source)} · ${escapeHtml(s.level)}</span><b>${escapeHtml(s.title)}</b><small>Affects ${s.region.join(', ')}</small></li>`).join('')}</ul>
  </article>
 </div>
 <div class="two">
  <article class="panel">
   <h3>Watch list: repeat events</h3>
   <p class="hint">Aircraft and engines with more than one reported event. Candidates for a proactive inspection.</p>
   <table class="fc-table"><thead><tr><th>Unit</th><th>Events</th><th>Symptoms</th><th></th></tr></thead><tbody>
   ${watch.map(g=>{const last=g.cases.slice().sort((a,b)=>String(b.eventTime).localeCompare(String(a.eventTime)))[0];return `<tr><td><span class="muted">${g.kind}</span><br><span class="mono">${escapeHtml(g.id)}</span></td><td>${g.cases.length}</td><td>${escapeHtml([...g.fams].slice(0,3).join(', ')||'—')}</td><td><button type="button" class="btn-secondary fc-open" data-case="${escapeHtml(last.caseId)}">Latest case</button></td></tr>`}).join('')||'<tr><td colspan="4" class="muted">No repeat events.</td></tr>'}
   </tbody></table>
  </article>
  <article class="panel">
   <h3>Prepare resources <small class="src">Suggestion</small></h3>
   <p class="hint">Locations with the most events, weighted by active demo signals.</p>
   <ol class="fc-prep">${regionRows.map(r=>{const store=nearest(WAREHOUSES,r.loc);const parts=(r.top?.parts||['Inspection kit']).join(', ');return `<li><b>${escapeHtml(r.loc.name)} (${r.loc.iata})</b><span>${r.count} case${r.count===1?'':'s'}${r.top?`, mostly ${escapeHtml(r.top.label)}`:''}${r.sig.length?` · signal: ${escapeHtml(r.sig[0].source.toLowerCase())}`:''}</span><small>Pre-position ${escapeHtml(parts)} at ${escapeHtml(store.name)}</small></li>`}).join('')}</ol>
  </article>
 </div>`;
 root.querySelectorAll('.fc-open').forEach(b=>b.onclick=()=>openCaseInResponse(b.dataset.case));
}
