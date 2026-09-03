/* IFSD Response Hub — demo prototype
   Single source of truth for all screens: the CASES model below feeds the
   dashboard map, the overview stats and the response workspace, so the same
   case looks identical wherever it appears. All values are demo/mock data. */

const PRIORITY_COLORS = { 1: '#f0525b', 2: '#f3cf3b', 3: '#57d779', 4: '#58bdc7' };
const PRIORITY_LABEL = { 1: 'Priority 1 · CRITICAL', 2: 'Priority 2 · HIGH', 3: 'Priority 3 · MEDIUM', 4: 'Priority 4 · MONITOR' };

// Resources are derived near each case's diversion airport so the map layers,
// the recommended-resources list and the response mini-map stay consistent.
function resourcesFor(c) {
  const d = c.diversion;
  return [
    { name: `${d.name} Service Partner`, detail: 'On-site engineers · parts', eta: '35 min', type: 'team', lat: d.lat, lng: d.lng },
    { name: `RR Specialist – ${c.engine}`, detail: 'Remote support', eta: 'sofort', type: 'specialist', lat: d.lat + 3, lng: d.lng + 4 },
    { name: 'Replacement Part Kit', detail: `Warehouse near ${d.name}`, eta: '3h 20m', type: 'part', lat: d.lat - 2.5, lng: d.lng - 3 }
  ];
}

