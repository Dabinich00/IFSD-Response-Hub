"""Local incident storage. Every form field has a matching database column."""
import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from .date_fields import normalize_date

DB_PATH = Path(__file__).resolve().parent.parent / 'data' / 'incidents.db'
FIELDS = ('source', 'customer', 'aircraftId', 'aircraftLocation', 'priority',
          'eventTime', 'requestedDepartureDate', 'engine1', 'engine2',
          'problemNotes', 'assistantSuggestions', 'originalText')
PRIORITIES = ('', 'Pending', '1 - Most urgent', '2 - Urgent', '3 - Medium',
              '4 - Low', '5 - Lowest')
# Human-in-the-loop decision recorded by an authorized expert in the response
# workspace. Kept separate from the intake FIELDS so fixtures stay unchanged.
DECISION_FIELDS = ('decision', 'decisionBy', 'decisionNote', 'assignedResources', 'decidedAt')
DECISIONS = ('', 'approve-plan', 'request-information', 'escalate-engineering', 'monitor-only')
ALL_FIELDS = FIELDS + DECISION_FIELDS
SCHEMA_VERSION = 2

class ConflictError(Exception):
    pass

@contextmanager
def connection():
    db = sqlite3.connect(DB_PATH, timeout=15)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys = ON')
    try:
        with db:
            yield db
    finally:
        db.close()

def initialize():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with connection() as db:
        db.executescript('''
        CREATE TABLE IF NOT EXISTS incidents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            caseId TEXT UNIQUE,
            source TEXT NOT NULL CHECK(source IN ('Email', 'Phone Transcript')),
            customer TEXT NOT NULL DEFAULT '',
            aircraftId TEXT NOT NULL DEFAULT '',
            aircraftLocation TEXT NOT NULL DEFAULT '',
            priority TEXT NOT NULL DEFAULT '',
            eventTime TEXT NOT NULL DEFAULT '',
            requestedDepartureDate TEXT NOT NULL DEFAULT '',
            engine1 TEXT NOT NULL DEFAULT '',
            engine2 TEXT NOT NULL DEFAULT '',
            problemNotes TEXT NOT NULL CHECK(length(trim(problemNotes)) > 0),
            assistantSuggestions TEXT NOT NULL DEFAULT '',
            originalText TEXT NOT NULL DEFAULT '',
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL,
            deletedAt TEXT,
            revision INTEGER NOT NULL DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS incident_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            incidentId INTEGER NOT NULL REFERENCES incidents(id),
            action TEXT NOT NULL,
            recordedAt TEXT NOT NULL,
            snapshot TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS incidents_deleted ON incidents(deletedAt);
        ''')
        # Schema v2: add decision columns to existing databases without losing data.
        existing = {row['name'] for row in db.execute('PRAGMA table_info(incidents)')}
        for field in DECISION_FIELDS:
            if field not in existing:
                db.execute(f"ALTER TABLE incidents ADD COLUMN {field} TEXT NOT NULL DEFAULT ''")
        db.execute(f'PRAGMA user_version = {SCHEMA_VERSION}')

def now():
    return datetime.now(timezone.utc).isoformat(timespec='microseconds')

def validate(payload):
    if not isinstance(payload, dict):
        raise ValueError('Case must be a JSON object.')
    result = {}
    for field in ALL_FIELDS:
        value = payload.get(field, '')
        limit = 50000 if field in ('originalText', 'problemNotes', 'assistantSuggestions', 'decisionNote') else 500
        if not isinstance(value, str) or len(value) > limit:
            raise ValueError(f'{field}: expected text, maximum {limit} characters.')
        result[field] = value.strip()
    if result['source'] not in ('Email', 'Phone Transcript'):
        raise ValueError('Select Email or Phone Transcript as source.')
    if not result['problemNotes']:
        raise ValueError('Problem / Notes is required before saving.')
    if result['priority'] not in PRIORITIES:
        raise ValueError('Invalid priority.')
    if result['decision'] not in DECISIONS:
        raise ValueError('Invalid expert decision.')
    if result['decision'] and not result['decisionBy']:
        raise ValueError('An expert decision requires the name of the deciding expert.')
    for field in ('eventTime', 'requestedDepartureDate'):
        try:
            result[field] = normalize_date(result[field])
        except ValueError as error:
            raise ValueError(f'{field}: enter a valid date as DD.MM.YYYY, or leave it empty.') from error
    return result

