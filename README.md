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

## Current status

**Prototype v0.2** combines the static demonstrator with an optional local faster-whisper service. It includes editable case fields, follow-up requests and synchronized dashboard data.

See [`PROJECT_BRIEF.md`](PROJECT_BRIEF.md) for the product context and [`BACKLOG.md`](BACKLOG.md) for planned work.

## Project structure

- `index.html` – application screens and demo content
- `styles.css` – responsive visual styling
- `app.js` – navigation and rule-based demo extraction
- `server.py` – local static server and faster-whisper API
- `requirements.txt` – optional speech-to-text dependency
- `PROJECT_BRIEF.md` – challenge and product concept
- `BACKLOG.md` – prioritized product backlog
- `AGENTS.md` – contribution and safety guidance

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

The `data/` directory is excluded from Git and is never served as a static web
asset. Only index.html, app.js and styles.css are publicly served. This remains a
local application bound to 127.0.0.1, without multi-user authentication.

For a simple backup, stop the server and copy the entire `data/` directory to a
safe location. To restore, stop the server and replace it with the backup.
Git branch changes do not roll back database contents. Do not delete the database
if you want to retain its records and ID sequence.

Run checks with:

```powershell
.\.venv\Scripts\python.exe -m unittest test_database -v
node --check app.js
```

Database tests use temporary databases and do not write demo records into the
application database. `database.py` owns schema initialization and persistence.
