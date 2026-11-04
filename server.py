"""Local static server and faster-whisper transcription endpoint."""

from __future__ import annotations

import json
import os
import tempfile
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
import sqlite3
import database
import extraction
import weather
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

HOST = "127.0.0.1"
PORT = int(os.environ.get("IFSD_PORT", "8000"))
MAX_AUDIO_BYTES = 25 * 1024 * 1024
MODEL_NAME = os.environ.get("WHISPER_MODEL", "base")
_model = None
_jobs = {}
_jobs_lock = threading.Lock()
_worker = ThreadPoolExecutor(max_workers=1)


def transcribe_job(job_id, temp_path, language):
    def update(**values):
        with _jobs_lock:
            _jobs[job_id].update(values)

    try:
        update(status="loading")
        model = get_model()
        update(status="transcribing")
        segments, info = model.transcribe(
            str(temp_path), language=language, beam_size=5, vad_filter=True
        )
        text = " ".join(segment.text.strip() for segment in segments).strip()
        if not text:
            raise ValueError("No speech detected")
        update(status="done", text=text, language=info.language)
    except ImportError:
        update(status="error", error="Speech-to-text is not installed. Run: python3 -m pip install -r requirements.txt, then restart the server.")
    except Exception as error:
        update(status="error", error=f"Transcription failed: {error}")
    finally:
        temp_path.unlink(missing_ok=True)
        update(finished_at=time.monotonic())


def get_model():
    global _model
    if _model is None:
        from faster_whisper import WhisperModel

        _model = WhisperModel(MODEL_NAME, device="cpu", compute_type="int8")
    return _model


