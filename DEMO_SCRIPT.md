# Demo-Szenario & Präsentations-Skript

Ein durchgängiges Szenario, das **alle Funktionen des Prototyps von A bis Z** zeigt
und gleichzeitig als Funktionstest dient. Dauer: ca. 4–6 Minuten.

> Alle Werte sind Demo-/Mock-Daten. Die sicherheitskritische Entscheidung bleibt beim autorisierten Experten (Human-in-the-loop).

---

## Vorbereitung (vor der Präsentation)

1. Lokalen Server starten (Mikrofon-Aufnahme braucht `localhost` oder `https`):
   ```bash
   python3 -m http.server 8777
   ```
2. Im Browser öffnen: `http://localhost:8777/index.html`
3. Prüfen, dass die Weltkarte lädt (braucht Internet für die Kartenkacheln).
4. *Optional* für die Live-Transkription: lokalen `faster-whisper`-Dienst auf Port 9000 starten
   (siehe README). Ohne den Dienst wird die Transkription sauber übersprungen — der
   Intake-Text ist bereits vorausgefüllt, die Demo läuft auch ohne Mikrofon.

**Reset zwischen zwei Durchläufen:** Seite neu laden (⌘/Strg + R) oder im Intake einfach
erneut auf **„Case automatisch erstellen"** klicken.

---

## Das Szenario

> **Der Fall:** Ein Anruf meldet einen In-Flight Shutdown auf **Flug LH412** (Lufthansa),
> Boeing 787-9 mit Trent 1000, auf der Strecke **New York → Frankfurt**. Um 09:42 UTC
> in FL350 über dem **Nordatlantik** schaltet die Crew nach erhöhten Vibrationen und
> EGT-Anstieg **Triebwerk 2 ab**. Der Flug wird nach **Shannon** umgeleitet. Ölstand,
> vollständige EHM-Daten und ein bestätigtes Crew-Statement fehlen noch.

Dieser Text ist im Intake-Feld **bereits vorausgefüllt** — für die Demo muss nichts getippt werden.

**Transkript (falls es neu eingefügt werden muss):**

```
Pilot meldet Engine Shutdown auf Flug LH412 von New York nach Frankfurt. Boeing 787-9, Trent 1000. Ereignis um 09:42 UTC in FL350 über dem Nordatlantik. Crew meldete vorher erhöhte Vibrationen und EGT-Anstieg. Engine 2 wurde abgeschaltet. Flug wird nach Shannon umgeleitet. Keine Verletzten. Ölstand und detaillierte EHM-Daten liegen aktuell noch nicht vor.
```

---

## A → Z Walkthrough

### Akt 0 · Overview — das Lagebild (≈ 20 Sek)
Die App öffnet auf **Overview**.

| Aktion | Was man zeigt / sagt | Erwartetes Ergebnis |
|---|---|---|
| — | „Das ist unser globales Lagebild: alle aktiven IFSD-Cases weltweit auf einer echten Karte." | Weltkarte mit farbigen Case-Markern (nach Priorität), Team- und Part-Markern |
| Toggle **Weather** an/aus | Layer-Steuerung demonstrieren | Wetter-Overlay erscheint / verschwindet |
| Auf Kacheln unten zeigen | „Kennzahlen werden aus den Daten berechnet." | Active cases **7**, Prioritäts-Verteilung, Recommendations |

### Akt 1 · Intake — der Anruf wird zum Case (≈ 90 Sek)
Oben auf **„1 · Intelligent Incident Intake"** klicken.

| Aktion | Was man zeigt / sagt | Erwartetes Ergebnis |
|---|---|---|
| Auf das Whisper-Widget zeigen | „Telefon-Anruf → lokale Speech-to-Text mit faster-whisper. Audio verlässt den lokalen Dienst nicht." | Widget „Local AI Transcription / faster-whisper", Status **Bereit** |
| *(optional)* **Aufnahme starten** → sprechen → **Stoppen & transkribieren** | Live-Transkription zeigen | Timer läuft, Text landet im Feld (bei laufendem Whisper-Dienst) |
| **Case automatisch erstellen** klicken | „Aus unstrukturiertem Text wird ein strukturierter Case." | Rechts füllen sich alle Felder |

**Erwartete extrahierte Felder:**

