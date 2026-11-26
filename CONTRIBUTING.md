# Mitwirken an Fontis (Contributing)

Beiträge, Fehlermeldungen und Verbesserungsvorschläge sind herzlich willkommen!

*(English note: Contributions, bug reports, and pull requests are very welcome. Feel free to open issues or PRs in German or English.)*

---

## Fehler melden & Ideen einbringen

- Bitte prüfe vor dem Erstellen eines neuen Issues kurz, ob das Thema bereits gemeldet wurde.
- Bei Fehlermeldungen helfen folgende Angaben enorm:
  - Betriebssystem (z. B. Ubuntu 24.04, Windows 11) und Python-/Node-Version
  - Schritte zum Nachstellen des Fehlers
  - Relevante Meldungen aus der Konsole oder aus `fontis.log`

---

## Entwicklungsumgebung einrichten

### Voraussetzungen
- **Python 3.10+** (mit `venv` und `pip`)
- **Node.js 20+** (mit `npm`)

### 1. Repository klonen & Frontend bauen
```bash
cd fontis_web
npm install
npm run build
```

Für die aktive Frontend-Entwicklung mit Hot-Reload:
```bash
npm run dev
```

### 2. Backend-Umgebung einrichten
```bash
cd fontis_web/backend/fastapi_app
python3 -m venv --system-site-packages venv
./venv/bin/pip install -r requirements-dev.txt
```

Backend lokal starten:
```bash
./venv/bin/uvicorn main:app --reload --port 8000
```

Oder direkt als Desktop-Anwendung starten:
```bash
./start_fontis.sh
```

---

## Tests ausführen

Bitte stelle vor jedem Pull Request sicher, dass Build und Tests durchlaufen:

**Frontend (Vitest + Build):**
```bash
cd fontis_web
npm test
npm run build
```

**Backend (pytest):**
```bash
cd fontis_web/backend/fastapi_app
./venv/bin/python -m pytest tests/
```

---

## Pull Requests

1. Forke das Repository und erstelle einen beschreibenden Branch (z. B. `fix/csv-encoding` oder `feat/keyboard-shortcut`).
2. Halte Änderungen möglichst fokussiert und nachvollziehbar.
3. Ergänze bei neuer Logik oder Bugfixes nach Möglichkeit passende Unit-Tests.
4. Beschreibe im Pull Request kurz, **was** geändert wurde und **warum**.

Mit dem Einreichen eines Pull Requests erklärst du dich damit einverstanden, dass dein Beitrag unter der [MIT-Lizenz](LICENSE) dieses Projekts veröffentlicht wird.
