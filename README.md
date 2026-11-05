# IFSD Response Hub

Concept prototype for **Team 3 – In-Flight Shutdown** in the TH Wildau / Rolls-Royce innovation challenge.

The prototype explores how critical in-flight events can be captured, structured and enriched so authorized experts receive a clearer operational picture faster.

> **Important:** This is a university concept prototype. All operational and technical values are demo/mock data. It does not make autonomous aviation-safety decisions.

## Core features

### 1. Intelligent Incident Intake

- Phone transcript / speech-to-text and email input
- Automatic extraction into a structured case
- Detection of missing mandatory information
- Priority suggestion with a human-in-the-loop

### 2. Incident Response & Resource Intelligence

- Demo EHM and flight context
- Similar historical cases
- Geo Resource Map
- Specialists, service locations, parts and ETA
- Suggested next steps for authorized experts

## Run locally

### Text-only demo

Open `index.html` for the static demo only. Saving, browsing and editing persisted cases require the local Python server described below.

### Speech-to-text with faster-whisper

Python 3.10+ is recommended.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 server.py
```

Then open `http://127.0.0.1:8000`, select **Intelligent Incident Intake**, allow microphone access, record the report and choose **Stoppen & transkribieren**.

The default multilingual `base` model is downloaded on first use. Select another model with, for example, `WHISPER_MODEL=small python3 server.py`. Audio is processed locally and temporary recordings are deleted after transcription.

## Local AI extraction (optional, Ollama)

