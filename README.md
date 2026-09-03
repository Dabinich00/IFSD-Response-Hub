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

No build step or external dependency is required.

1. Clone or download this repository.
2. Open `index.html` in a modern browser.
3. Follow the demo flow: Dashboard → Incident Intake → Create case → Analysis & Resources.

## Current status

**Prototype v0.1** is a static HTML/CSS/JavaScript demonstrator. The next planned version will add editable case fields, follow-up requests, selectable resources and a generated case summary.

See [`PROJECT_BRIEF.md`](PROJECT_BRIEF.md) for the product context and [`BACKLOG.md`](BACKLOG.md) for planned work.

## Project structure

- `index.html` – application screens and demo content
- `styles.css` – responsive visual styling
- `app.js` – navigation and rule-based demo extraction
- `PROJECT_BRIEF.md` – challenge and product concept
- `BACKLOG.md` – prioritized product backlog
- `AGENTS.md` – contribution and safety guidance

## Safety principles

- Human-in-the-loop for safety-critical decisions
- Mock data must remain clearly identified
- The system supports experts; it does not replace expert judgment
- No operational Rolls-Royce data is included

