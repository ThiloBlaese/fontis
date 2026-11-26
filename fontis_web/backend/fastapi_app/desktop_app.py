import os
import sys
import time
import socket
import threading
import logging

# Ensure backend directory is in python path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

import uvicorn
import webview
from main import app
from fontis.app_config import get_active_db_path, release_db_lock

logger = logging.getLogger("fontis_desktop")

def find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]

def run_server(port: int):
    # Run uvicorn server in background thread
    config = uvicorn.Config(app=app, host="127.0.0.1", port=port, log_level="warning")
    server = uvicorn.Server(config)
    server.run()

class DesktopApi:
    def __init__(self, base_url: str = ""):
        self._window = None
        self._base_url = base_url.rstrip("/")

    def set_window(self, window):
        self._window = window

    def open_url_externally(self, url: str):
        """Opens a relative or absolute URL in the user's default system browser/viewer."""
        import webbrowser
        if not url:
            return False
        full_url = f"{self._base_url}{url}" if url.startswith("/") and self._base_url else url
        webbrowser.open(full_url)
        return True

    def toggle_fullscreen(self):
        if self._window:
            self._window.toggle_fullscreen()

    def exit_app(self):
        if self._window:
            self._window.destroy()

    def choose_database_file(self):
        """Open native file chooser for opening an existing .db file"""
        if self._window:
            result = self._window.create_file_dialog(
                webview.OPEN_DIALOG,
                file_types=('SQLite Datenbank (*.db;*.sqlite;*.sqlite3)', 'Alle Dateien (*.*)')
            )
            if result and len(result) > 0:
                return result[0]
        return None

    def choose_new_database_file(self, default_name="archiv.db"):
        """Open native file chooser for saving/creating a new .db file"""
        if self._window:
            result = self._window.create_file_dialog(
                webview.SAVE_DIALOG,
                save_filename=default_name,
                file_types=('SQLite Datenbank (*.db)', 'Alle Dateien (*.*)')
            )
            if result:
                if isinstance(result, (list, tuple)) and len(result) > 0:
                    return result[0]
                elif isinstance(result, str):
                    return result
        return None

    def save_file_dialog(self, default_name: str, file_type_label: str = "Alle Dateien", extension: str = "*"):
        """Open native Save As dialog for exporting files (PDF, CSV, JSON, XML)."""
        import re
        if self._window:
            safe_label = re.sub(r'[^\w ]+', ' ', file_type_label).strip() or "Datei"
            ext_pattern = f"*.{extension}" if extension != "*" else "*.*"
            file_types = (f"{safe_label} ({ext_pattern})", "Alle Dateien (*.*)")
            result = self._window.create_file_dialog(
                webview.SAVE_DIALOG,
                save_filename=default_name,
                file_types=file_types
            )
            if result:
                if isinstance(result, (list, tuple)) and len(result) > 0:
                    return result[0]
                elif isinstance(result, str):
                    return result
        return None

    def write_base64_file(self, target_path: str, b64_content: str):
        """Writes base64-encoded binary content to the chosen local file path."""
        import base64
        data = base64.b64decode(b64_content)
        with open(target_path, "wb") as f:
            f.write(data)
        return True

def main():
    port = find_free_port()
    server_thread = threading.Thread(target=run_server, args=(port,), daemon=True)
    server_thread.start()

    url = f"http://127.0.0.1:{port}"
    time.sleep(1.2)

    icon_path = os.path.join(BASE_DIR, "../../public/fontis_favicon.png")
    if not os.path.exists(icon_path):
        icon_path = os.path.join(BASE_DIR, "../../../fontis_favicon.png")

    def on_closed():
        try:
            active_db = get_active_db_path()
            release_db_lock(active_db)
        except Exception:
            pass

    try:
        api = DesktopApi(base_url=url)
        window = webview.create_window(
            title="Fontis – Freies Archivsystem",
            url=url,
            width=1280,
            height=850,
            min_size=(640, 480),
            maximized=True,
            js_api=api
        )
        api.set_window(window)
        window.events.closed += on_closed
        # Enable persistent storage so that HTML5 localStorage and session data work properly in WebKit
        storage_dir = os.path.expanduser("~/.fontis/webview_storage")
        os.makedirs(storage_dir, exist_ok=True)
        webview.start(private_mode=False, storage_path=storage_dir)
    except Exception as e:
        print(f"\n[Hinweis] Natives GUI-Fenster nicht verfügbar ({e}).")
        print(f"Öffne Fontis im Standardbrowser: {url}\n")
        import webbrowser
        webbrowser.open(url)
        print("="*50)
        print("  Fontis läuft. Drücke STRG+C zum Beenden.")
        print("="*50)
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\nFontis wird beendet...")
    finally:
        on_closed()

if __name__ == "__main__":
    main()
