# Backlog / Next Steps

## P0 — Make v0.2 demo-ready
- [x] Add editable structured case fields
- [x] Add toggle between phone transcript and email input
- [ ] Add visible extraction animation / processing state
- [x] Add mandatory-field checklist
- [x] Add generated follow-up questions for missing data
- [ ] Add event severity / escalation suggestion with explanation
- [ ] Add editable case status
- [ ] Add case timeline generated from intake text
- [x] Connect selected case fields to response screen

## P0 — Response workspace
- [ ] Show EHM / flight / weather as separate data cards
- [x] Add explicit "mock data" labels
- [x] Add clear source label for every data block
- [x] Improve Geo Resource Map visuals
- [ ] Allow clicking a resource to view role, availability, ETA, parts
- [x] Add resource shortlist / assignment interaction
- [x] Add "request missing information" action
- [x] Add final expert decision panel

## P1 — Better prototype realism
- [x] Add multiple demo scenarios
- [x] Add email example
- [x] Add phone transcript example
- [x] Add missing-data-heavy example
- [ ] Add successful-complete-case example
- [x] Add similar-case comparison
- [ ] Add role-based view: intake / engineer / coordinator

## P1 — UX
- [ ] Improve Rolls-Royce-adjacent engineering aesthetic without using unauthorized brand assets
- [x] Improve responsive layout
- [ ] Add clear progress through the incident workflow
- [x] Add empty states and error states
- [ ] Add print/export case summary

## P2 — Optional technical evolution
Only if useful for the workshop:
- [x] lightweight local backend
- [x] JSON mock API
- [ ] persistence with localStorage
- [x] map library
- [x] real speech-to-text API integration later
- [ ] real LLM extraction later
Do not add complexity unless it improves the demo.

## Acceptance criteria for the next demo
A viewer should understand within 3 minutes:
1. how an incident enters the system,
2. how unstructured input becomes structured data,
3. what is missing,
4. how the event is analyzed,
5. what resources are available,
6. that the final decision remains human.
