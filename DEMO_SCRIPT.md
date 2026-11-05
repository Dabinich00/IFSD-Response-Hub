# Demo-Szenario & Präsentations-Skript (v0.9)

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
python3 seed_demo_cases.py --reset   # sichert die alte DB und lädt 50 realistische Demo-Cases
python3 server.py
```

Dann `http://127.0.0.1:8000` öffnen. Prüfen:
- Overview zeigt **Active cases ≈ 21** (offene Cases, 29 von 50 sind abgeschlossen) und Marker auf der Karte.
- Die Karte läuft auch offline (gebündelte Weltkarte). Mit Internet erscheinen OpenStreetMap-Kacheln.
- Optional Ollama starten (`ollama pull llama3.2`), dann zeigt der Intake *Local AI ready*.
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
| Kartenebene **Weather (demo)** | Layer-Steuerung | Wetter-Overlay an/aus |

### Akt 1 · Intake — die Meldung wird zum Case (≈ 60 Sek)
In der linken Leiste **Incident intake** klicken.

| Aktion | Was man sagt | Erwartetes Ergebnis |
|---|---|---|
| Auf das Whisper-Widget zeigen | „Anrufe werden lokal per faster-whisper transkribiert." | Status *Ready* |
| **Create case** | „Aus unstrukturiertem Text wird ein strukturierter Case." | Felder: Customer *Demo Northstar Air*, Aircraft *DEMO-AC-017*, Location *Shannon*, Engines, Event Time, Priority **1 - Most urgent** (aus gewünschtem Abflug) |
| Auf *Missing Information & Alerts* zeigen | „Lücken sind sofort sichtbar." | Hinweise + „Human review required" |
| Ein Feld ändern | „Der Experte behält die Kontrolle — alles editierbar." | — |
| **Save Case** | „Gespeichert in der lokalen Datenbank, ID wird vergeben." | *Saved IFSD-…* |

### Akt 1b · Anruf ohne Struktur — lokale KI (≈ 45 Sek, wenn Ollama läuft)
| Aktion | Was man sagt | Erwartetes Ergebnis |
|---|---|---|
| Tab **Phone / Speech-to-Text**, folgenden Text einfügen (oder einsprechen) | „Ein echter Anruf hat keine Formularfelder." | — |
| **Create case** | „Eine lokale KI strukturiert den Anruf — nichts verlässt den Rechner. Erfundene IDs werden verworfen." | Status *Extracted with local AI*, Felder gefüllt, Priorität **1** mit Begründung *flameout reported* |
| Priorität auf 3 ändern | „Der Mensch kann überstimmen — beides bleibt sichtbar." | *Reviewer set 3 - Medium* neben dem Systemvorschlag |

```
Hello, this is the duty engineer from Demo Baltic Wings. Aircraft DEMO-AC-009, engine 1 serial DEMO-ENG-00017, flamed out during cruise this morning around 07:15 UTC, relight was not successful and they diverted to Copenhagen. We would like the aircraft back in service tomorrow.
```

### Akt 1c · EHM-Alarm — bevor jemand anruft (≈ 40 Sek)
| Aktion | Was man sagt | Erwartetes Ergebnis |
|---|---|---|
| Tab **EHM alert** → **Receive demo EHM alert** → **Create case** | „Oft meldet sich das Triebwerk selbst, noch im Flug." | Source *EHM Alert*, Status *In flight*, Vibration über Limit |
| Danach Tab **Email / Text**, kurze Meldung zum selben Flugzeug (DEMO-AC-007) → **Create case** | „Kommt später ein Anruf zum selben Ereignis, erkennt das System das Duplikat." | Banner *Possible duplicate of IFSD-…* → **Add this message to …** hängt die Nachricht an den bestehenden Case (Nachrichtenverlauf im Originaltext) |

### Akt 2 · Response — Analyse & Ressourcen (≈ 90 Sek)
**Analyse & assign resources** klicken.

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
| Alternativ **Dispatch support**, 2 Ressourcen anhaken, Name eintragen | „Rolls-Royce entscheidet über die Unterstützung. Die Freigabe des Flugzeugs (Return to Service) bleibt bei der Wartungsorganisation des Betreibers." | — |
| **Record decision** | Nachvollziehbarkeit | Status-Pille *Support dispatched · Name · Zeit*, gespeichert in der DB (inkl. Historie) |

### Akt 3b · Status & Abschluss (≈ 40 Sek)
| Aktion | Was man sagt | Erwartetes Ergebnis |
|---|---|---|
| Statusleiste im Kopf: In flight → On ground → Inspection → Repair | „Jeder Case hat einen Lebenszyklus." | Status wird gespeichert und in der Historie gezeigt |
| Hinweis *Possibly reportable occurrence* | „Bei Abschaltung, Feuer oder Flameout erinnert das System an die Meldepflicht (z. B. 72 h nach EU 376/2014). Das Team prüft das." | Frist ab Ereigniszeit |
| **Close case** mit bestätigter Ursache | „Die Ursache erscheint bei ähnlichen Fällen." | Status *Closed*; ähnliche Fälle zeigen *Root cause: …* |
| Overview-Kachel **Event to decision** | „Wir messen, wie schnell entschieden wird und wie lange ein Flugzeug am Boden steht." | Ø Zeit bis Entscheidung, Ø Zeit bis Abschluss |

### Akt 4 · Zurück ins Lagebild & Dashboard (≈ 40 Sek)
| Aktion | Was man sagt | Erwartetes Ergebnis |
|---|---|---|
| **Overview** | „Der Case ist sofort im Lagebild, offene Entscheidungen −1." | neuer Marker bei Shannon (weiß umrandet = entschieden) |
| Marker anklicken → **Incident dashboard** | „Operative Einsatzsicht pro Case." | Kacheln mit Notes, Weather (Demo), Action, Field Service, Spare Parts, Aircraft |
| **Open response & decision** | Rücksprung | Response-Screen desselben Cases |


---

### Extras für Rückfragen
- **Response → Case history:** jede Änderung und Entscheidung mit Zeit und Person (Audit-Trail).
- **Response → Engine indicators:** simulierte EHM-Kurven mit Alarmgrenze, ATA-Kapitel, Flugzeug- und Triebwerkstyp.
- **Dashboard → Weather:** echtes METAR des Flughafens, wenn Internet da ist, sonst Demo-Wetter.
- **Saved cases → Extraction accuracy → Run check:** Trefferquote der Regeln und der lokalen KI über die Demo-Cases.

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

- **Kein Internet:** Karte wechselt automatisch auf die Offline-Weltkarte.
- **„Rule-based extraction (local AI not available)“:** Ollama läuft nicht → Ollama-App starten; die Demo funktioniert auch ohne.
- **Overview leer:** `python3 seed_demo_cases.py` ausführen und Seite neu laden.
- **„Start python server.py …":** Seite wurde per Doppelklick (`file://`) geöffnet → über `http://127.0.0.1:8000` öffnen.
- **Transkription „nicht erreichbar":** vorausgefüllten Text nutzen.
- **Auf dem Handy zeigen:** `Start IFSD Hub (Handy).command` (oder `python3 server.py --lan`) starten, die angezeigte Adresse im selben WLAN auf dem Handy öffnen. Die Sprachaufnahme geht nur am Laptop.
