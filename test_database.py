import concurrent.futures
import json
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path
from unittest.mock import patch
import database
import server

class DatabaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.patch = patch.object(database, 'DB_PATH', Path(self.temp.name) / 'incidents.db')
        self.patch.start()
        database.initialize()
        self.payload = {key: '' for key in database.FIELDS}
        self.payload.update(source='Email', customer='Example Air', aircraftId='D-TEST',
            problemNotes='Engine 2 shutdown', originalText='Original message',
            engine2='ENG-123', priority='Pending')

    def tearDown(self):
        self.patch.stop()
        self.temp.cleanup()

    def test_all_fields_persist_and_id_is_server_assigned(self):
        self.payload['caseId'] = 'FORGED'
        row = database.create(self.payload)
        self.assertRegex(row['caseId'], r'^IFSD-\d{4}-\d{4}-\d{6,}$')
        database.initialize()
        saved = database.get(row['caseId'])
        for key in database.FIELDS:
            self.assertEqual(saved[key], self.payload[key])
        self.assertEqual(saved['revision'], 1)

    def test_concurrent_ids_are_unique_and_not_reused(self):
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            rows = list(pool.map(lambda _: database.create(self.payload), range(20)))
        self.assertEqual(len({row['caseId'] for row in rows}), 20)
        database.change(rows[-1]['caseId'], rows[-1], 'deleted')
        new = database.create(self.payload)
        self.assertNotIn(new['caseId'], [row['caseId'] for row in rows])

    def test_update_conflict_trash_restore_and_history(self):
        row = database.create(self.payload)
        edited = database.change(row['caseId'], {**row, 'customer': 'Changed'})
        self.assertEqual(edited['caseId'], row['caseId'])
        self.assertEqual(edited['customer'], 'Changed')
        with self.assertRaises(database.ConflictError):
            database.change(row['caseId'], row)
        deleted = database.change(row['caseId'], edited, 'deleted')
        self.assertEqual(database.list_cases(), [])
        self.assertEqual(len(database.list_cases(deleted=True)), 1)
        with self.assertRaises(database.ConflictError):
            database.change(row['caseId'], deleted)
        restored = database.change(row['caseId'], deleted, 'restored')
        self.assertIsNone(restored['deletedAt'])
        self.assertEqual(len(database.list_cases('changed')), 1)
        with database.connection() as db:
            self.assertEqual(db.execute('SELECT count(*) FROM incident_history').fetchone()[0], 4)

    def test_validation_and_literal_search(self):
        for changes in ({'source': 'Other'}, {'problemNotes': ' '}, {'engine1': []}, {'priority': 'urgent'}):
            with self.assertRaises(ValueError):
                database.create({**self.payload, **changes})
        database.create(self.payload)
        self.assertEqual(database.list_cases("' OR 1=1 --"), [])

    def test_expert_decision_persists_and_requires_expert(self):
        row = database.create(self.payload)
        self.assertEqual(row['decision'], '')
        decided = database.change(row['caseId'], {**row, 'decision': 'approve-plan', 'decisionBy': 'Demo Expert',
            'decisionNote': 'Send field team', 'assignedResources': 'Shannon service partner', 'decidedAt': '2026-11-04T12:00Z'})
        self.assertEqual(database.get(row['caseId'])['decision'], 'approve-plan')
        self.assertEqual(decided['assignedResources'], 'Shannon service partner')
        with self.assertRaises(ValueError):
            database.change(row['caseId'], {**decided, 'decisionBy': ''})
        with self.assertRaises(ValueError):
            database.change(row['caseId'], {**decided, 'decision': 'auto-approve'})

    def test_v1_database_is_migrated_without_data_loss(self):
        with database.connection() as db:
            db.execute('DROP TABLE incident_history')
            db.execute('DROP TABLE incidents')
            db.execute('''CREATE TABLE incidents (id INTEGER PRIMARY KEY AUTOINCREMENT, caseId TEXT UNIQUE,
                source TEXT NOT NULL, customer TEXT NOT NULL DEFAULT '', aircraftId TEXT NOT NULL DEFAULT '',
                aircraftLocation TEXT NOT NULL DEFAULT '', priority TEXT NOT NULL DEFAULT '', eventTime TEXT NOT NULL DEFAULT '',
                requestedDepartureDate TEXT NOT NULL DEFAULT '', engine1 TEXT NOT NULL DEFAULT '', engine2 TEXT NOT NULL DEFAULT '',
                problemNotes TEXT NOT NULL, assistantSuggestions TEXT NOT NULL DEFAULT '', originalText TEXT NOT NULL DEFAULT '',
                createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, deletedAt TEXT, revision INTEGER NOT NULL DEFAULT 1)''')
            db.execute("INSERT INTO incidents (caseId, source, problemNotes, createdAt, updatedAt) VALUES ('OLD-1', 'Email', 'kept', 'x', 'x')")
            db.execute('PRAGMA user_version = 1')
        database.initialize()
        old = database.get('OLD-1')
        self.assertEqual(old['problemNotes'], 'kept')
        self.assertEqual(old['decision'], '')
        with database.connection() as db:
            self.assertEqual(db.execute('PRAGMA user_version').fetchone()[0], database.SCHEMA_VERSION)

    def test_ehm_source_lifecycle_and_old_check_migration(self):
        row = database.create({**self.payload, 'source': 'EHM Alert', 'status': 'In flight'})
        self.assertEqual(row['status'], 'In flight')
        with self.assertRaises(ValueError):
            database.change(row['caseId'], {**row, 'status': 'Closed'})
        closed = database.change(row['caseId'], {**row, 'status': 'Closed', 'rootCause': 'Worn bearing seal', 'closedAt': 'x'})
        self.assertEqual(closed['rootCause'], 'Worn bearing seal')
        # a v2 database with the old CHECK constraint is rebuilt without losing rows or history
        with database.connection() as db:
            db.execute('DROP TABLE incident_history'); db.execute('DROP TABLE incidents')
            cols = ', '.join(f"{f} TEXT NOT NULL DEFAULT ''" for f in database.FIELDS + database.DECISION_FIELDS if f not in ('source', 'problemNotes'))
            db.execute(f"""CREATE TABLE incidents (id INTEGER PRIMARY KEY AUTOINCREMENT, caseId TEXT UNIQUE,
                source TEXT NOT NULL CHECK(source IN ('Email', 'Phone Transcript')), problemNotes TEXT NOT NULL, {cols},
                createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, deletedAt TEXT, revision INTEGER NOT NULL DEFAULT 1)""")
            db.execute("INSERT INTO incidents (caseId, source, problemNotes, createdAt, updatedAt) VALUES ('OLD-2', 'Email', 'kept', 'x', 'x')")
        database.initialize()
        old = database.get('OLD-2')
        self.assertEqual(old['problemNotes'], 'kept')
        moved = database.change('OLD-2', {**{k: '' for k in database.FIELDS}, **old, 'source': 'EHM Alert', 'problemNotes': 'kept'})
        self.assertEqual(moved['source'], 'EHM Alert')
        self.assertEqual(len(database.history_for('OLD-2')), 1)

    def test_history_lists_changes_oldest_first(self):
        row = database.create(self.payload)
        database.change(row['caseId'], {**row, 'priority': '1 - Most urgent'})
        hist = database.history_for(row['caseId'])
        self.assertEqual([h['action'] for h in hist], ['created', 'updated'])
        self.assertEqual(hist[1]['fields']['priority'], '1 - Most urgent')
        with self.assertRaises(KeyError):
            database.history_for('missing')