Free-form phone transcripts have no "Customer:" style labels, so the rule-based
extractor misses most fields. If [Ollama](https://ollama.com) runs on the same
computer, `server.py` uses it automatically:

```bash
ollama pull llama3.2      # once; any installed chat model works
python3 server.py         # Intake shows "Local AI ready · <model>"
```

- The model is picked automatically (override with `OLLAMA_MODEL=qwen2.5 python3 server.py`,
  other host with `OLLAMA_URL=...`). Nothing leaves the computer.
- Identifiers the model returns (aircraft ID, engine numbers) are kept only if they
  appear in the original text, so the model cannot invent them. Customer and location
  must also be supported by the text.
- Without Ollama the rule-based extractor is used, the UI says which one ran, and the
  reviewer always verifies the fields before saving.

## Explainable priority

The suggested priority combines **severity** from the report (fire warning, flameout,
in-flight shutdown → 1; surge, bird strike, thrust loss → 2; abnormal indication → 3;
ground-only events capped at 3; negations such as "no shutdown" are ignored) with
**turnaround pressure** from the requested departure date. The more urgent one wins and
the reasons are shown in Intake, stored in *Assistant Suggestions* and repeated in the
response workspace. A priority chosen by the reviewer is kept and shown next to the
system suggestion.

## Offline map

Leaflet and a Natural Earth land map are bundled in `vendor/`. With internet the map
uses OpenStreetMap tiles; without internet it switches to the offline land map
automatically, so the workshop demo does not depend on Wi-Fi.

## Current status

**Prototype v0.8** adds realistic demo data (uneven distribution, recent weeks, aircraft/engine type, flight phase, ATA chapter; `python3 seed_demo_cases.py --reset`), a case history (audit trail), simulated EHM traces, live METAR weather via aviationweather.gov with demo fallback (`weather.py`) and an extraction accuracy check under Saved cases.

**Prototype v0.9** follows the real use case more closely: EHM alerts as a third intake channel, a case lifecycle (In flight → On ground → Inspection → Repair → Closed) with a confirmed root cause that feeds similar cases, duplicate detection with a message thread per case, a hint on possibly reportable occurrences (e.g. EU 376/2014, to be verified by the team) and KPIs for time to decision and time to closure. Decisions are worded as Rolls-Royce support decisions; return to service stays with the operator's maintenance organisation. Schema v3 migrates existing databases automatically. `python3 server.py --lan` (or `Start IFSD Hub (Handy).command`) also serves phones and tablets in the same Wi-Fi; voice recording stays on the laptop. The forecast view is hidden from the navigation for now (`forecast.js` is kept for a later version).
**Prototype v0.7** adds a Forecast view (repeat events per aircraft/engine, rising symptoms, regional demand, simulated external signals), more robust rule-based extraction for spoken calls and a refined visual design.
**Prototype v0.4** adds local AI extraction, explainable priority and an offline map.
**v0.3** connected all screens to the local case database:

- **Overview** – world map (Leaflet + OpenStreetMap) with every saved case, coloured by priority, plus demo field-service hubs and parts warehouses; live KPIs and recommendations.
- **Incident Dashboard** – per-case operational view (location, engine, action, field service, spare parts, weather).
- **Intake** – email / phone transcript → structured, editable case → saved with a server-assigned ID.
- **Response & Resource Intelligence** – EHM indicators derived from the report, case completeness, similar saved cases (symptoms, aircraft, engine), Geo Resource Map, recommended resources with ETA and suggested next steps.
- **Expert decision (human-in-the-loop)** – the authorized expert selects resources, chooses *approve plan / request information / escalate / monitor*, adds a rationale and records it. The decision is stored with the case and in its history. A follow-up request for missing information is generated on demand.

 See [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md) for the end-to-end demo.

See [`PROJECT_BRIEF.md`](PROJECT_BRIEF.md) for the product context and [`BACKLOG.md`](BACKLOG.md) for planned work.

## Project structure

- `index.html` – application screens and demo content
- `styles.css` – responsive visual styling
- `app.js` – navigation, intake extraction, case persistence and saved-case list
- `overview.js` – overview map, dashboard enrichment, response workspace and expert decision
- `forecast.js` – forecast view derived from saved cases plus demo signals
- `weather.py` – optional live METAR lookup with cache
- `DEMO_SCRIPT.md` – end-to-end presentation script
- `server.py` – local static server, case API and faster-whisper API
- `database.py` – SQLite schema, migrations and persistence
- `extraction.py` – optional local LLM extraction via Ollama
- `vendor/` – bundled Leaflet and offline world map
- `Start IFSD Hub.command` – macOS double-click start
- `seed_demo_cases.py` / `examples/` – 50 synthetic demo incidents
- `requirements.txt` – optional speech-to-text dependency
- `PROJECT_BRIEF.md` – challenge and product concept
- `BACKLOG.md` – prioritized product backlog

## Safety principles

- Human-in-the-loop for safety-critical decisions
- Mock data must remain clearly identified
- The system supports experts; it does not replace expert judgment
- No operational Rolls-Royce data is included


## Local incident database (Windows)

```powershell
.\.venv\Scripts\python.exe server.py
```

Open http://127.0.0.1:8000. The server automatically creates `data/incidents.db`
using Python's built-in SQLite module; no additional database software is needed.
Restart an already running server and reload the browser after updating the code.

- Create a case from an incoming message, review it, then click **Save Case**.
- **Saved Cases** provides search, open/edit, a blank-case form, trash and restore.
- Source and Problem / Notes are required for saving. Other missing fields remain
  visible as information gaps but do not prevent recording an incomplete incident.
- IDs are assigned on first save: `IFSD-YYYY-MMDD-000001` (UTC creation date and
  a database-wide increasing sequence, at least six digits). Editing or moving a
  case to trash never changes its ID or reuses its sequence number.
- All form fields have matching columns, including Source, Customer, Aircraft ID,
  Aircraft Location, Priority, Event Time, Requested Departure Date, Engine 1/2
  Number, Problem / Notes and Assistant Suggestions. Original text is stored too.
- Dates entered by the user are preserved as text, including incomplete times;
  creation/update timestamps are UTC. Blank values are not invented.
- Updates require the current revision, preventing one window from silently
  overwriting a newer edit in another window.
- `incident_history` stores snapshots on create, update, trash and restore.
- The database starts empty. No fictional incidents are inserted automatically.
  For the demo, load the 50 synthetic cases once with `python3 seed_demo_cases.py`.
- Expert decisions (`decision`, `decisionBy`, `decisionNote`, `assignedResources`,
  `decidedAt`) are stored with the case. Existing databases are migrated
  automatically to schema version 2 on server start; no data is lost.

The `data/` directory is excluded from Git and is never served as a static web
asset. Only index.html, app.js, overview.js, forecast.js, styles.css and files in vendor/ are publicly served. This remains a
local application bound to 127.0.0.1, without multi-user authentication.

For a simple backup, stop the server and copy the entire `data/` directory to a
safe location. To restore, stop the server and replace it with the backup.
Git branch changes do not roll back database contents. Do not delete the database
if you want to retain its records and ID sequence.

Run checks with:

```powershell
.\.venv\Scripts\python.exe -m unittest test_database test_extraction -v
node --check app.js
node --check overview.js
node --check forecast.js
```

Database tests use temporary databases and do not write demo records into the
application database. `database.py` owns schema initialization and persistence.
