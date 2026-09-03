# AGENTS.md — IFSD Response Hub

## Project
Team 3 – In-Flight Shutdown
TH Wildau / Rolls-Royce innovation challenge

## Core challenge
How can critical in-flight events be captured in a fast, complete and standardized way so that useful insights can be generated quickly?

## Product concept
Build one central prototype called **IFSD Response Hub** with two core features:

### Feature 1 — Intelligent Incident Intake
Merge phone and email into one intake flow because both end up as text:
- Phone → Speech-to-Text → transcript
- Email → text input
- Extract relevant fields automatically
- Create a structured case
- Detect missing mandatory information
- Suggest follow-up questions
- Suggest priority, but do not make safety-critical decisions

### Feature 2 — Incident Response & Resource Intelligence
Merge event analysis and geo-resource mapping into one response workspace:
- EHM / engine data
- flight data
- weather data
- event timeline
- similar historical cases
- missing-data indicators
- geo map with experts / mechanics / service locations / parts
- ETA / logistics
- suggested next steps
- human-in-the-loop: final decisions stay with authorized Rolls-Royce experts

## Design principles
1. Human-in-the-loop for all safety-critical decisions.
2. Reduce manual double entry.
3. Make missing information obvious.
4. Unify fragmented sources into one case.
5. Support experts; do not replace expert judgment.
6. Keep the prototype understandable and demoable in a university workshop.
7. All operational/technical data in the prototype must be clearly labeled as demo/mock data unless provided by the team.

## Current prototype
Static web prototype using:
- HTML
- CSS
- vanilla JavaScript
No backend, build step, or external dependencies.

Open `index.html` directly in a browser.

## Current demo flow
Dashboard
→ Intelligent Incident Intake
→ enter/paste phone transcript or email
→ automatic case extraction
→ missing information list
→ Incident Response & Resource Intelligence
→ EHM overview
→ historical similarity examples
→ geo-resource map
→ recommended resources
→ human decision

## Important terminology
Use:
- In-Flight Shutdown / IFSD
- Intelligent Incident Intake
- Incident Response & Resource Intelligence
- EHM (Engine Health Monitoring)
- Human-in-the-loop
- structured case
- missing mandatory information
- Geo Resource Map

## Safety / scope
Do not present mock operational data as real Rolls-Royce data.
Do not implement autonomous aviation safety decisions.
The app is a concept prototype, not an operational tool.

## Coding guidance
- Keep source simple and readable for students.
- Prefer incremental improvements over unnecessary framework migration.
- Preserve a one-click local demo if possible.
- Responsive UI is desirable.
- Make interactions visibly demonstrable in 3–5 minutes.