class IFSDHandler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.woff2': 'font/woff2', '.geojson': 'application/geo+json'}

    def end_headers(self):
        # Always revalidate static files so the browser never shows a stale version after an update.
        if not any(b'Cache-Control' in line for line in getattr(self, '_headers_buffer', [])):
            self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def send_head(self):
        # Serve only public assets; never expose the database, source or Git files.
        path = urlparse(self.path).path
        if path not in ('/', '/index.html', '/app.js', '/overview.js', '/forecast.js', '/styles.css') and not self.is_vendor_asset(path):
            self.send_error(HTTPStatus.NOT_FOUND)
            return None
        return super().send_head()

    @staticmethod
    def is_vendor_asset(path):
        # Bundled third-party assets (Leaflet, offline world map) so the demo works without internet.
        if not path.startswith('/vendor/') or '..' in path or '%' in path or '\\' in path:
            return False
        vendor = (Path(__file__).resolve().parent / 'vendor').resolve()
        target = (vendor / path[len('/vendor/'):]).resolve()
        return (target.is_file() and vendor in target.parents
                and target.suffix in ('.js', '.css', '.png', '.json', '.geojson', '.woff2'))

    def extract_api(self):
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 256 * 1024:
                raise ValueError('Invalid request size.')
            payload = json.loads(self.rfile.read(length))
            if not isinstance(payload, dict) or not isinstance(payload.get('text'), str):
                raise ValueError('Expected {"text": "..."}.')
            self.send_json(extraction.extract(payload['text']))
        except (ValueError, UnicodeError) as error:
            self.send_json({'error': str(error)}, HTTPStatus.BAD_REQUEST)
        except extraction.ExtractionUnavailable as error:
            self.send_json({'error': str(error)}, HTTPStatus.SERVICE_UNAVAILABLE)

    def case_api(self):
        parsed = urlparse(self.path)
        parts = parsed.path.strip('/').split('/')
        try:
            if self.command == 'GET':
                if len(parts) == 2:
                    query = parse_qs(parsed.query)
                    result = database.list_cases(query.get('q', [''])[0], query.get('deleted', ['0'])[0] == '1')
                elif len(parts) == 3:
                    result = database.get(parts[2])
                elif len(parts) == 4 and parts[3] == 'history':
                    result = database.history_for(parts[2])
                else:
                    raise KeyError(parsed.path)
                self.send_json(result)
                return
            if self.headers.get('Content-Type', '').split(';')[0].strip() != 'application/json':
                raise ValueError('Content-Type must be application/json.')
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 1024 * 1024:
                raise ValueError('Invalid request size (maximum 1 MB).')
            payload = json.loads(self.rfile.read(length))
            if self.command == 'POST' and len(parts) == 2:
                result = database.create(payload)
                self.send_json(result, HTTPStatus.CREATED)
                return
            if self.command == 'PUT' and len(parts) == 3:
                result = database.change(parts[2], payload)
            elif self.command == 'DELETE' and len(parts) == 3:
                result = database.change(parts[2], payload, 'deleted')
            elif self.command == 'POST' and len(parts) == 4 and parts[3] == 'restore':
                result = database.change(parts[2], payload, 'restored')
            else:
                raise KeyError(parsed.path)
            self.send_json(result)
        except KeyError:
            self.send_json({'error': 'Case not found.'}, HTTPStatus.NOT_FOUND)
        except (ValueError, UnicodeError) as error:
            self.send_json({'error': str(error)}, HTTPStatus.BAD_REQUEST)
        except database.ConflictError as error:
            self.send_json({'error': str(error)}, HTTPStatus.CONFLICT)
        except sqlite3.Error:
            self.send_json({'error': 'Database unavailable. Please retry.'}, HTTPStatus.SERVICE_UNAVAILABLE)

    def do_PUT(self):
        if urlparse(self.path).path.startswith('/api/cases/'):
            self.case_api()
        else:
            self.send_error(HTTPStatus.NOT_FOUND)

    def do_DELETE(self):
        self.do_PUT()

    def send_json(self, payload: dict, status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        try:
            self.end_headers()
            self.wfile.write(body)
        except (ConnectionError, BrokenPipeError):
            self.log_message("Client disconnected; response could not be delivered")

    def do_GET(self):
        path = urlparse(self.path).path
        if path == '/api/cases' or path.startswith('/api/cases/'):
            self.case_api()
            return
        if path.startswith('/api/weather/'):
            self.send_json(weather.metar(path.rsplit('/', 1)[-1]))
            return
        if path == '/api/extract/status':
            self.send_json(extraction.status())
            return
        if path.startswith("/api/transcriptions/"):
            with _jobs_lock:
                job = _jobs.get(path.rsplit("/", 1)[-1])
                result = dict(job) if job else None
            self.send_json(result or {"error": "Transcription job not found"},
                           HTTPStatus.OK if result else HTTPStatus.NOT_FOUND)
            return
        super().do_GET()



    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == '/api/cases' or parsed.path.startswith('/api/cases/'):
            self.case_api()
            return
        if parsed.path == '/api/extract':
            self.extract_api()
            return
        if parsed.path != "/api/transcribe":
            self.send_json({"error": "Endpoint not found"}, HTTPStatus.NOT_FOUND)
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if not 0 < length <= MAX_AUDIO_BYTES:
            self.send_json({"error": "Audio is missing or larger than 25 MB"}, HTTPStatus.BAD_REQUEST)
            return

        media_type = self.headers.get("Content-Type", "audio/webm").split(";", 1)[0]
        suffix = {"audio/mp4": ".m4a", "audio/ogg": ".ogg", "audio/wav": ".wav"}.get(media_type, ".webm")
        language = parse_qs(parsed.query).get("language", [None])[0]

        temp_path = None
        try:
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as audio_file:
                temp_path = Path(audio_file.name)
                audio_file.write(self.rfile.read(length))
            with _jobs_lock:
                for key, job in list(_jobs.items()):
                    if time.monotonic() - job.get("finished_at", time.monotonic()) > 3600:
                        del _jobs[key]
                if any(job["status"] not in ("done", "error") for job in _jobs.values()):
                    self.send_json({"error": "A transcription is already running. Please wait."}, HTTPStatus.CONFLICT)
                    return
                job_id = uuid.uuid4().hex
                _jobs[job_id] = {"status": "queued", "model": MODEL_NAME}
            _worker.submit(transcribe_job, job_id, temp_path, language)
            temp_path = None  # The worker now owns and deletes the recording.
            self.send_json({"job_id": job_id}, HTTPStatus.ACCEPTED)
        except ImportError as error:
            self.send_json(
                {
                    "error": (
                        "Speech-to-text is not installed. "
                        f"Run: python3 -m pip install -r requirements.txt ({error})"
                    )
                },
                HTTPStatus.SERVICE_UNAVAILABLE,
            )
        except Exception as error:
            self.send_json({"error": f"Transcription failed: {error}"}, HTTPStatus.INTERNAL_SERVER_ERROR)
        finally:
            if temp_path:
                temp_path.unlink(missing_ok=True)


if __name__ == "__main__":
    os.chdir(Path(__file__).resolve().parent)
    database.initialize()
    print(f"IFSD Response Hub: http://{HOST}:{PORT}")
    print(f"Whisper model: {MODEL_NAME} (first use downloads the model)")
    ThreadingHTTPServer((HOST, PORT), IFSDHandler).serve_forever()