const CASES = [
  { id: 'Case 003', counter: '001', caseId: '0309-001', flight: 'LH198', aircraft: 'Boeing 787-9', engine: 'Trent 1000',
    priority: 1, status: 'in progress', customer: 'LHA', problem: 'Fatal Bird Strike', trip: 'BER → MUC',
    region: 'Germany', event: { lat: 52.4, lng: 13.5 }, diversion: { name: 'München', iata: 'MUC', lat: 48.35, lng: 11.79 },
    notes: ['Bad impact at 3000 ft', 'at 132 knots,', 'climbing angle 32°'], action: 'Part replacement', fieldService: 'Thomas, Paul', spareParts: ['Heatshield', 'Blades'],
    ehm: [['EGT', '↑ 14%', true], ['Vibration', 'hoch', true], ['Oil Pressure', 'normal*', false]],
    completeness: 82, missing: ['Ölstand / Oil-System', 'vollständiger EHM-Datensatz', 'bestätigtes Crew Statement'],
    similar: [['2025-041', 76], ['2024-118', 61], ['2023-302', 53]] },
  { id: 'Case 007', counter: '002', caseId: '0309-002', flight: 'EK233', aircraft: 'Airbus A330', engine: 'Trent 700',
    priority: 2, status: 'team assigned', customer: 'UAE', problem: 'High Vibration', trip: 'DEL → DXB',
    region: 'Arabian Sea', event: { lat: 21, lng: 60 }, diversion: { name: 'Dubai', iata: 'DXB', lat: 25.25, lng: 55.36 },
    notes: ['Vibration spike at cruise', 'FL370, stable', 'crew monitoring'], action: 'Borescope inspection', fieldService: 'Sara, Ken', spareParts: ['Fan Blade', 'Sensor Kit'],
    ehm: [['EGT', '↑ 6%', true], ['Vibration', 'leicht erhöht', true], ['Oil Pressure', 'normal', false]],
    completeness: 74, missing: ['detaillierter EHM-Datensatz', 'Wetter am Ausweichflughafen'],
    similar: [['2025-012', 68], ['2024-090', 54]] },
  { id: 'Case 009', counter: '003', caseId: '0309-003', flight: 'IS77', aircraft: 'Gulfstream G650', engine: 'Pearl 15',
    priority: 3, status: 'under review', customer: 'ICE', problem: 'Oil Pressure Low', trip: 'YYZ → KEF',
    region: 'Greenland', event: { lat: 58, lng: -30 }, diversion: { name: 'Keflavík', iata: 'KEF', lat: 63.98, lng: -22.60 },
    notes: ['Oil pressure trending low', 'precautionary diversion'], action: 'Diagnostics', fieldService: 'Björk, Anna', spareParts: ['Oil Pump', 'Filter'],
    ehm: [['EGT', 'normal', false], ['Vibration', 'normal', false], ['Oil Pressure', 'leicht niedrig', true]],
    completeness: 61, missing: ['Crew Statement', 'Sensor-Zeitreihe', 'Ölstand'],
    similar: [['2024-201', 59], ['2023-118', 47]] },
  { id: 'Case 011', counter: '004', caseId: '0309-004', flight: 'DL88', aircraft: 'Airbus A380', engine: 'Trent 900',
    priority: 4, status: 'monitoring', customer: 'DAL', problem: 'Sensor Fault', trip: 'JFK → BOS',
    region: 'North America', event: { lat: 41, lng: -55 }, diversion: { name: 'Boston', iata: 'BOS', lat: 42.36, lng: -71.01 },
    notes: ['Intermittent EGT sensor', 'no performance impact'], action: 'Monitoring', fieldService: 'Mike, Lena', spareParts: ['EGT Sensor'],
    ehm: [['EGT', 'normal', false], ['Vibration', 'normal', false], ['Oil Pressure', 'normal', false]],
    completeness: 90, missing: ['Langzeit-Trend EHM'],
    similar: [['2025-033', 44]] },
  { id: 'Case 012', counter: '005', caseId: '0309-005', flight: 'AI144', aircraft: 'Airbus A350', engine: 'Trent XWB',
    priority: 4, status: 'data intake', customer: 'AIC', problem: 'Data Intake', trip: 'DEL → BOM',
    region: 'Arabian Sea', event: { lat: 24, lng: 68 }, diversion: { name: 'Mumbai', iata: 'BOM', lat: 19.09, lng: 72.87 },
    notes: ['Awaiting EHM download', 'case being assembled'], action: 'Data collection', fieldService: 'Raj, Priya', spareParts: ['—'],
    ehm: [['EGT', 'wird geladen', false], ['Vibration', 'wird geladen', false], ['Oil Pressure', '–', false]],
    completeness: 48, missing: ['EHM-Datensatz', 'Crew Statement', 'Ölstand', 'Flugkontext'],
    similar: [['2024-118', 51]] },
  { id: 'Case 005', counter: '006', caseId: '0309-006', flight: 'QF9', aircraft: 'Boeing 787-9', engine: 'Trent 1000',
    priority: 1, status: 'awaiting parts', customer: 'QFA', problem: 'Engine Shutdown', trip: 'SYD → PER',
    region: 'Indian Ocean', event: { lat: -25, lng: 108 }, diversion: { name: 'Perth', iata: 'PER', lat: -31.94, lng: 115.97 },
    notes: ['IFSD confirmed', 'awaiting parts at PER'], action: 'Part replacement', fieldService: 'Tom, Alex', spareParts: ['Combustor', 'Blades'],
    ehm: [['EGT', '↑ 11%', true], ['Vibration', 'hoch', true], ['Oil Pressure', 'niedrig', true]],
    completeness: 79, missing: ['Ersatzteil-Verfügbarkeit', 'Logistik-ETA'],
    similar: [['2025-041', 71], ['2023-302', 58]] },
  { id: 'Case 006', counter: '007', caseId: '0309-007', flight: 'LA705', aircraft: 'Airbus A330', engine: 'Trent 7000',
    priority: 4, status: 'monitoring', customer: 'LAN', problem: 'Precautionary Check', trip: 'SCL → GRU',
    region: 'South Atlantic', event: { lat: -15, lng: -35 }, diversion: { name: 'São Paulo', iata: 'GRU', lat: -23.43, lng: -46.47 },
    notes: ['Minor EGT rise', 'within limits'], action: 'Monitoring', fieldService: 'Diego, Ana', spareParts: ['—'],
    ehm: [['EGT', 'normal', false], ['Vibration', 'normal', false], ['Oil Pressure', 'normal', false]],
    completeness: 88, missing: ['Wetterdaten'],
    similar: [['2024-090', 42]] }
];
CASES.forEach(c => { c.resources = resourcesFor(c); });

