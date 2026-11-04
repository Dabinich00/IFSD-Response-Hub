import io
import json
import threading
import time
import unittest
import urllib.request
import wave
from types import SimpleNamespace
from unittest.mock import patch
import server

class TranscriptionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd = server.ThreadingHTTPServer(('127.0.0.1', 0), server.IFSDHandler)
        cls.url = 'http://127.0.0.1:' + str(cls.httpd.server_port)
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()

    def submit(self):
        audio = io.BytesIO()
        with wave.open(audio, 'wb') as out:
            out.setnchannels(1)
            out.setsampwidth(2)
            out.setframerate(16000)
            out.writeframes(bytes(32000))
        req = urllib.request.Request(self.url + '/api/transcribe', data=audio.getvalue(), headers={'Content-Type': 'audio/wav'})
        with urllib.request.urlopen(req, timeout=3) as response:
            self.assertEqual(response.status, 202)
            return json.load(response)['job_id']

    def wait_result(self, job_id):
        for _ in range(300):
            with urllib.request.urlopen(self.url + '/api/transcriptions/' + job_id, timeout=3) as response:
                result = json.load(response)
            if result['status'] in ('done', 'error'):
                return result
            time.sleep(.1)
        self.fail('Job did not finish')

    def test_1_delayed_result_survives_closed_upload_connection(self):
        release = threading.Event()
        def transcribe(*args, **kwargs):
            release.wait(5)
            return iter([SimpleNamespace(text=' Engine two shutdown. ')]), SimpleNamespace(language='en')
        with patch.object(server, 'get_model', return_value=SimpleNamespace(transcribe=transcribe)):
            job_id = self.submit()
            try:
                with urllib.request.urlopen(self.url + '/api/transcriptions/' + job_id) as response:
                    self.assertIn(json.load(response)['status'], ('queued', 'loading', 'transcribing'))
            finally:
                release.set()
            result = self.wait_result(job_id)
            self.assertEqual(result['text'], 'Engine two shutdown.')
            self.assertEqual(self.wait_result(job_id)['text'], result['text'])

    def test_2_real_whisper_silence_returns_job_error(self):
        from faster_whisper import WhisperModel
        model = WhisperModel('base', device='cpu', compute_type='int8', local_files_only=True)
        with patch.object(server, 'get_model', return_value=model):
            result = self.wait_result(self.submit())
        self.assertEqual(result['status'], 'error')
        self.assertIn('Keine Sprache erkannt', result['error'])

if __name__ == '__main__':
    unittest.main()
