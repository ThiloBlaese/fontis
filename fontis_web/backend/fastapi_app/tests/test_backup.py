import os
import sqlite3
import pytest
from fontis.backup_service import BackupService

def test_backup_restore_with_active_connection(tmp_path):
    db_file = tmp_path / "test.db"
    backup_dir = tmp_path / "backups"
    
    # 1. Initialize DB with some data in WAL mode
    conn = sqlite3.connect(str(db_file))
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("CREATE TABLE foo (id INTEGER PRIMARY KEY, name TEXT);")
    conn.execute("INSERT INTO foo (name) VALUES ('original');")
    conn.commit()
    conn.close()
    
    # 2. Create backup
    service = BackupService(str(db_file), str(backup_dir), backup_prefix="test_backup")
    backup_path = service.perform_backup()
    filename = os.path.basename(backup_path)
    
    # 3. Modify DB to have new data
    conn = sqlite3.connect(str(db_file))
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("UPDATE foo SET name = 'modified';")
    conn.commit()
    
    # Keep the connection open to simulate an active application connection
    
    # 4. Restore backup
    success = service.restore_backup(filename)
    assert success is True
    
    # 5. Check if restored data is readable by a new connection
    conn2 = sqlite3.connect(str(db_file))
    cursor = conn2.execute("SELECT name FROM foo;")
    row = cursor.fetchone()
    # If the restore worked, name should be 'original'
    assert row[0] == "original"
    conn2.close()
    
    conn.close()

def test_backup_rotation_keeps_newest_15(tmp_path):
    from datetime import datetime, timedelta

    db_file = tmp_path / "test.db"
    backup_dir = tmp_path / "backups"
    os.makedirs(str(backup_dir), exist_ok=True)

    prefix = "test_rot"
    service = BackupService(str(db_file), str(backup_dir), backup_prefix=prefix)

    now = datetime.now()
    paths = []
    # Create 20 mock backups spaced 1 hour apart (index 0 = newest, index 19 = oldest)
    for i in range(20):
        dt = now - timedelta(hours=i)
        timestamp = dt.strftime("%Y-%m-%d_%H-%M-%S")
        filepath = backup_dir / f"{prefix}_{timestamp}.db"
        with open(filepath, "w") as f:
            f.write("mock db")
        paths.append(str(filepath))

    service.rotate_backups(max_backups=15)

    for i, path in enumerate(paths):
        if i < 15:
            assert os.path.exists(path) is True
        else:
            assert os.path.exists(path) is False