/* ---------- View navigation ---------- */
const views = document.querySelectorAll('.view');
const nav = [...document.querySelectorAll('nav button')];
function show(id) {
  views.forEach(v => v.classList.remove('active'));
  nav.forEach(b => b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  nav.find(b => b.dataset.view === id)?.classList.add('active');
  if (id === 'overview' && dashMap) setTimeout(() => dashMap.invalidateSize(), 60);
  if (id === 'response' && respMap) setTimeout(() => respMap.invalidateSize(), 60);
}
nav.forEach(b => b.onclick = () => show(b.dataset.view));
document.querySelectorAll('[data-open-response]').forEach(btn => btn.addEventListener('click', () => show('response')));
document.querySelectorAll('[data-open-dashboard]').forEach(btn => btn.addEventListener('click', () => show('dashboard')));
document.querySelectorAll('[data-open-overview]').forEach(btn => btn.addEventListener('click', () => show('overview')));

/* ---------- Dashboard map (real geo, Leaflet + OpenStreetMap) ---------- */
let dashMap;
const dashLayers = { case: L.layerGroup(), team: L.layerGroup(), part: L.layerGroup() };
let liveMarker = null;

function caseMarker(c) {
  const m = L.circleMarker([c.event.lat, c.event.lng], {
    radius: 9, color: '#0c202c', weight: 3, fillColor: PRIORITY_COLORS[c.priority], fillOpacity: 1
  });
  m.bindPopup(casePopupHtml(c));
  m.on('popupopen', () => {
    const btn = document.querySelector('.leaflet-popup .popup-open');
    if (btn) btn.onclick = () => { setActiveDashboard(c); setActiveCase(c); show('dashboard'); };
  });
  return m;
}
function casePopupHtml(c) {
  return `<div class="map-pop"><b>${c.id} · ${c.problem}</b>
    <span>Flight: ${c.flight} · ${c.trip}</span><span>Engine: ${c.engine}</span>
    <span>Priority: ${c.priority}</span><span>Status: ${c.status}</span>
    <button type="button" class="popup-open">Open incident dashboard →</button></div>`;
}
function shapeIcon(kind) {
  return L.divIcon({ className: '', iconSize: [16, 16], iconAnchor: [8, 8], html: `<i class="mk mk-${kind}"></i>` });
}

function initDashMap() {
  dashMap = L.map('dashMap', { worldCopyJump: true, minZoom: 1 }).setView([30, 5], 2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap', maxZoom: 12
  }).addTo(dashMap);

  CASES.forEach(c => {
    caseMarker(c).addTo(dashLayers.case);
    const d = c.diversion;
    L.marker([d.lat, d.lng], { icon: shapeIcon('team') }).bindPopup(`<b>${d.name} (${d.iata})</b><br>Service location · ${c.id}`).addTo(dashLayers.team);
    L.marker([d.lat - 2.5, d.lng - 3], { icon: shapeIcon('part') }).bindPopup(`<b>Parts warehouse</b><br>near ${d.name}`).addTo(dashLayers.part);
  });
  dashLayers.case.addTo(dashMap);
  dashLayers.team.addTo(dashMap);
  dashLayers.part.addTo(dashMap);

  // Layer toggles
  document.querySelectorAll('[data-layer]').forEach(toggle => toggle.addEventListener('change', () => {
    toggle.dataset.layer.split(',').forEach(layer => {
      if (layer === 'weather') { document.querySelector('.map-weather').classList.toggle('on', toggle.checked); return; }
      if (!dashLayers[layer]) return;
      if (toggle.checked) dashLayers[layer].addTo(dashMap); else dashMap.removeLayer(dashLayers[layer]);
    });
  }));
}

/* ---------- Dashboard overview stats (computed from CASES) ---------- */
function renderStats() {
  document.getElementById('statActive').textContent = CASES.length;
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
  CASES.forEach(c => counts[c.priority]++);
  document.getElementById('priorityList').innerHTML = [1, 2, 3, 4].map(p =>
    `<li><i class="dot p${p}"></i><b>${p}</b><em>${counts[p]} case${counts[p] === 1 ? '' : 's'}</em></li>`).join('');
  const awaiting = CASES.filter(c => c.status === 'awaiting parts').map(c => c.id.replace('Case ', ''));
  const critical = CASES.filter(c => c.priority === 1).map(c => c.id.replace('Case ', ''));
  document.getElementById('recoList').innerHTML =
    `<span>Recommendations</span>
     <p>• ${critical.length} Priority-1 Cases priorisieren (${critical.join(', ')})</p>
     <p>• Ersatzteile senden für Case ${awaiting.join(', ') || '–'}</p>
     <p>• ${CASES.filter(c => c.completeness < 70).length} Cases mit unvollständigen Daten prüfen</p>`;
}

