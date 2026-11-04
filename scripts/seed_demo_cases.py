"""Import 50 explicitly synthetic cases; reruns skip existing dataset markers."""
import json
import sqlite3
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
from backend import database

DATASET = 'IFSD-DEMO-50-v1'
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


def build_records():
    records = []
    for family_index, (family, descriptions) in enumerate(FAMILIES):
        for variant, description in enumerate(descriptions):
            number = family_index * 5 + variant + 1
            # Repeated tails within a family, plus cross-family links across the fleet.
            aircraft = (family_index * 2 + [0, 1, 2, 0, 1][variant]) % 15
            event = datetime(2026, 1, 5, 7, 20, tzinfo=timezone.utc) + timedelta(days=number * 5, hours=number % 7)
            departure = event + timedelta(days=[1, 3, 7, 15, 35][variant])
            engine1 = f'DEMO-ENG-{aircraft * 2 + 1:05d}'
            engine2 = f'DEMO-ENG-{aircraft * 2 + 2:05d}'
            # A documented simulated engine transfer links different aircraft.
            transfer = aircraft == 0 and event.month >= 6
            if transfer:
                engine1 = 'DEMO-ENG-00003'
            elif aircraft == 1 and event.month >= 6:
                engine1 = 'DEMO-ENG-90003'
            row = dict.fromkeys(database.FIELDS, '')
            row.update(source='Phone Transcript' if number % 2 == 0 else 'Email',
                customer=CUSTOMERS[aircraft // 3], aircraftId=f'DEMO-AC-{aircraft + 1:03d}',
                aircraftLocation=LOCATIONS[(family_index + variant * 3) % len(LOCATIONS)],
                priority=database.PRIORITIES[2 + variant], eventTime=event.strftime('%Y-%m-%d %H:%M UTC'),
                requestedDepartureDate=departure.strftime('%Y-%m-%d %H:%M UTC'), engine1=engine1, engine2=engine2,
                problemNotes=f'[SYNTHETIC DEMO] {description}')
            gaps = []
            for modulus, key in [(7, 'requestedDepartureDate'), (9, 'engine2'), (11, 'eventTime'), (13, 'aircraftLocation'), (17, 'engine1')]:
                if number % modulus == 0:
                    row[key] = ''
                    gaps.append(key)
            if not row['requestedDepartureDate']:
                row['priority'] = 'Pending'
            context = ['Crew statement is preliminary; detailed EHM data has not been provided.',
                'The operator supplied an initial log extract; engineering findings are still pending.',
                'The report uses approximate observations; no diagnosis has been verified.',
                'A prior related report is mentioned; this is a separate event, not a duplicate message.',
                'Ground observations are available; no validated root cause is recorded.'][variant]
            if transfer:
                context += ' Fictional fleet log: DEMO-ENG-00003 transferred from DEMO-AC-002 to DEMO-AC-001 on 2026-06-01.'
            row['problemNotes'] += ' ' + context
            row['assistantSuggestions'] = 'DEMO review questions only: confirm crew statement, affected engine and event sequence; request the relevant EHM extract.'
            if gaps:
                row['assistantSuggestions'] += ' Missing intake fields: ' + ', '.join(gaps) + '.'
            row['originalText'] = f'[{DATASET}:{number:03d}] SYNTHETIC TRAINING DATA — fictional operator, aircraft, engines and event.\n'
            row['originalText'] += ('Call transcript: Duty engineer reporting a new event.\n' if row['source'] == 'Phone Transcript' else 'Subject: Demo engine event report\n')
            labels = {'customer':'Customer', 'aircraftId':'Aircraft ID', 'aircraftLocation':'Aircraft location',
                'engine1':'Engine 1 Number', 'engine2':'Engine 2 Number', 'eventTime':'Event time', 'requestedDepartureDate':'Requested departure'}
            row['originalText'] += '\n'.join(f'{label}: {row[key]}' for key, label in labels.items() if row[key])
            row['originalText'] += '\n\n' + description + ' ' + context
            records.append({'demoKey':f'{DATASET}:{number:03d}', 'similarityFamily':family, 'case':row})
    return records


def main():
    database.initialize()
    records = build_records()
    for entry in records:
        database.validate(entry['case'])
    assert len(records) == 50
    target = Path(__file__).resolve().parent.parent / 'examples' / 'incidents-50.json'
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
