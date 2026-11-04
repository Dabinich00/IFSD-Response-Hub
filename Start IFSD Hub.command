#!/bin/bash
# Doppelklick startet den IFSD Response Hub und öffnet den Browser.
cd "$(dirname "$0")"
PY=python3
[ -x .venv/bin/python ] && PY=.venv/bin/python
(sleep 2 && open "http://127.0.0.1:8000") &
echo "IFSD Response Hub läuft auf http://127.0.0.1:8000 — zum Beenden dieses Fenster schließen oder Ctrl+C."
"$PY" server.py