/* ---------- Incident Dashboard (data-driven from selected case) ---------- */
function setActiveDashboard(c) {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('dCounter', c.counter); set('dCase', c.caseId); set('dTrip', c.trip);
  set('dType', c.engine); set('dCustomer', c.customer); set('dProblem', c.problem);
  set('dLevel', c.priority); set('dCaseName', `${c.id} · ${c.flight}`);
  set('dAction', c.action); set('dField', c.fieldService);
  const pill = document.getElementById('dLevel');
  if (pill) { pill.style.background = PRIORITY_COLORS[c.priority]; pill.style.color = c.priority === 2 ? '#3a2f00' : '#fff'; }
  document.getElementById('dNotes').innerHTML = c.notes.join('<br>');
  document.getElementById('dParts').innerHTML = c.spareParts.join('<br>');
  const [from, to] = c.trip.split('→').map(s => s.trim());
  set('wxFrom', from); set('apFrom', from); set('wxTo', to); set('apTo', to);
}

/* ---------- Response workspace (data-driven) ---------- */
let respMap, respMarkers;
function ensureRespMap() {
  if (respMap) return;
  respMap = L.map('respMap', { zoomControl: true, minZoom: 1 }).setView([50, -10], 4);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 12 }).addTo(respMap);
  respMarkers = L.layerGroup().addTo(respMap);
}

function setActiveCase(c) {
  document.getElementById('respTitle').textContent = `${c.id} · ${c.flight}`;
  document.getElementById('respMeta').textContent = `${c.aircraft} · ${c.engine} · ${c.region} → Ausweichflughafen ${c.diversion.name} (${c.diversion.iata})`;
  const pr = document.getElementById('respPriority');
  pr.textContent = PRIORITY_LABEL[c.priority];
  pr.style.background = PRIORITY_COLORS[c.priority];
  pr.style.color = c.priority === 2 ? '#3a2f00' : '#fff';

  document.getElementById('respEhm').innerHTML = c.ehm.map(([k, v, warn]) =>
    `<p>${k} <span class="${warn ? 'red' : ''}">${v}</span></p>`).join('');
  document.getElementById('respCompleteness').textContent = c.completeness + '%';
  document.getElementById('respMissing').innerHTML = c.missing.length
    ? c.missing.map(x => `<p>⚠ ${x} fehlt</p>`).join('')
    : '<p>Alle Pflichtfelder vorhanden ✓</p>';
  document.getElementById('respSimilar').innerHTML = c.similar.map(([id, pct]) => `<p>${id} · ${pct}%</p>`).join('');
  document.getElementById('respResources').innerHTML = c.resources.map(r =>
    `<p><b>${r.name}</b><br>${r.detail} · ETA ${r.eta}</p>`).join('');

  // Response mini-map: event + diversion + resources
  ensureRespMap();
  respMarkers.clearLayers();
  L.circleMarker([c.event.lat, c.event.lng], { radius: 10, color: '#8a1c1c', weight: 3, fillColor: '#e14f55', fillOpacity: 1 })
    .bindPopup(`<b>IFSD Event</b><br>${c.flight} · ${c.region}`).addTo(respMarkers);
  const pts = [[c.event.lat, c.event.lng]];
  L.marker([c.diversion.lat, c.diversion.lng], { icon: shapeIcon('team') })
    .bindPopup(`<b>${c.diversion.name} (${c.diversion.iata})</b><br>Diversion airport`).addTo(respMarkers);
  pts.push([c.diversion.lat, c.diversion.lng]);
  c.resources.forEach(r => {
    L.marker([r.lat, r.lng], { icon: shapeIcon(r.type === 'part' ? 'part' : 'team') })
      .bindPopup(`<b>${r.name}</b><br>${r.detail} · ETA ${r.eta}`).addTo(respMarkers);
    pts.push([r.lat, r.lng]);
  });
  L.polyline([[c.event.lat, c.event.lng], [c.diversion.lat, c.diversion.lng]], { color: '#123452', weight: 2, dashArray: '6 6' }).addTo(respMarkers);
  respMap.fitBounds(pts, { padding: [40, 40], maxZoom: 6 });
  setTimeout(() => respMap.invalidateSize(), 60);
}

/* ---------- Intake: derive an editable structured case from the text ---------- */
const esc = s => String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;');
const AIRLINES = { LH: 'LHA', BA: 'BAW', AF: 'AFR', KL: 'KLM', EK: 'UAE', QF: 'QFA', AA: 'AAL', DL: 'DAL', UA: 'UAL', LX: 'SWR', AI: 'AIC', QR: 'QTR', SQ: 'SIA', LA: 'LAN' };

