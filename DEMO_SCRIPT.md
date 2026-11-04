# Demo-Szenario & Präsentations-Skript (v0.3)

Ein durchgängiges Szenario, das **alle Funktionen des Prototyps von A bis Z** zeigt und
gleichzeitig als Funktionstest dient. Dauer: ca. 5–6 Minuten.

> Alle Werte sind Demo-/Mock-Daten. Cases kommen aus der lokalen Datenbank; Teams, Lager,
> ETAs, Wetter und EHM-Indikatoren sind Demo-Werte. Die sicherheitskritische Entscheidung
> bleibt beim autorisierten Experten (Human-in-the-loop).

---

## Vorbereitung (einmalig vor der Präsentation)

```bash
python3 -m venv .venv
source .venv/bin/activate            # Windows: .\.venv\Scripts\activate
pip install -r requirements.txt      # nur für Live-Transkription nötig
python3 seed_demo_cases.py           # lädt 50 synthetische Demo-Cases (einmalig)
python3 server.py
```

Dann `http://127.0.0.1:8000` öffnen. Prüfen:
- Overview zeigt **Active cases ≈ 50** und Marker auf der Karte.
- Die Karte braucht Internet (Leaflet + OpenStreetMap). Ohne Internet erscheint ein Hinweis,
  alle anderen Funktionen laufen weiter.
- Live-Transkription ist optional: der Intake-Text ist vorausgefüllt.

**Reset zwischen zwei Durchläufen:** Seite neu laden. Den in Akt 2 angelegten Case kann man
unter *Saved Cases → Move to trash* wieder entfernen.

---

## Das Szenario

> **Der Fall:** Eine E-Mail von *Demo Northstar Air* meldet einen In-Flight Shutdown an
> Flugzeug **DEMO-AC-017**: Triebwerk 2 wurde nach erhöhter Vibration und EGT-Anstieg
> abgeschaltet, das Flugzeug ist nach **Shannon** umgeleitet und steht dort am Boden.
> Der Kunde will morgen wieder abfliegen. Ölsystem-Details und EHM-Datensatz fehlen.

Der Text ist im Intake **bereits vorausgefüllt** (Datum = heute/morgen).

---

## A → Z Walkthrough

### Akt 0 · Overview — das Lagebild (≈ 30 Sek)
| Aktion | Was man sagt | Erwartetes Ergebnis |
|---|---|---|
| — | „Unser globales Lagebild: alle gespeicherten IFSD-Cases auf einer echten Karte." | Marker nach Priorität gefärbt, Teams (Raute) und Teilelager (Dreieck) |
| Kacheln unten | „Kennzahlen werden live aus der Datenbank berechnet." | Active cases, offene Expertenentscheidungen, Prioritätsverteilung |
| Recommendations | „Das System weist auf P1-Cases ohne Entscheidung und auf Muster in der Flotte hin." | z. B. „Most frequent symptom: Vibration" |
| Toggle **Weather** | Layer-Steuerung | Wetter-Overlay an/aus |

### Akt 1 · Intake — die Meldung wird zum Case (≈ 60 Sek)
**„1 · Intelligent Incident Intake"** klicken.

| Aktion | Was man sagt | Erwartetes Ergebnis |
|---|---|---|
| Auf das Whisper-Widget zeigen | „Anrufe werden lokal per faster-whisper transkribiert." | Status *Ready* |
| **Create case automatically** | „Aus unstrukturiertem Text wird ein strukturierter Case." | Felder: Customer *Demo Northstar Air*, Aircraft *DEMO-AC-017*, Location *Shannon*, Engines, Event Time, Priority **1 - Most urgent** (aus gewünschtem Abflug) |
| Auf *Missing Information & Alerts* zeigen | „Lücken sind sofort sichtbar." | Hinweise + „Human review required" |
| Ein Feld ändern | „Der Experte behält die Kontrolle — alles editierbar." | — |
| **Save Case** | „Gespeichert in der lokalen Datenbank, ID wird vergeben." | *Saved IFSD-…* |

### Akt 2 · Response — Analyse & Ressourcen (≈ 90 Sek)
**„Analysis & resources →"** klicken.

