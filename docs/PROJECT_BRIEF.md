# Project Brief — IFSD Response Hub

## Team
Team 3 – In-Flight Shutdown

## Team members mentioned
Elias, Jann, David and Mazen

## Challenge
The team wants to understand and improve the information flow around an In-Flight Shutdown.

The key concern is not primarily to technically solve the shutdown itself. The product should improve the **capture, structuring, enrichment, analysis and presentation of information** so experts can act faster and with better context.

## Research questions discussed
- How does Rolls-Royce learn about an IFSD?
- Which interfaces provide the information: airline, air traffic control, tower, automatic systems, etc.?
- Who makes decisions and what roles/job titles are involved?
- How many people work in the relevant response/service center?
- Are there interfaces to global air traffic control organizations?
- What legal/regulatory requirements apply?
- Does RR use public flight tracking or internal systems?
- What detailed flight data can RR access?
- At what escalation level is RR contacted?
- Are engine/sensor data available in real time?
- Is there direct communication with pilots?
- How much data arrives automatically without follow-up?
- Which departments participate in the IFSD process?
- What should the future process look like in 3–5 years?

## Product synthesis
The initial ideas were:
- Phone intake
- Email intake
- Event analysis
- Geo resource map

They were deliberately merged into two features:

### 1. Intelligent Incident Intake
Phone and email are one feature because both are converted into text and then processed by the same extraction logic.

Input channels:
- phone → speech-to-text
- email → text

Output:
- one structured case
- extracted metadata
- missing information
- follow-up needs
- priority suggestion

### 2. Incident Response & Resource Intelligence
Event Analysis and Geo Resource Map are one feature because the expert needs to answer both:
- What happened?
- What resources are available now and where?

Combined view:
- event facts
- sensor/EHM data
- flight context
- weather
- timeline
- historical cases
- available specialists
- mechanics
- parts
- service locations
- ETA / logistics

## Desired demo story
A phone call or email reports an IFSD.
The system creates a case automatically.
It highlights missing information.
It enriches the case with demo EHM/flight context.
It shows similar historical cases.
It shows available resources near the diversion airport.
It suggests next steps.
An authorized human expert makes the final decision.
