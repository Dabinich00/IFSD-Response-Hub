# Synthetic incident examples

`incidents-50.json` contains 50 fictional records for UI demonstrations and future
similarity-search evaluation. No record represents an actual operator incident or
validated maintenance advice. All aircraft and engine identifiers use DEMO prefixes.

Run from the project directory:

```powershell
.\.venv\Scripts\python.exe -m scripts.seed_demo_cases
```

The importer generates this fixture, backs up the current SQLite database using
SQLite's backup API, and inserts missing records through `database.create`.
Existing records are preserved. Dataset markers in originalText prevent duplicate
imports on sequential reruns, including records already in the trash. Run only one
importer at a time. Case IDs are assigned by the database, not copied from fixtures.

Coverage:
- 10 symptom families, 5 distinct cases each; family labels are fixture metadata,
  not confirmed diagnoses or database fields.
- 15 fictional aircraft and 5 fictional operators, with repeated events.
- 25 emails and 25 phone transcripts.
- 21 incomplete cases, with missing engine numbers, dates or locations.
- Similar symptoms across aircraft and different symptoms on the same aircraft.
- A fictional transfer of DEMO-ENG-00003 from DEMO-AC-002 to DEMO-AC-001 on
  2026-06-01; the first aircraft receives DEMO-ENG-90003 afterwards.
- Ground events and unconfirmed reports alongside shutdowns, to test whether
  future analysis distinguishes similar wording from equivalent events.

Event dates are historical synthetic dates in 2026. The ID date records the actual
import/creation date. Priorities are fictional intake-time values based on requested
turnaround, not present-day overdue status or engineering severity assessments.
Descriptions use English to match the current interface. Incomplete source messages
omit the corresponding missing facts rather than inventing them.

Use the dataset for functional demonstrations; it is not an independent benchmark
for real-world aviation accuracy. No similarity search has been added by this import.
