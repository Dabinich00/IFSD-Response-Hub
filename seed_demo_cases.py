"""Import 50 explicitly synthetic cases; reruns skip existing dataset markers.

Use --reset to back up the database and start from an empty one first."""
import json
import random
import sys
import sqlite3
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
import database

DATASET = 'IFSD-DEMO-50-v2'
CUSTOMERS = ['Demo Northstar Air', 'Demo Atlantic Connect', 'Demo Baltic Wings', 'Demo Alpine Airways', 'Demo Meridian Air']
LOCATIONS = ['Shannon (SNN)', 'London Heathrow (LHR)', 'Frankfurt (FRA)', 'Berlin (BER)', 'Munich (MUC)', 'Madrid (MAD)', 'Lisbon (LIS)', 'Paris (CDG)', 'Amsterdam (AMS)', 'Copenhagen (CPH)']
# Each family includes five distinct reports, not five copies of one incident.
FAMILIES = [
 ('vibration', [
  'Fan vibration increased during climb; engine 2 was shut down by the crew and the aircraft diverted.',
  'Intermittent engine 2 vibration appeared at cruise power; no shutdown occurred and the flight continued to destination.',
  'Engine 1 vibration increased during descent, with no reported oil-pressure change; the aircraft landed at the planned airport.',
  'A second vibration report on engine 2 followed a previous occurrence on the same aircraft; the crew reported a precautionary shutdown.',
  'Vibration was reported during a ground run after maintenance; no in-flight event occurred.'
 ]),
 ('oil-pressure', [
  'Engine 1 oil-pressure indication fell during cruise; the crew shut the engine down and diverted.',
  'A brief engine 2 oil-pressure warning cleared; actual pressure loss versus indication fault remains unconfirmed.',
  'Engine 1 low oil pressure was accompanied by rising oil temperature; a precautionary shutdown was reported.',
  'Oil-pressure fluctuations on engine 2 recurred after an earlier report; no shutdown was reported on this flight.',
  'Low oil pressure was reported after landing during taxi; the engine was stopped on the ground.'
 ]),
 ('high-egt', [
  'Engine 2 exhaust gas temperature (EGT) rose unexpectedly during climb; the crew reported a shutdown and return to departure airport.',
  'Engine 1 EGT was higher than on previous flights at comparable cruise settings; no limit exceedance or shutdown was confirmed.',
  'High engine 2 EGT coincided with reduced thrust during cruise; the aircraft diverted, but shutdown status is not stated.',
  'A transient engine 1 EGT indication spike occurred without a reported thrust change; sensor and actual temperature effects remain unresolved.',
  'Engine 2 EGT remained elevated during a ground test; the test was stopped and the aircraft did not depart.'
 ]),
 ('compressor-surge', [
  'A loud bang, fluctuating thrust and an EGT rise were reported on engine 1 during climb; the crew described a suspected compressor surge and shut down the engine.',
  'Two brief bangs from engine 2 occurred at cruise; a suspected surge was reported, with no confirmed shutdown.',
  'Engine 1 thrust oscillation occurred during descent without an audible bang; compressor instability is suspected but not established.',
  'Engine 2 experienced a reported surge followed by high vibration; the aircraft diverted after a crew-commanded shutdown.',
  'A suspected compressor surge occurred on engine 1 during a ground run after maintenance; no flight was involved.'
 ]),
 ('bird-strike', [
  'A suspected bird strike during climb was followed by engine 2 vibration; the crew shut down the engine and returned.',
  'A bird impact was reported on approach near engine 1; the aircraft landed normally and no engine shutdown was reported.',
  'Engine 2 vibration and an EGT rise followed a possible bird encounter; the crew could not confirm ingestion.',
  'Bird remains were reported near the engine 1 inlet after landing; no abnormal engine indications had been reported in flight.',
  'A suspected bird strike at takeoff was followed by engine 2 thrust loss; shutdown status is missing from the initial call.'
 ]),
 ('fuel-system', [
  'Engine 1 fuel-flow indication fell with a loss of thrust during cruise; a flameout was reported and the aircraft diverted.',
  'Engine 2 fuel-flow indication fluctuated while reported thrust remained stable; the cause is unconfirmed.',
  'A fuel-system warning preceded engine 1 rollback during climb; the crew reported a precautionary shutdown.',
  'Engine 2 fuel-flow changes and high EGT were reported together; no confirmed shutdown was included in the email.',
  'A suspected fuel leak was reported during a ground inspection; engine 1 was not started and the departure was delayed.'
 ]),
 ('indication-disagreement', [
  'Engine 2 vibration indications disagreed between available displays; the crew reported no associated thrust loss.',
  'An engine 1 temperature indication intermittently disappeared during cruise; no shutdown occurred.',
  'An oil-pressure alert on engine 2 conflicted with the remaining reported parameters; the crew requested engineering review after landing.',
  'An engine 1 speed indication froze while other indications continued to change; actual engine condition is not established.',
  'An engine 2 sensor fault recurred during a ground check after a previous in-flight indication report.'
 ]),
 ('oil-consumption', [
  'An unusually large oil top-up was recorded for engine 1 after landing; no shutdown occurred during the flight.',
  'Engine 2 oil quantity decreased across several sectors; no visible leak was confirmed in the initial report.',
  'Engine 1 oil loss was accompanied by low pressure during cruise; the crew reported a shutdown and diversion.',
  'An oil leak was observed near engine 2 on the ground; the exact origin has not been established.',
  'A repeat oil-consumption report on engine 1 followed an earlier top-up; flight-by-flight quantities are missing.'
 ]),
 ('smoke-odour', [
  'Cabin odour was reported during climb with an engine 2 oil-system alert; the source of the odour is unconfirmed and the aircraft returned.',
  'Smoke was reported near engine 1 after landing; the engine was stopped on the ground and no in-flight shutdown occurred.',
  'A transient cabin smell occurred without abnormal engine indications; no engine can yet be identified as the source.',
  'An engine 2 fire warning was reported during cruise and the crew shut down the engine; physical evidence of fire is not yet available.',
  'An odour report recurred on the same aircraft, but this report contains no engine warning or shutdown.'
 ]),
 ('flameout-restart', [
  'Engine 1 flamed out during cruise; the crew reported an unsuccessful restart attempt and diversion.',
  'A brief engine 2 loss of combustion was followed by a reported successful relight; the aircraft diverted for review.',
  'Engine 1 shutdown was reported during descent; the initial message does not distinguish a flameout from a commanded shutdown.',
  'Engine 2 failed to start on the ground; the flight was cancelled and this was not an in-flight shutdown.',
  'Engine 1 lost thrust during cruise and recovered; whether combustion was lost remains unconfirmed.'
 ])
]


