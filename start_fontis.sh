#!/usr/bin/env bash
# ==============================================================================
#  Fontis – Das freie Archivsystem (Linux-Starter)
# ==============================================================================

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

DIST_INDEX="$SCRIPT_DIR/fontis_web/dist/index.html"
VENV_DIR="$SCRIPT_DIR/fontis_web/backend/fastapi_app/venv"
VENV_PYTHON="$VENV_DIR/bin/python3"
DESKTOP_SCRIPT="$SCRIPT_DIR/fontis_web/backend/fastapi_app/desktop_app.py"

if [ ! -f "$DIST_INDEX" ]; then
    echo "Frontend-Build nicht gefunden. Baue Frontend einmalig..."
    if ! command -v npm >/dev/null 2>&1; then
        echo "[Fehler] Node.js / npm nicht gefunden. Bitte Node.js 20+ installieren und 'cd fontis_web && npm install && npm run build' ausführen."
        exit 1
    fi
    (cd "$SCRIPT_DIR/fontis_web" && npm install && npm run build)
fi

if [ ! -f "$VENV_PYTHON" ]; then
    echo "Python-Umgebung wird beim ersten Start eingerichtet..."
    python3 -m venv --system-site-packages "$VENV_DIR"
    "$VENV_PYTHON" -m pip install -r "$SCRIPT_DIR/fontis_web/backend/fastapi_app/requirements.txt"
fi

echo "===================================================="
echo "  Starte Fontis – Freies Archivsystem               "
echo "===================================================="
exec "$VENV_PYTHON" "$DESKTOP_SCRIPT" "$@"