// Core fields become editable inputs in the structured case.
const CORE_FIELDS = [
  { label: 'Flugnummer', get: t => (t.match(/\b([A-Z]{2}\d{2,4})\b/) || [])[1] },
  { label: 'Flugzeug', get: t => (t.match(/\b((?:Boeing|Airbus)\s+[A-Z]?\d{3}(?:-\d+)?)\b/i) || [])[1] },
  { label: 'Triebwerk', get: t => (t.match(/\b((?:Trent|Pearl|BR)\s?\d{2,4})\b/i) || [])[1] },
  { label: 'Zeitpunkt', get: t => (t.match(/\b(\d{1,2}:\d{2}\s*UTC)\b/i) || [])[1] },
  { label: 'Flughöhe', get: t => (t.match(/\b(FL\d{2,3})\b/i) || [])[1] },
  { label: 'Ort', get: t => (t.match(/\b(Nordatlantik|Südatlantik|Nordsee|Ärmelkanal|Pazifik|Indischer Ozean|Mittelmeer|Atlantik)\b/i) || [])[1] },
  { label: 'Route', get: t => { const m = t.match(/von\s+([A-ZÄÖÜ][A-Za-zäöü]+(?:\s[A-ZÄÖÜ][A-Za-zäöü]+)?)\s+nach\s+([A-ZÄÖÜ][A-Za-zäöü]+)/); return m ? `${m[1]} → ${m[2]}` : null; } },
  { label: 'Kunde', get: t => { const m = t.match(/\b([A-Z]{2})\d{2,4}\b/); return m ? (AIRLINES[m[1]] || m[1]) : null; } },
  { label: 'Problem', get: t => /vogelschlag|bird\s?strike/i.test(t) ? 'Bird Strike' : /\b(fire|feuer|flame\s?out)\b/i.test(t) ? 'Engine Fire' : /\b(shutdown|abgeschaltet|ifsd)\b/i.test(t) ? 'Engine Shutdown' : /vibration/i.test(t) ? 'High Vibration' : /öldruck|oil pressure/i.test(t) ? 'Oil Pressure' : null }
];
// Soft fields become the "Fehlende Informationen" checklist when not stated.
const MISSING_FIELDS = [
  { label: 'Ölstand / Oil-System-Informationen', get: t => (t.match(/öl(?:stand|druck)[^.]*?\b(normal|ok|niedrig|hoch|\d+\s?%)/i) || [])[1] },
  { label: 'vollständiger EHM-Datensatz', get: t => /EHM[- ]?daten\s*(?:liegen vor|verfügbar|:)/i.test(t) ? 'vorhanden' : null },
  { label: 'bestätigtes Crew Statement', get: t => /crew[- ]?statement\s*(?:bestätigt|confirmed|liegt vor)/i.test(t) ? 'bestätigt' : null }
];
const TOTAL_FIELDS = CORE_FIELDS.length + MISSING_FIELDS.length;
let currentMissing = [];
function computeCompleteness() {
  const foundSoft = MISSING_FIELDS.length - currentMissing.length;
  return Math.round(((window.__foundCore || 0) + foundSoft) / TOTAL_FIELDS * 100);
}

document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => {
  document.querySelectorAll('.tabs button').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  const box = document.getElementById('whisperBox');
  if (box) box.hidden = b.dataset.tab === 'email';
});