FLEET = [  # fictional tails; aircraft/engine type names are used only as realistic labels
 ('DEMO-AC-001','A350-900','Trent XWB-84',0),('DEMO-AC-002','A350-900','Trent XWB-84',0),('DEMO-AC-003','A350-1000','Trent XWB-97',0),
 ('DEMO-AC-004','787-9','Trent 1000-TEN',1),('DEMO-AC-005','787-9','Trent 1000-TEN',1),('DEMO-AC-006','787-10','Trent 1000-TEN',1),
 ('DEMO-AC-007','A330-900','Trent 7000',2),('DEMO-AC-008','A330-900','Trent 7000',2),('DEMO-AC-009','A330-900','Trent 7000',2),
 ('DEMO-AC-010','A350-900','Trent XWB-84',3),('DEMO-AC-011','A350-900','Trent XWB-84',3),('DEMO-AC-012','A380-800','Trent 900',3),
 ('DEMO-AC-013','787-9','Trent 1000-TEN',4),('DEMO-AC-014','A330-900','Trent 7000',4),('DEMO-AC-015','A350-1000','Trent XWB-97',4)]
# Realistic mix: indications and vibration are common, flameouts and surges rare.
WEIGHTS = {'indication-disagreement':10,'vibration':8,'high-egt':6,'oil-consumption':6,'oil-pressure':5,'bird-strike':5,
           'fuel-system':3,'smoke-odour':3,'compressor-surge':2,'flameout-restart':2}
ATA = {'vibration':'77-30 Engine vibration indicating','oil-pressure':'79-30 Oil indicating','oil-consumption':'79-00 Oil system',
       'high-egt':'77-20 EGT indicating','compressor-surge':'72-30 Compressor','bird-strike':'72-00 Engine (bird strike inspection)',
       'fuel-system':'73-00 Engine fuel and control','indication-disagreement':'77-00 Engine indicating',
       'smoke-odour':'26-10 Fire detection / 79 oil','flameout-restart':'74-00 Ignition'}
