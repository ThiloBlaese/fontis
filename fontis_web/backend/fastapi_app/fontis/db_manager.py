import sqlite3

import sqlite_utils

from fontis.db.import_export import ImportExportMixin
from fontis.db.nodes import NodeMixin
from fontis.db.records import RecordMixin


class DBManager(NodeMixin, RecordMixin, ImportExportMixin):
    """
    Facade over the SQLite archive database.

    Domain logic is modularized in ``fontis.db``:
    - ``nodes.py``: Tektonik / node hierarchy CRUD & drag-and-drop reordering
    - ``records.py``: records, FTS updates, app config, custom dictionary & digital assets
    - ``import_export.py``: full state snapshots and JSON / CSV import & export
    """

    def __init__(self, db_path: str):
        self.db_path = db_path
        conn = sqlite3.connect(db_path, check_same_thread=False, timeout=20.0)
        conn.execute("PRAGMA journal_mode=WAL;")
        self.db = sqlite_utils.Database(conn)
