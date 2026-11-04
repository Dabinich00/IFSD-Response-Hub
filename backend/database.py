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
        PRAGMA user_version = 1;
        ''')

def now():
    return datetime.now(timezone.utc).isoformat(timespec='microseconds')

def validate(payload):
    if not isinstance(payload, dict):
        raise ValueError('Case must be a JSON object.')
    result = {}
    for field in FIELDS:
        value = payload.get(field, '')
        limit = 50000 if field in ('originalText', 'problemNotes', 'assistantSuggestions') else 500
        if not isinstance(value, str) or len(value) > limit:
            raise ValueError(f'{field}: expected text, maximum {limit} characters.')
        result[field] = value.strip()
    if result['source'] not in ('Email', 'Phone Transcript'):
        raise ValueError('Select Email or Phone Transcript as source.')
    if not result['problemNotes']:
        raise ValueError('Problem / Notes is required before saving.')
    if result['priority'] not in PRIORITIES:
        raise ValueError('Invalid priority.')
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
        columns = ', '.join(FIELDS)
        placeholders = ', '.join('?' for _ in FIELDS)
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
            priority, eventTime, substr(problemNotes, 1, 160) AS problemNotes,
            createdAt, updatedAt, deletedAt, revision FROM incidents
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
            assignments = ', '.join(f'{key} = ?' for key in FIELDS)
            db.execute(f'UPDATE incidents SET {assignments}, updatedAt = ?, revision = revision + 1 WHERE caseId = ?',
                       (*values.values(), stamp, case_id))
        else:
            db.execute('UPDATE incidents SET deletedAt = ?, updatedAt = ?, revision = revision + 1 WHERE caseId = ?',
                       (stamp if action == 'deleted' else None, stamp, case_id))
        result = db.execute('SELECT * FROM incidents WHERE caseId = ?', (case_id,)).fetchone()
        history(db, result, action)
        return dict(result)