LOC_WEIGHTS = [5,9,8,4,7,4,3,4,3,3]  # LHR and FRA hubs see the most events
ROOT_CAUSES = {'vibration':['Fan blade erosion, blade set replaced','Vibration pick-up connector loose, re-terminated'],
  'oil-pressure':['Oil pressure transmitter failed, replaced','Oil filter bypass, filter changed'],
  'oil-consumption':['Bearing seal wear, engine removed for shop visit','Oil tank cap seal damaged, replaced'],
  'high-egt':['Thermocouple harness chafed, replaced','HPT blade deterioration, borescope follow-up scheduled'],
  'compressor-surge':['Variable stator vane actuator fault, actuator replaced'],
  'bird-strike':['Bird ingestion, fan blade blended within limits','No damage found after inspection'],
  'fuel-system':['Fuel metering unit fault, unit replaced'],
  'indication-disagreement':['EGT sensor fault, sensor replaced','Software indication fault, no engine defect'],
  'smoke-odour':['Oil leak into bleed air, seal replaced','Cabin odour not engine related (APU)'],
  'flameout-restart':['Ice crystal icing event, no hardware fault','Igniter plug worn, replaced']}
CLUSTERS = [('DEMO-AC-003','oil-consumption',[4,11,19]),('DEMO-AC-007','vibration',[6,23]),('DEMO-AC-012','smoke-odour',[2,9])]


def phase_of(text):
    t = text.lower()
    for key, label in (('ground run','Ground run'),('taxi','Taxi'),('after landing','Ground'),('ground','Ground'),('takeoff','Take-off'),
                       ('climb','Climb'),('cruise','Cruise'),('descent','Descent'),('approach','Approach')):
        if key in t:
            return label
    return 'Not stated'