def history(db, row, action):
    db.execute('INSERT INTO incident_history (incidentId, action, recordedAt, snapshot) VALUES (?, ?, ?, ?)',
               (row['id'], action, now(), json.dumps(dict(row), ensure_ascii=False)))

def create(payload):
    values = validate(payload)
    stamp = now()
    with connection() as db:
        columns = ', '.join(ALL_FIELDS)
        placeholders = ', '.join('?' for _ in ALL_FIELDS)
        cursor = db.execute(f'INSERT INTO incidents ({columns}, createdAt, updatedAt) VALUES ({placeholders}, ?, ?)',
                            (*values.values(), stamp, stamp))
        number = cursor.lastrowid
        case_id = f"IFSD-{datetime.fromisoformat(stamp):%Y-%m%d}-{number:06d}"
        db.execute('UPDATE incidents SET caseId = ? WHERE id = ?', (case_id, number))
        row = db.execute('SELECT * FROM incidents WHERE id = ?', (number,)).fetchone()
        history(db, row, 'created')
        return dict(row)

def get(case_id):
    with connection() as db:
        row = db.execute('SELECT * FROM incidents WHERE caseId = ?', (case_id,)).fetchone()
        if row is None:
            raise KeyError(case_id)
        return dict(row)

def list_cases(query='', deleted=False):
    with connection() as db:
        rows = db.execute('''SELECT caseId, source, customer, aircraftId, aircraftLocation,
            priority, eventTime, requestedDepartureDate, engine1, engine2, substr(problemNotes, 1, 160) AS problemNotes,
            decision, createdAt, updatedAt, deletedAt, revision FROM incidents
            WHERE (deletedAt IS NOT NULL) = ? AND
            instr(lower(caseId || ' ' || customer || ' ' || aircraftId || ' ' ||
            aircraftLocation || ' ' || problemNotes), lower(?)) > 0 ORDER BY id DESC''',
            (int(deleted), query)).fetchall()
        return [dict(row) for row in rows]

def change(case_id, payload, action='updated'):
    if not isinstance(payload, dict) or type(payload.get('revision')) is not int:
        raise ValueError('A revision number is required. Reopen the case.')
    values = validate(payload) if action == 'updated' else None
    with connection() as db:
        db.execute('BEGIN IMMEDIATE')
        row = db.execute('SELECT * FROM incidents WHERE caseId = ?', (case_id,)).fetchone()
        if row is None:
            raise KeyError(case_id)
        if row['revision'] != payload['revision']:
            raise ConflictError('This case changed in another window. Reopen it before saving.')
        if action == 'updated' and row['deletedAt']:
            raise ConflictError('Restore this case before editing.')
        stamp = now()
        if values is not None:
            assignments = ', '.join(f'{key} = ?' for key in ALL_FIELDS)
            db.execute(f'UPDATE incidents SET {assignments}, updatedAt = ?, revision = revision + 1 WHERE caseId = ?',
                       (*values.values(), stamp, case_id))
        else:
            db.execute('UPDATE incidents SET deletedAt = ?, updatedAt = ?, revision = revision + 1 WHERE caseId = ?',
                       (stamp if action == 'deleted' else None, stamp, case_id))
        result = db.execute('SELECT * FROM incidents WHERE caseId = ?', (case_id,)).fetchone()
        history(db, result, action)
        return dict(result)
