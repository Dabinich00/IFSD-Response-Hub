"""Optional case extraction with a local LLM served by Ollama.

The browser always has a rule-based extractor; this module only improves on it
when an Ollama server is running on this computer. Nothing leaves the machine.
Values the model returns are kept only if they can be found in the source text,
so the model cannot invent aircraft or engine identifiers.
"""
from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request

OLLAMA_URL = os.environ.get('OLLAMA_URL', 'http://127.0.0.1:11434').rstrip('/')
OLLAMA_MODEL = os.environ.get('OLLAMA_MODEL', '')
FIELDS = ('customer', 'aircraftId', 'aircraftLocation', 'eventTime',
          'requestedDepartureDate', 'engine1', 'engine2', 'problemNotes')
# Identifiers must appear verbatim (ignoring case/spaces) in the source text.
VERBATIM = ('aircraftId', 'engine1', 'engine2')
PREFERRED = ('qwen2.5', 'qwen3', 'llama3.2', 'llama3.1', 'llama3', 'mistral', 'gemma3', 'gemma2', 'phi4', 'phi3')
MAX_TEXT = 20000

SYSTEM_PROMPT = """You extract structured data from an incoming report about an aircraft engine event
(email or phone-call transcript, English or German). Return JSON with exactly these keys:
customer, aircraftId, aircraftLocation, eventTime, requestedDepartureDate, engine1, engine2, problemNotes.
Rules:
- Use only information stated in the text. If something is not stated, return an empty string. Never guess.
- customer: the airline/operator name.
- aircraftId: registration or aircraft ID exactly as written.
- aircraftLocation: where the aircraft is now (airport/city), e.g. the diversion airport.
- eventTime and requestedDepartureDate: as written, prefer "YYYY-MM-DD HH:MM UTC" when date and time are given.
- engine1 / engine2: engine serial or ID numbers for engine position 1 and 2, exactly as written.
- problemNotes: one or two factual English sentences describing what happened (symptoms, shutdown, diversion).
Return only the JSON object."""

SCHEMA = {'type': 'object', 'properties': {f: {'type': 'string'} for f in FIELDS}, 'required': list(FIELDS)}


class ExtractionUnavailable(Exception):
    """Ollama is not running, has no usable model or returned unusable output."""


def _request(path, payload=None, timeout=5.0):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(OLLAMA_URL + path, data=data, method='POST' if data else 'GET',
                                 headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return json.loads(response.read())
    except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as error:
        raise ExtractionUnavailable(f'Local AI (Ollama) not reachable at {OLLAMA_URL}: {error}') from error
    except json.JSONDecodeError as error:
        raise ExtractionUnavailable('Ollama returned an unreadable response.') from error


def pick_model(timeout=2.0):
    """Return the configured model or the best installed chat model."""
    names = [m.get('name', '') for m in _request('/api/tags', timeout=timeout).get('models', [])]
    chat = [n for n in names if n and 'embed' not in n.lower()]
    if OLLAMA_MODEL:
        if any(n == OLLAMA_MODEL or n.split(':')[0] == OLLAMA_MODEL for n in chat):
            return OLLAMA_MODEL
        raise ExtractionUnavailable(f'Model "{OLLAMA_MODEL}" is not installed in Ollama (ollama pull {OLLAMA_MODEL}).')
    for prefix in PREFERRED:
        for name in chat:
            if name.lower().startswith(prefix):
                return name
    if chat:
        return chat[0]
    raise ExtractionUnavailable('Ollama is running but has no chat model. Install one, e.g. "ollama pull llama3.2".')


def status():
    try:
        return {'available': True, 'model': pick_model()}
    except ExtractionUnavailable as error:
        return {'available': False, 'error': str(error)}


def _normalize(value):
    return re.sub(r'[\s\-_./]', '', value).lower()


def sanitize(raw, text):
    """Keep only known string fields that are supported by the source text."""
    if not isinstance(raw, dict):
        raise ExtractionUnavailable('The local AI did not return a JSON object.')
    source = _normalize(text)
    lower = text.lower()
    result = {}
    for field in FIELDS:
        value = raw.get(field, '')
        if not isinstance(value, str):
            value = ''
        value = value.strip()[:2000 if field == 'problemNotes' else 200]
        if value.lower() in ('', 'unknown', 'n/a', 'none', 'null', 'not stated', 'not provided'):
            value = ''
        if value and field in VERBATIM and _normalize(value) not in source:
            value = ''
        if value and field in ('customer', 'aircraftLocation'):
            words = [w for w in re.findall(r'[\wÄÖÜäöüß]{3,}', value.lower())]
            # Every word must be in the source text, so "Demo Baltic Wings" is not accepted
            # for a message that only mentions "Demo Northstar Air".
            if words and not all(w in lower for w in words):
                value = ''
        result[field] = value
    return result


def extract(text, timeout=120.0):
    text = (text or '').strip()
    if not text:
        raise ValueError('Text is required.')
    if len(text) > MAX_TEXT:
        raise ValueError(f'Text is too long (maximum {MAX_TEXT} characters).')
    model = pick_model()
    reply = _request('/api/chat', {
        'model': model, 'stream': False, 'format': SCHEMA,
        'options': {'temperature': 0},
        'messages': [{'role': 'system', 'content': SYSTEM_PROMPT}, {'role': 'user', 'content': text}],
    }, timeout=timeout)
    content = (reply.get('message') or {}).get('content', '')
    match = re.search(r'\{.*\}', content, re.S)
    try:
        raw = json.loads(match.group(0) if match else content)
    except (json.JSONDecodeError, AttributeError) as error:
        raise ExtractionUnavailable('The local AI returned no valid JSON.') from error
    return {'fields': sanitize(raw, text), 'model': model}
