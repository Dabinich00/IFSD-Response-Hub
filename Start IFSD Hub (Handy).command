#!/bin/bash
# Doppelklick startet den Hub auch für Handys und Tablets im selben WLAN.
cd "$(dirname "$0")"
PY=python3
[ -x .venv/bin/python ] && PY=.venv/bin/python
(sleep 2 && open "http://127.0.0.1:8000") &
echo "Die Handy-Adresse steht unten. macOS fragt eventuell, ob eingehende Verbindungen erlaubt sind: Erlauben."
echo "Nur im eigenen oder vertrauenswürdigen WLAN nutzen. Zum Beenden dieses Fenster schließen oder Ctrl+C."
"$PY" server.py --lan