| Aktion | Was man sagt | Erwartetes Ergebnis |
|---|---|---|
| Kopf | „Derselbe Case, angereichert." | Case-ID, Aircraft, Engines, „on ground at Shannon (SNN)", Prioritäts-Pille |
| EHM-Karte | „Indikatoren aus der Meldung — Negationen wie ‚no shutdown' werden erkannt. Live-EHM wäre die nächste Ausbaustufe." | EGT und Vibration *reported abnormal* |
| Completeness | Vollständigkeit | Prozentwert + fehlende Felder |
| Similar cases | „Vergleich mit gespeicherten Cases: gleiche Symptome, gleiches Flugzeug, gleiches Triebwerk." | bis zu 3 Cases mit Match-% und Begründung, anklickbar |
| Geo Resource Map | „Wo ist das Flugzeug, was ist in der Nähe?" | Flugzeug-Marker Shannon, Linien zu Partner, Hub, Lager |
| Recommended resources | „Vorschläge mit ETA — der Experte wählt aus." | Service Partner, Field Service Hub, Remote-Spezialist, Teilelager |
| Suggested next steps | „Konkrete nächste Schritte." | nummerierte Liste |

### Akt 3 · Expert decision — Human-in-the-loop (≈ 60 Sek)
| Aktion | Was man sagt | Erwartetes Ergebnis |
|---|---|---|
| **Record decision** ohne Auswahl | „Ohne Experte keine Entscheidung." | Hinweis „Choose a decision" |
| **Request missing information** wählen | „Das System formuliert die Rückfrage." | Generierte Rückfrage-Mail mit den fehlenden Punkten, kopierbar |
| Alternativ **Approve response plan**, 2 Ressourcen anhaken, Name eintragen | „Die Entscheidung trifft und dokumentiert der Mensch." | — |
| **Record decision** | Nachvollziehbarkeit | Status-Pille *Response plan approved · Name · Zeit*, gespeichert in der DB (inkl. Historie) |

### Akt 4 · Zurück ins Lagebild & Dashboard (≈ 40 Sek)
| Aktion | Was man sagt | Erwartetes Ergebnis |
|---|---|---|
| **Overview** | „Der Case ist sofort im Lagebild, offene Entscheidungen −1." | neuer Marker bei Shannon (weiß umrandet = entschieden) |
| Marker anklicken → **Incident dashboard** | „Operative Einsatzsicht pro Case." | Kacheln mit Notes, Weather (Demo), Action, Field Service, Spare Parts, Aircraft |
| **Response & resources →** | Rücksprung | Response-Screen desselben Cases |

---

## Roter Faden

Ein Ereignis (Anruf/E-Mail) wird **erfasst → strukturiert → auf Lücken geprüft →
gespeichert → angereichert → mit Ressourcen verknüpft → vom Experten entschieden**, und
derselbe Case ist über **alle Screens** konsistent sichtbar.

## Test-Checkliste (Akzeptanzkriterien aus BACKLOG.md)

- [ ] Wie ein Incident ins System kommt → Akt 1
- [ ] Aus unstrukturiert wird strukturiert → Akt 1
- [ ] Was fehlt → Akt 1 + Akt 3 (Rückfrage)
- [ ] Wie das Ereignis analysiert wird → Akt 2 (EHM, Similar cases)
- [ ] Welche Ressourcen verfügbar sind → Akt 2 (Karte, Empfehlungen)
- [ ] Dass die Entscheidung menschlich bleibt → Akt 3

## Fallback, falls etwas klemmt

- **Karte fehlt:** kein Internet → Hinweis statt Karte; Analyse, Ressourcen und Entscheidung funktionieren trotzdem. Screenshots als Plan B bereithalten.
- **Overview leer:** `python3 seed_demo_cases.py` ausführen und Seite neu laden.
- **„Start python server.py …":** Seite wurde per Doppelklick (`file://`) geöffnet → über `http://127.0.0.1:8000` öffnen.
- **Transkription „nicht erreichbar":** vorausgefüllten Text nutzen.