function renderFields(values) {
  document.getElementById('fields').innerHTML = values.map(([k, v]) =>
    `<label class="field${v ? '' : ' unknown'}"><small>${k}</small><input data-k="${esc(k)}" value="${v ? esc(v) : ''}" placeholder="nicht erkannt"></label>`).join('');
}
function renderMissing(missing, completeness) {
  const box = document.getElementById('missing');
  box.innerHTML = missing.length
    ? missing.map(m => `<label class="miss"><input type="checkbox" data-miss="${esc(m)}"><span>${m}</span></label>`).join('') +
      `<div class="completeness-line">Case Completeness: <b>${completeness}%</b> · ${missing.length} Feld(er) offen</div>`
    : `<div class="ok-line">✓ Alle Pflichtfelder erkannt (${completeness}%)</div>`;
  box.querySelectorAll('[data-miss]').forEach(cb => cb.addEventListener('change', updateMissingState));
  updateMissingState();
}
function updateMissingState() {
  const checked = document.querySelectorAll('[data-miss]:checked').length;
  document.getElementById('askFollowup').disabled = checked === 0;
}
function currentFieldValues() {
  const o = {};
  document.querySelectorAll('#fields input[data-k]').forEach(i => o[i.dataset.k] = i.value.trim());
  return o;
}
function buildLiveCase() {
  const f = currentFieldValues();
  const t = document.getElementById('sourceText').value;
  const critical = /critical/i.test(f['Priorität'] || '') || /\b(shutdown|abgeschaltet|fire|feuer)\b/i.test(t);
  const missing = [...document.querySelectorAll('[data-miss]')].map(x => x.dataset.miss);
  const lc = {
    id: f['Case-ID'] || 'IFSD-2026-0903-017', counter: '—', caseId: f['Case-ID'] || 'IFSD-2026-0903-017',
    flight: f['Flugnummer'] || 'LH412', aircraft: f['Flugzeug'] || 'Boeing 787-9', engine: f['Triebwerk'] || 'Trent 1000',
    priority: critical ? 1 : 3, status: 'live intake', customer: f['Kunde'] || '—', problem: f['Problem'] || 'Under review',
    trip: f['Route'] || '—', region: f['Ort'] || 'in Bearbeitung',
    event: { lat: 52.5, lng: -20 }, diversion: { name: 'Shannon', iata: 'SNN', lat: 52.70, lng: -8.92 },
    notes: [document.getElementById('sourceText').value.slice(0, 90) + '…'], action: 'Prüfen', fieldService: '—', spareParts: ['—'],
    ehm: [['EGT', '↑ 14%', true], ['Vibration', 'hoch', true], ['Oil Pressure', 'normal*', false]],
    completeness: window.__completeness ?? 82, missing, similar: [['2025-041', 76], ['2024-118', 61], ['2023-302', 53]]
  };
  lc.resources = resourcesFor(lc);
  return lc;
}
function refreshLive() {
  const lc = buildLiveCase();
  window.__liveCase = lc;
  if (dashMap) {
    if (liveMarker) dashLayers.case.removeLayer(liveMarker);
    liveMarker = caseMarker(lc);
    liveMarker.setStyle({ color: '#8a1c1c', weight: 4 });
    liveMarker.addTo(dashLayers.case);
  }
}

document.getElementById('extract').onclick = () => {
  const t = document.getElementById('sourceText').value;
  const coreValues = CORE_FIELDS.map(f => [f.label, f.get(t) || null]);
  const foundCore = coreValues.filter(([, v]) => v).length;
  const missing = MISSING_FIELDS.filter(f => !f.get(t)).map(f => f.label);
  const foundSoft = MISSING_FIELDS.length - missing.length;
  const critical = /\b(shutdown|abgeschaltet|fire|feuer|flame\s?out)\b/i.test(t);
  const completeness = Math.round((foundCore + foundSoft) / (CORE_FIELDS.length + MISSING_FIELDS.length) * 100);
  window.__completeness = completeness;

  window.__foundCore = foundCore;
  currentMissing = missing.slice();

  renderFields([['Case-ID', 'IFSD-2026-0903-017'], ['Priorität', critical ? 'CRITICAL' : 'REVIEW'], ...coreValues]);
  renderMissing(currentMissing, completeness);
  document.getElementById('followupOut').innerHTML = '';
  document.getElementById('saveHint').hidden = true;
  refreshLive();
  document.getElementById('toResponse').disabled = false;
};

document.getElementById('saveCase').onclick = () => {
  refreshLive();
  const btn = document.getElementById('saveCase'), old = btn.textContent;
  btn.textContent = 'Gespeichert ✓';
  setTimeout(() => { btn.textContent = old; }, 1500);
};

