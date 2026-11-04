"""Tests for the optional Ollama extraction, using a fake local Ollama server."""
import json
import threading
import unittest
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import patch

import extraction
import server

TEXT = ('Hi, this is ops at Demo Northstar Air. Our aircraft DEMO-AC-017 had engine 2 shut down '
        'after vibration. Engine 2 is DEMO-ENG-01734. We diverted to Shannon. We need it back tomorrow.')


class FakeOllama(BaseHTTPRequestHandler):
    models = [{'name': 'nomic-embed-text:latest'}, {'name': 'llama3.2:3b'}]
    reply = {}
    requests = []

    def log_message(self, *args):
        pass

    def send(self, payload):
        body = json.dumps(payload).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        self.send({'models': self.models})

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        FakeOllama.requests.append(body)
        self.send({'message': {'content': json.dumps(FakeOllama.reply)}})


class ExtractionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ollama = ThreadingHTTPServer(('127.0.0.1', 0), FakeOllama)
        threading.Thread(target=cls.ollama.serve_forever, daemon=True).start()
        cls.app = server.ThreadingHTTPServer(('127.0.0.1', 0), server.IFSDHandler)
        threading.Thread(target=cls.app.serve_forever, daemon=True).start()
        cls.url = f'http://127.0.0.1:{cls.app.server_port}'

    @classmethod
    def tearDownClass(cls):
        for httpd in (cls.ollama, cls.app):
            httpd.shutdown()
            httpd.server_close()

    def setUp(self):
        self.patch = patch.object(extraction, 'OLLAMA_URL', f'http://127.0.0.1:{self.ollama.server_port}')
        self.patch.start()
        FakeOllama.requests = []
        FakeOllama.reply = {'customer': 'Demo Northstar Air', 'aircraftId': 'DEMO-AC-017', 'aircraftLocation': 'Shannon',
            'eventTime': '', 'requestedDepartureDate': 'tomorrow', 'engine1': 'DEMO-ENG-99999',
            'engine2': 'DEMO-ENG-01734', 'problemNotes': 'Engine 2 was shut down after vibration; diverted to Shannon.'}

    def tearDown(self):
        self.patch.stop()

    def post(self, path, payload):
        req = urllib.request.Request(self.url + path, data=json.dumps(payload).encode(), method='POST',
                                     headers={'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req) as response:
                return response.status, json.loads(response.read())
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read())

    def test_picks_chat_model_and_skips_embeddings(self):
        self.assertEqual(extraction.pick_model(), 'llama3.2:3b')

    def test_invented_identifiers_are_dropped(self):
        result = extraction.extract(TEXT)
        fields = result['fields']
        self.assertEqual(result['model'], 'llama3.2:3b')
        self.assertEqual(fields['aircraftId'], 'DEMO-AC-017')
        self.assertEqual(fields['engine2'], 'DEMO-ENG-01734')
        self.assertEqual(fields['engine1'], '')          # not in the text -> rejected
        self.assertEqual(fields['customer'], 'Demo Northstar Air')
        self.assertEqual(FakeOllama.requests[0]['options']['temperature'], 0)

    def test_unknown_location_is_dropped(self):
        FakeOllama.reply['aircraftLocation'] = 'Reykjavik'
        self.assertEqual(extraction.extract(TEXT)['fields']['aircraftLocation'], '')

    def test_api_endpoint_and_status(self):
        status, body = self.post('/api/extract', {'text': TEXT})
        self.assertEqual(status, 200)
        self.assertEqual(body['fields']['aircraftId'], 'DEMO-AC-017')
        with urllib.request.urlopen(self.url + '/api/extract/status') as response:
            self.assertEqual(json.loads(response.read()), {'available': True, 'model': 'llama3.2:3b'})
        self.assertEqual(self.post('/api/extract', {'text': ''})[0], 400)

    def test_unavailable_ollama_returns_503(self):
        with patch.object(extraction, 'OLLAMA_URL', 'http://127.0.0.1:9'):
            status, body = self.post('/api/extract', {'text': TEXT})
            self.assertEqual(status, 503)
            self.assertIn('not reachable', body['error'])
            self.assertFalse(extraction.status()['available'])

    def test_vendor_assets_served_without_traversal(self):
        with urllib.request.urlopen(self.url + '/vendor/leaflet/leaflet.js') as response:
            self.assertEqual(response.status, 200)
        for path in ('/vendor/../server.py', '/vendor/%2e%2e/server.py', '/vendor/README.md', '/vendor/leaflet/'):
            with self.assertRaises(urllib.error.HTTPError, msg=path) as ctx:
                urllib.request.urlopen(self.url + path)
            self.assertEqual(ctx.exception.code, 404, path)


if __name__ == '__main__':
    unittest.main()
