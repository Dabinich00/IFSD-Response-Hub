# Backlog / Next Steps

## P0 — Make v0.2 demo-ready
- [ ] Add editable structured case fields
- [ ] Add toggle between phone transcript and email input
- [ ] Add visible extraction animation / processing state
- [ ] Add mandatory-field checklist
- [ ] Add generated follow-up questions for missing data
- [ ] Add event severity / escalation suggestion with explanation
- [ ] Add editable case status
- [ ] Add case timeline generated from intake text
- [ ] Connect selected case fields to response screen

## P0 — Response workspace
- [ ] Show EHM / flight / weather as separate data cards
- [ ] Add explicit "mock data" labels
- [ ] Add clear source label for every data block
- [ ] Improve Geo Resource Map visuals
- [ ] Allow clicking a resource to view role, availability, ETA, parts
- [ ] Add resource shortlist / assignment interaction
- [ ] Add "request missing information" action
- [ ] Add final expert decision panel

## P1 — Better prototype realism
- [ ] Add multiple demo scenarios
- [ ] Add email example
- [ ] Add phone transcript example
- [ ] Add missing-data-heavy example
- [ ] Add successful-complete-case example
- [ ] Add similar-case comparison
- [ ] Add role-based view: intake / engineer / coordinator

## P1 — UX
- [ ] Improve Rolls-Royce-adjacent engineering aesthetic without using unauthorized brand assets
- [ ] Improve responsive layout
- [ ] Add clear progress through the incident workflow
- [ ] Add empty states and error states
- [ ] Add print/export case summary

## P2 — Optional technical evolution
Only if useful for the workshop:
- [ ] lightweight local backend
- [ ] JSON mock API
- [ ] persistence with localStorage
- [ ] map library
- [ ] real speech-to-text API integration later
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