document.getElementById('askFollowup').onclick = () => {
  const items = [...document.querySelectorAll('[data-miss]:checked')].map(x => x.dataset.miss);
  if (!items.length) return;
  const caseId = document.querySelector('#fields input[data-k="Case-ID"]')?.value || 'IFSD-2026-0903-017';
  const flight = document.querySelector('#fields input[data-k="Flugnummer"]')?.value || 'LH412';
  const msg = `Betreff: Fehlende Informationen zu Case ${caseId}\n\nBitte senden Sie uns für ${flight} noch folgende Informationen:\n` +
    items.map(i => `• ${i}`).join('\n');
  document.getElementById('followupOut').innerHTML =
    `<div class="followup">
       <label class="followup-label">Generierte Rückfrage</label>
       <textarea id="followupText" class="followup-area" rows="4"></textarea>
       <label class="followup-label">Erhaltene Antwort / Ergänzung</label>
       <textarea id="followupAnswer" class="followup-area" rows="3" placeholder="Antwort des Kunden oder der Crew hier einfügen …"></textarea>
       <button type="button" id="applyFollowup">Ausgewählte Angaben übernehmen</button>
     </div>`;
  document.getElementById('followupText').value = msg;
  document.getElementById('saveHint').hidden = false;   // "Rückfrage ausstehend"
  document.getElementById('applyFollowup').onclick = () => applyFollowup(items);
};

// Mark the selected missing items as provided, lifting completeness and clearing the pending state.
function applyFollowup(items) {
  const answer = document.getElementById('followupAnswer')?.value.trim();
  currentMissing = currentMissing.filter(m => !items.includes(m));
  window.__completeness = computeCompleteness();
  renderMissing(currentMissing, window.__completeness);
  document.getElementById('followupOut').innerHTML =
    `<div class="followup resolved"><b>Angaben übernommen ✓</b>` +
    (answer ? `<p>${esc(answer)}</p>` : '') +
    `<small>${items.length} Angabe(n) ergänzt · Completeness ${window.__completeness}%</small></div>`;
  document.getElementById('saveHint').hidden = true;
  refreshLive();
}

document.getElementById('toResponse').onclick = () => {
  refreshLive();
  setActiveCase(window.__liveCase);
  show('response');
};

/* ---------- Local Whisper transcription (faster-whisper webservice) ---------- */
const WHISPER_URL = 'http://localhost:9000/asr';
let mediaRecorder, recChunks = [], recTimerInt, recSeconds = 0;
function setWhisper(txt, active) {
  const el = document.getElementById('whisperStatus');
  el.textContent = txt;
  el.classList.toggle('active', !!active);
}
function updateRecTimer() {
  const m = String(Math.floor(recSeconds / 60)).padStart(2, '0');
  const s = String(recSeconds % 60).padStart(2, '0');
  document.getElementById('recTimer').textContent = `${m}:${s}`;
}
document.getElementById('recStart').onclick = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    recChunks = [];
    mediaRecorder.ondataavailable = e => recChunks.push(e.data);
    mediaRecorder.onstop = transcribeRecording;
    mediaRecorder.start();
    setWhisper('Aufnahme läuft…', true);
    document.getElementById('recStart').disabled = true;
    document.getElementById('recStop').disabled = false;
    recSeconds = 0; updateRecTimer();
    recTimerInt = setInterval(() => { recSeconds++; updateRecTimer(); }, 1000);
  } catch (e) {
    setWhisper('Kein Mikrofonzugriff', false);
  }
};
document.getElementById('recStop').onclick = () => {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(tr => tr.stop());
  }
  clearInterval(recTimerInt);
  document.getElementById('recStart').disabled = false;
  document.getElementById('recStop').disabled = true;
};
async function transcribeRecording() {
  setWhisper('Transkribiere…', true);
  const lang = document.getElementById('whisperLang').value;
  const fd = new FormData();
  fd.append('audio_file', new Blob(recChunks, { type: 'audio/webm' }), 'audio.webm');
  const url = `${WHISPER_URL}?task=transcribe&output=txt${lang ? `&language=${lang}` : ''}`;
  try {
    const res = await fetch(url, { method: 'POST', body: fd });
    if (!res.ok) throw new Error(res.status);
    const text = (await res.text()).trim();
    if (text) document.getElementById('sourceText').value = text;
    setWhisper('Fertig ✓', false);
  } catch (e) {
    setWhisper('Whisper-Dienst nicht erreichbar (lokal starten)', false);
  }
}

/* ---------- Clock ---------- */
function updateDashboardClock() {
  const now = new Date();
  const time = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  document.querySelectorAll('.js-clock').forEach(el => el.textContent = `${time}  ${date}`);
}

/* ---------- Boot ---------- */
updateDashboardClock();
setInterval(updateDashboardClock, 30000);
initDashMap();
renderStats();
setActiveDashboard(CASES[0]);
setActiveCase(CASES[0]);