| Feld | Wert |
|---|---|
| Case-ID | IFSD-2026-0903-017 |
| Priorität | **CRITICAL** (Keyword „shutdown") |
| Flugnummer | LH412 |
| Flugzeug | Boeing 787-9 |
| Triebwerk | Trent 1000 |
| Zeitpunkt | 09:42 UTC |
| Flughöhe | FL350 |
| Ort | Nordatlantik |
| Route | New York → Frankfurt |
| Kunde | LHA *(aus Flug-Präfix abgeleitet)* |
| Problem | Engine Shutdown |

> **Pointe:** „Die Felder sind editierbar — der Experte behält die Kontrolle." Ein Feld
> ändern und **„Änderungen speichern"** klicken (Button quittiert mit *Gespeichert ✓*).

**Fehlende Informationen** (werden aus dem Text abgeleitet, nicht hartcodiert):
- ☐ Ölstand / Oil-System-Informationen
- ☐ vollständiger EHM-Datensatz
- ☐ bestätigtes Crew Statement
- *Case Completeness: **75 %** · 3 Feld(er) offen*

### Akt 2 · Rückfrage — die Lücken schließen (≈ 60 Sek)

| Aktion | Was man zeigt / sagt | Erwartetes Ergebnis |
|---|---|---|
| Alle **3 Checkboxen** anhaken | „Das System weiß, was fehlt, und formuliert die Rückfrage." | Pill **„Rückfrage ausstehend"** erscheint |
| **Rückfrage erstellen** | fertige Nachricht zeigen | Textfeld mit Betreff + „Bitte senden Sie uns für LH412 …" + Auflistung |
| In **„Erhaltene Antwort / Ergänzung"** die Antwort einfügen (Text unten) | „Kunde/Crew antwortet, der Experte übernimmt die Angaben." | — |
| **Ausgewählte Angaben übernehmen** | Completeness steigt | Fehlende Liste → **✓ Alle Pflichtfelder erkannt (100 %)**, Pill verschwindet |

**Antwort zum Einfügen:**

```
Ölstand 21 qt, im Normbereich. EHM-Datensatz vollständig nachgereicht. Crew-Statement bestätigt: keine weiteren Auffälligkeiten, Landung in Shannon planmäßig.
```

### Akt 3 · Response — Analyse & Ressourcen (≈ 90 Sek)
**„Weiter zu Analyse & Ressourcen"** klicken (unten).

| Aktion | Was man zeigt / sagt | Erwartetes Ergebnis |
|---|---|---|
| Kopf ansehen | „Derselbe Case, angereichert." | Titel *IFSD-2026-0903-017 · LH412*, rote **Priority 1**-Pille, Meta „…Nordatlantik → Ausweichflughafen Shannon (SNN)" |
| EHM-Karte | Sensorik zeigen | EGT ↑ 14 %, Vibration hoch (rot markiert) |
| Completeness-Karte | Vollständigkeit | Wert + verbleibende Lücken |
| Ähnliche Fälle | historischer Kontext | 3 Referenzfälle mit Match-% |
| **Geo Resource Map** | echte Karte | Event-Marker (Nordatlantik) → gestrichelte Linie → Shannon, dazu Ressourcen-Marker |
| Empfohlene Ressourcen | ETA-Vorschläge | Shannon Service Partner · RR Specialist · Replacement Part Kit |
| Auf die Human-in-the-loop-Box zeigen | **Kernbotschaft** | „System schlägt vor — der Experte entscheidet." |

### Akt 4 · Zurück zur Overview — der Case im Lagebild (≈ 20 Sek)
Oben auf **„Overview"** klicken.

| Aktion | Was man zeigt / sagt | Erwartetes Ergebnis |
|---|---|---|
| Auf den **rot umrandeten Marker** über dem Nordatlantik zeigen | „Der neue Case erscheint sofort im globalen Lagebild." | Live-Marker (rote Umrandung) auf der Karte |

### Akt 5 · Incident Dashboard — Einsatzsicht pro Case (≈ 40 Sek)

| Aktion | Was man zeigt / sagt | Erwartetes Ergebnis |
|---|---|---|
| Auf einen **Case-Marker** klicken → im Popup **„Open incident dashboard →"** | „Ein Klick öffnet die operative Einsatzsicht des Cases." | Wechsel ins **Incident Dashboard** mit den Daten dieses Cases |
| Kacheln durchgehen | Visualisation · Notes · Weather · Solving/Team · Spare Parts · Flighttrip | alle Kacheln zeigen die Case-Daten (z. B. Trip in Weather/Flighttrip) |
| **„Response & Ressourcen →"** | Rücksprung in die Analyse desselben Cases | Response-Screen für diesen Case |
| **◀** (oben links) | zurück zur Overview | Overview |

---

## Roter Faden (die eine Botschaft)

Ein Ereignis (Anruf/E-Mail) wird **erfasst → strukturiert → auf Lücken geprüft →
angereichert → mit Ressourcen verknüpft**, und derselbe Case ist über **alle vier
Screens** konsistent sichtbar. Die finale sicherheitskritische Entscheidung bleibt
immer beim autorisierten Experten.

## Test-Checkliste (deckt die Akzeptanzkriterien ab)

- [ ] Wie ein Incident ins System kommt → **Akt 1** (Transkript/Text)
- [ ] Aus unstrukturiert wird strukturiert → **Akt 1** (Felder)
- [ ] Was fehlt → **Akt 1/2** (Fehlende Informationen, Rückfrage)
- [ ] Wie das Ereignis analysiert wird → **Akt 3** (EHM, ähnliche Fälle)
- [ ] Welche Ressourcen verfügbar sind → **Akt 3** (Karte, Empfehlungen)
- [ ] Dass die Entscheidung menschlich bleibt → **Akt 3** (Human-in-the-loop-Box)

## Fallback, falls etwas klemmt

- **Karte grau/leer:** kein Internet → Kartenkacheln fehlen. Marker und Logik funktionieren trotzdem.
- **Transkription meldet „nicht erreichbar":** Whisper-Dienst läuft nicht → einfach den
  vorausgefüllten Text nutzen und **„Case automatisch erstellen"** klicken.
- **Mikrofon reagiert nicht:** über `http://localhost` statt `file://` öffnen.