def build_records(now=None):
    rng = random.Random(20261105)
    now = (now or datetime.now(timezone.utc)).replace(second=0, microsecond=0)
    families = dict(FAMILIES)
    plan = []
    for tail, family, days in CLUSTERS:
        for d in days:
            plan.append((family, tail, d))
    pool = [f for f, w in WEIGHTS.items() for _ in range(w)]
    for f, tail, _ in plan:
        pool.remove(f)
    rng.shuffle(pool)
    for f in pool:
        tail = rng.choice(FLEET)[0]
        plan.append((f, tail, int(rng.triangular(1, 180, 20))))  # more events in recent weeks
    records = []
    for number, (family, tail, days_ago) in enumerate(sorted(plan, key=lambda p: -p[2]), 1):
        ac = next(a for a in FLEET if a[0] == tail)
        description = rng.choice(families[family])
        event = now - timedelta(days=days_ago, hours=rng.randint(0, 20), minutes=rng.choice([0, 10, 25, 40, 55]))
        turnaround = rng.choice([0.5, 1, 2, 3, 5, 7, 10, 14, 21, 35])
        departure = event + timedelta(days=turnaround)
        idx = FLEET.index(ac)
        row = dict.fromkeys(database.FIELDS, '')
        row.update(source='Phone Transcript' if rng.random() < 0.45 else 'Email', customer=CUSTOMERS[ac[3]], aircraftId=tail,
                   aircraftLocation=rng.choices(LOCATIONS, weights=LOC_WEIGHTS)[0], eventTime=event.strftime('%Y-%m-%d %H:%M UTC'),
                   requestedDepartureDate=departure.strftime('%Y-%m-%d %H:%M UTC'),
                   engine1=f'DEMO-ENG-{idx * 2 + 1:05d}', engine2=f'DEMO-ENG-{idx * 2 + 2:05d}',
                   problemNotes=f'[SYNTHETIC DEMO] {description}')
        severe = any(k in description.lower() for k in ('shut down', 'shutdown', 'flamed out', 'fire warning'))
        level = 1 if turnaround <= 1 else 2 if turnaround <= 3 else 3 if turnaround <= 14 else 4 if turnaround <= 30 else 5
        if severe and 'ground' not in description.lower():
            level = min(level, 2)  # severe in-flight event: at least urgent
        row['priority'] = database.PRIORITIES[1 + level]
        gaps = [k for k, p in (('engine2', .12), ('aircraftLocation', .06), ('requestedDepartureDate', .1), ('eventTime', .05)) if rng.random() < p]
        for k in gaps:
            row[k] = ''
        if not row['requestedDepartureDate'] and not severe:
            row['priority'] = 'Pending'
        context = rng.choice(['Crew statement is preliminary; detailed EHM data has not been provided.',
            'The operator supplied an initial log extract; engineering findings are still pending.',
            'Ground observations are available; no validated root cause is recorded.',
            'Aircraft is AOG pending engineering disposition.'])
        row['problemNotes'] += ' ' + context
        row['assistantSuggestions'] = 'DEMO review questions only: confirm crew statement, affected engine and event sequence; request the relevant EHM extract.'
        if gaps:
            row['assistantSuggestions'] += ' Missing intake fields: ' + ', '.join(gaps) + '.'
        labels = {'customer':'Customer','aircraftId':'Aircraft ID','aircraftLocation':'Aircraft location','engine1':'Engine 1 Number',
                  'engine2':'Engine 2 Number','eventTime':'Event time','requestedDepartureDate':'Requested departure'}
        header = f'[{DATASET}:{number:03d}] SYNTHETIC TRAINING DATA — fictional operator, aircraft, engines and event.\n'
        header += 'Call transcript: Duty engineer reporting a new event.\n' if row['source'] == 'Phone Transcript' else 'Subject: Demo engine event report\n'
        header += '\n'.join(f'{label}: {row[key]}' for key, label in labels.items() if row[key])
        header += f'\nAircraft type: {ac[1]}\nEngine type: {ac[2]}\nFlight phase: {phase_of(description)}\nATA chapter: {ATA[family]}'
        row['originalText'] = header + '\n\n' + description + ' ' + context
        # Lifecycle: older events are mostly closed with a confirmed root cause, recent ones are still open.
        in_flight = days_ago == 0 and rng.random() < .5
        if days_ago > 14 and rng.random() < .8:
            decided = event + timedelta(hours=rng.uniform(.5, 6))
            row.update(status='Closed', rootCause=rng.choice(ROOT_CAUSES[family]), decision='approve-plan',
                       decisionBy='Demo Duty Engineer', decidedAt=decided.isoformat(),
                       closedAt=(decided + timedelta(hours=rng.uniform(6, 72))).isoformat(),
                       assignedResources='Demo Service Partner; Demo Parts Warehouse')
        else:
            row['status'] = 'In flight' if in_flight else rng.choice(['On ground', 'On ground', 'Inspection', 'Repair'])
            if rng.random() < .4 and not in_flight:
                row.update(decision=rng.choice(['approve-plan', 'request-information', 'escalate-engineering']),
                           decisionBy='Demo Duty Engineer', decidedAt=(event + timedelta(hours=rng.uniform(.5, 8))).isoformat())
        records.append({'demoKey': f'{DATASET}:{number:03d}', 'similarityFamily': family, 'case': row})
    return records


def main():
    if '--reset' in sys.argv and database.DB_PATH.exists():
        stamp = datetime.now().strftime('%Y%m%d-%H%M%S')
        database.DB_PATH.rename(database.DB_PATH.with_name(f'incidents-before-reset-{stamp}.db'))
    database.initialize()
    records = build_records()
    for entry in records:
        database.validate(entry['case'])
    assert len(records) == 50
    target = Path(__file__).resolve().parent / 'examples' / 'incidents-50.json'
    target.parent.mkdir(exist_ok=True)
    target.write_text(json.dumps(records, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    backup = database.DB_PATH.parent / ('before-demo-import-' + datetime.now().strftime('%Y%m%d-%H%M%S-%f') + '.db')
    with database.connection() as source:
        with sqlite3.connect(backup) as destination:
            source.backup(destination)
        existing = {row[0].split(']', 1)[0] + ']' for row in source.execute('SELECT originalText FROM incidents')}
    added = []
    for entry in records:
        marker = '[' + entry['demoKey'] + ']'
        if marker in existing:
            continue
        added.append(database.create(entry['case'])['caseId'])
        existing.add(marker)
    print(json.dumps({'added':len(added), 'firstId':added[0] if added else None, 'lastId':added[-1] if added else None,
        'activeCases':len(database.list_cases()), 'backup':str(backup),
        'families':dict(Counter(entry['similarityFamily'] for entry in records))}, indent=2))

if __name__ == '__main__':
    main()
