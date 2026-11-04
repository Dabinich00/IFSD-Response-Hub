import concurrent.futures
import json
import tempfile
import threading
import time
import unittest
import urllib.request
import urllib.error
from pathlib import Path
from unittest.mock import patch
from backend import extraction
import server

class ExtractionTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.path=patch.object(extraction,'CACHE_PATH',Path(self.temp.name)/'cache.db')
        self.path.start();extraction.initialize()
        self.fields={key:'' for key in extraction.FIELDS}
        self.fields.update(aircraftId='D-TEST',problemNotes='Vibration reported.')
    def tearDown(self):
        self.path.stop();self.temp.cleanup()

    def test_prefers_working_editor_cli_over_older_npm_cli(self):
        root=Path(self.temp.name)
        commands={'codex.cmd':str(root/'codex.cmd'),'codex.exe':str(root/'editor-codex.exe'),'node':'node.exe'}
        with patch.object(extraction.shutil,'which',side_effect=commands.get):
            self.assertEqual(extraction.command_prefix(),[commands['codex.exe']])

    def test_finds_editor_cli_when_not_on_path(self):
        root=Path(self.temp.name)
        executable=root/'.vscode'/'extensions'/'openai.chatgpt-demo'/'bin'/'windows-x86_64'/'codex.exe'
        executable.parent.mkdir(parents=True)
        executable.write_bytes(b'')
        with patch.object(extraction.Path,'home',return_value=root), patch.object(extraction.shutil,'which',return_value=None):
            self.assertEqual(extraction.command_prefix(),[str(executable)])
    def wait(self,key):
        for _ in range(100):
            result=extraction.get(key)
            if result['status']!='running':return result
            time.sleep(.02)
        self.fail('Job did not complete')
    def test_30_concurrent_clicks_and_restart_reuse_one_call(self):
        gate=threading.Event()
        def delayed(text):
            gate.wait(5);return self.fields
        with patch.object(extraction,'run_codex',side_effect=delayed) as run:
            with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
                jobs=list(pool.map(lambda _:extraction.submit('  Same report\r\nEngine 2  '),range(30)))
            self.assertEqual(len({j['job_id'] for j in jobs}),1)
            gate.set();self.assertEqual(self.wait(jobs[0]['job_id'])['status'],'done')
            extraction.initialize()
            again=extraction.submit('Same report\nEngine 2')
            self.assertTrue(again['cached'])
            self.assertEqual(run.call_count,1)
            self.assertEqual(extraction.get(again['job_id'])['fields'],self.fields)
    def test_changed_text_is_new_analysis(self):
        with patch.object(extraction,'run_codex',return_value=self.fields) as run:
            a=extraction.submit('Engine 1');self.wait(a['job_id'])
            b=extraction.submit('Engine 2');self.wait(b['job_id'])
            self.assertNotEqual(a['job_id'],b['job_id']);self.assertEqual(run.call_count,2)
    def test_errors_do_not_repeat_without_explicit_retry(self):
        with patch.object(extraction,'run_codex',side_effect=RuntimeError('Limit reached')) as run:
            job=extraction.submit('report');self.wait(job['job_id'])
            for _ in range(30):extraction.submit('report')
            self.assertEqual(run.call_count,1)
            extraction.submit('report',retry=True);self.wait(job['job_id'])
            self.assertEqual(run.call_count,2)
    def test_expired_job_requires_explicit_retry(self):
        with patch.object(extraction.threading,'Thread'):
            job=extraction.submit('interrupted')
        with extraction.connect() as db:
            db.execute('UPDATE extractions SET started=0')
        self.assertEqual(extraction.get(job['job_id'])['status'],'error')
        with patch.object(extraction,'run_codex') as run:
            self.assertTrue(extraction.submit('interrupted')['cached']);run.assert_not_called()
    def test_validation(self):
        for value in ('',None,{},'x'*20001):
            with self.assertRaises(ValueError):extraction.submit(value)
        with self.assertRaises(ValueError):extraction.validate({'caseId':'fake'})
        with self.assertRaises(ValueError):extraction.validate({**self.fields,'engine1':123})
        self.assertEqual(extraction.validate({key:None for key in extraction.FIELDS})['engine1'],'')
    def test_http_submit_poll_reuse_and_cross_origin_rejection(self):
        httpd=server.ThreadingHTTPServer(('127.0.0.1',0),server.IFSDHandler)
        threading.Thread(target=httpd.serve_forever,daemon=True).start()
        url='http://127.0.0.1:'+str(httpd.server_port)
        def post(origin=None):
            headers={'Content-Type':'application/json'}
            if origin:headers['Origin']=origin
            request=urllib.request.Request(url+'/api/extractions',data=json.dumps({'text':'Test report'}).encode(),headers=headers)
            return urllib.request.urlopen(request)
        try:
            with patch.object(extraction,'run_codex',return_value=self.fields) as run:
                with post() as response:
                    self.assertEqual(response.status,202);job=json.load(response)
                self.wait(job['job_id'])
                with urllib.request.urlopen(url+'/api/extractions/'+job['job_id']) as response:
                    self.assertEqual(json.load(response)['fields']['aircraftId'],'D-TEST')
                with post() as response:self.assertTrue(json.load(response)['cached'])
                self.assertEqual(run.call_count,1)
                with self.assertRaises(urllib.error.HTTPError) as error:post('http://other.example')
                self.assertEqual(error.exception.code,400)
        finally:
            httpd.shutdown();httpd.server_close()

if __name__=='__main__':unittest.main()
