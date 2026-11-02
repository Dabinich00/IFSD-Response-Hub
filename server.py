"""Local static server and faster-whisper transcription endpoint."""

from __future__ import annotations

import json
import os
import tempfile
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
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
            raise ValueError("Keine Sprache erkannt")
        update(status="done", text=text, language=info.language)
    except Exception as error:
        update(status="error", error=f"Transkription fehlgeschlagen: {error}")
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
        if path.startswith("/api/transcriptions/"):
            with _jobs_lock:
                job = _jobs.get(path.rsplit("/", 1)[-1])
                result = dict(job) if job else None
            self.send_json(result or {"error": "Auftrag nicht gefunden"},
                           HTTPStatus.OK if result else HTTPStatus.NOT_FOUND)
            return
        super().do_GET()

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path != "/api/transcribe":
            self.send_json({"error": "Endpoint nicht gefunden"}, HTTPStatus.NOT_FOUND)
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if not 0 < length <= MAX_AUDIO_BYTES:
            self.send_json({"error": "Audio fehlt oder ist größer als 25 MB"}, HTTPStatus.BAD_REQUEST)
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
                    self.send_json({"error": "Eine Transkription läuft bereits. Bitte warten."}, HTTPStatus.CONFLICT)
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
                        "faster-whisper konnte nicht geladen werden. "
                        f"Details: {error}"
                    )
                },
                HTTPStatus.SERVICE_UNAVAILABLE,
            )
        except Exception as error:
            self.send_json({"error": f"Transkription fehlgeschlagen: {error}"}, HTTPStatus.INTERNAL_SERVER_ERROR)
        finally:
            if temp_path:
                temp_path.unlink(missing_ok=True)


if __name__ == "__main__":
    os.chdir(Path(__file__).resolve().parent)
    print(f"IFSD Response Hub: http://{HOST}:{PORT}")
    print(f"Whisper model: {MODEL_NAME} (first use downloads the model)")
    ThreadingHTTPServer((HOST, PORT), IFSDHandler).serve_forever()