class APITests(DatabaseTests):
    def setUp(self):
        super().setUp()
        self.httpd = server.ThreadingHTTPServer(('127.0.0.1', 0), server.IFSDHandler)
        self.url = 'http://127.0.0.1:' + str(self.httpd.server_port)
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()

    def tearDown(self):
        self.httpd.shutdown()
        self.httpd.server_close()
        super().tearDown()

    def request(self, path, method='GET', body=None):
        req = urllib.request.Request(self.url + path, method=method,
            data=json.dumps(body).encode() if body is not None else None,
            headers={'Content-Type': 'application/json'})
        try:
            response = urllib.request.urlopen(req)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            content = response.read()
            return response.status, json.loads(content) if response.headers.get_content_type() == 'application/json' else content

    def test_http_lifecycle(self):
        status, row = self.request('/api/cases', 'POST', self.payload)
        self.assertEqual(status, 201)
        path = '/api/cases/' + row['caseId']
        self.assertEqual(self.request(path)[1]['aircraftId'], 'D-TEST')
        status, updated = self.request(path, 'PUT', {**row, 'engine1': 'NEW-123'})
        self.assertEqual(status, 200)
        self.assertEqual(updated['engine1'], 'NEW-123')
        self.assertEqual(self.request(path, 'PUT', row)[0], 409)
        status, deleted = self.request(path, 'DELETE', updated)
        self.assertEqual(status, 200)
        self.assertEqual(self.request('/api/cases')[1], [])
        self.assertEqual(self.request(path + '/restore', 'POST', deleted)[0], 200)
        self.assertEqual(self.request('/api/cases', 'POST', {})[0], 400)
        self.assertEqual(self.request('/api/cases/does-not-exist')[0], 404)

    def test_private_files_and_head_are_not_served(self):
        for path in ('/data/incidents.db', '/data/incidents.db-journal', '/database.py', '/.git/config', '/%64ata/incidents.db', '/../server.py'):
            for method in ('GET', 'HEAD'):
                self.assertEqual(self.request(path, method)[0], 404, path)
        self.assertEqual(self.request('/')[0], 200)

if __name__ == '__main__':
    unittest.main()
