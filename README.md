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

Open `index.html` in a modern browser. All case, follow-up and dashboard features remain usable without a backend.

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
