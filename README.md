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

Run commands from the project root. On Windows PowerShell:

```powershell
.\.venv\Scripts\python.exe server.py
```

Open http://127.0.0.1:8000. If the virtual environment does not exist yet, create it and install dependencies first:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

The local server provides the interface, case database and transcription API. Whisper's multilingual `base` model downloads on first use; set `$env:WHISPER_MODEL = "small"` before starting the server to use another model. Audio is processed locally and temporary recordings are removed after transcription. AI text-to-case extraction also needs Codex CLI signed in on the presenter's computer; see below.

Opening `web/index.html` directly shows the static interface, but saving, transcription and text-to-case extraction require the Python server.

## Project structure

```text
IFSD-Response-Hub/
├── server.py               # Start here: local HTTP server and API
├── backend/                # Case storage, dates and text extraction
├── web/                    # Browser interface: HTML, CSS and JavaScript
├── tests/                  # Automated checks
├── scripts/                # Demo-data importer
├── examples/               # 50 synthetic cases and their description
├── docs/                   # Brief, backlog and development prompt
├── data/                   # Local databases and logs (ignored by Git)
├── .venv/                  # Local Python environment (ignored by Git)
├── requirements.txt
└── README.md
```

The entry point remains `server.py`; the existing `data/` files and case IDs stay in place. See [the product brief](docs/PROJECT_BRIEF.md) and [backlog](docs/BACKLOG.md) for project context.

## Safety principles

- Human-in-the-loop for safety-critical decisions
- Mock data must remain clearly identified
- The system supports experts; it does not replace expert judgment
- No operational Rolls-Royce data is included


## Local incident database

The server automatically creates `data/incidents.db` using Python's built-in SQLite module; no additional database software is needed. Restart an already running server and reload the browser after updating the code.

- Create a case from an incoming message, review it, then click **Save Case**.
- **Saved Cases** provides search, open/edit, a blank-case form, trash and restore.
- Source is selected by the interface; Problem / Notes is required for saving.
  Other missing fields remain visible as information gaps but do not prevent
  recording an incomplete incident.
- IDs are assigned on first save: `IFSD-YYYY-MMDD-000001` (UTC creation date and
  a database-wide increasing sequence, at least six digits). Editing or moving a
  case to trash never changes its ID or reuses its sequence number.
- All form fields have matching columns, including Source, Customer, Aircraft ID,
  Aircraft Location, Priority, Event Time, Requested Departure Date, Engine 1/2
  Number, Problem / Notes and Assistant Suggestions. Original text is stored too.
- Event/departure dates use DD.MM.YYYY, optionally followed by time and timezone.
  ISO and numeric day-first dates are normalized on save; two-digit years mean
  2000–2099. Incomplete or invalid dates must be clarified or left empty.
  Creation/update audit timestamps remain UTC. Blank values are not invented.
- Updates require the current revision, preventing one window from silently
  overwriting a newer edit in another window.
- `incident_history` stores snapshots on create, update, trash and restore.
- The database starts empty. No fictional incidents are inserted automatically.

The `data/` directory is excluded from Git and is never served as a static web
asset. Only files from `web/` are publicly served. This remains a
local application bound to 127.0.0.1, without multi-user authentication.

For a simple backup, stop the server and copy the entire `data/` directory to a
safe location. To restore, stop the server and replace it with the backup.
Git branch changes do not roll back database contents. Do not delete the database
if you want to retain its records and ID sequence.

Run checks with:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests
node --check web\app.js
```

Database tests use temporary databases and do not write demo records into the
application database. `backend/database.py` owns schema initialization and persistence.

## Local presentation: Codex text-to-case extraction

This feature uses the installed **Codex CLI with ChatGPT login**, with no API key,
provider fallback or automatic model-call retries. It requires internet and uses
the signed-in account's Codex allowance. The model processes the text in the cloud.
Whisper remains the separate local speech-to-text step.

On each presenter's Windows computer:

1. Install a current Codex CLI and Node.js, plus the project's Python dependencies.
2. Run `codex.cmd login` and sign in to your own ChatGPT account, then check
   `codex.cmd login status`. `.cmd` avoids PowerShell's script-policy restriction.
3. Run `.\.venv\Scripts\python.exe server.py` under that same Windows user.
4. Open http://127.0.0.1:8000, paste or transcribe a message, and select
   **Create Case**. Review the draft and select **Save Case**.

The CLI version must support `--ignore-user-config`, `--ignore-rules`,
`--ephemeral`, and `--output-schema`. No account tokens are read or copied by this
application. The CLI handles authentication. API-key login is rejected for this
workflow. The application uses the selected CLI's default model. Optionally set
`IFSD_CODEX_MODEL` locally to choose a model available to your account. Different
model settings use separate cache entries. A subscription does not imply unlimited
requests.

`backend/extraction.py` runs a short, independent task in an empty temporary directory,
with read-only sandboxing, no approval escalation, user configuration ignored,
and shell, browser, apps, plugins, hooks, multi-agent, images and memory features
disabled. The message is passed on stdin, never interpolated into a shell command.
The application's repository and case database are not supplied to Codex.
Temporary schema/output files are removed afterward. This is a constrained local
demo workflow, not a guarantee of complete OS-level isolation from the account.

Only extracted fields are returned. Case ID and source are assigned by the app;
priority remains the existing deterministic scheduling rule, not an AI safety
assessment. Unknown facts remain empty. The server checks field types and lengths;
JSON validity does not guarantee factual correctness. Manual verification remains
required. No regular-expression extraction fallback is silently used.

Repeated-click protection:
- The button is disabled while analysis runs and after applying unchanged text.
- SHA-256 of normalized text, prompt version and configured model identifies a job.
  Normalization only trims outer whitespace and normalizes line endings.
- SQLite atomically claims the job, so concurrent tabs share one model invocation.
- Results persist in `data/extraction-cache.db` across reloads/server restarts.
  Source changes do not trigger another analysis. Previous text reuses its result.
- Failed/interrupted jobs are not retried by ordinary clicks. **Try again**
  requires an explicit confirmation and may consume allowance again.
- A new message while another task runs is rejected rather than silently queued.
- The CLI task has a 180-second deadline. Network polling never starts a new task.

The cache contains extracted case data and is local/ignored by Git, like the main
case database. It is not served by the web server. Removing the cache or changing
the prompt version allows reanalysis, so retain it during the presentation.
Tests use temporary caches and mocked Codex responses, without spending allowance:

```powershell
.\.venv\Scripts\python.exe -m unittest tests.test_extraction -v
```

AI descriptions, clarification questions and location wording are generated in
English regardless of source language. Identifiers and original source text are
preserved. Relative dates without an explicit reference date remain empty and
produce a clarification question. The extraction cache version changes when these
rules change; an older cached response is not reused under the new rules. Existing
saved descriptions are not automatically translated. Legacy ISO case dates are
formatted when opened and normalized in storage on the next save.
