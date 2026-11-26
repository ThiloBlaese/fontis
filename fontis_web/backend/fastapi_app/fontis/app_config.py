import os
import json
import socket
import getpass
import time
import logging
import sqlite_utils
from typing import Dict, Any, List, Optional
from fontis.migration import ensure_schema, migrate_db

logger = logging.getLogger("fontis_config")

# Default config directory: ~/.fontis or fallback to current dir
HOME_DIR = os.path.expanduser("~")
DEFAULT_FONTIS_DIR = os.path.join(HOME_DIR, ".fontis")
DEFAULT_DATA_DIR = os.path.join(HOME_DIR, "Fontis")
CONFIG_FILE = os.path.join(DEFAULT_FONTIS_DIR, "config.json")

def get_config_path() -> str:
    try:
        os.makedirs(DEFAULT_FONTIS_DIR, exist_ok=True)
        return CONFIG_FILE
    except Exception:
        return os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "fontis_config.json")

def load_config() -> Dict[str, Any]:
    cfg_path = get_config_path()
    if os.path.exists(cfg_path):
        try:
            with open(cfg_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Failed to read config from {cfg_path}: {e}")
    
    # Defaults
    default_db = os.path.join(DEFAULT_DATA_DIR, "archiv.db")
    return {
        "active_db_path": default_db,
        "recent_dbs": [default_db]
    }

def save_config(cfg: Dict[str, Any]):
    cfg_path = get_config_path()
    try:
        with open(cfg_path, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Failed to save config to {cfg_path}: {e}")

def get_active_db_path() -> str:
    cfg = load_config()
    db_path = cfg.get("active_db_path")
    if not db_path:
        db_path = os.path.join(DEFAULT_DATA_DIR, "archiv.db")
    return os.path.abspath(db_path)

def check_db_lock(db_path: str) -> Optional[Dict[str, Any]]:
    """Returns lock info dict if locked by another user/host, else None."""
    lock_file = f"{db_path}.lock"
    if not os.path.exists(lock_file):
        return None
    try:
        with open(lock_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        # Check staleness: if older than 12 hours, ignore as stale
        if time.time() - data.get("timestamp", 0) > 12 * 3600:
            return None
        # Check if it's our own lock (same host and pid)
        if data.get("host") == socket.gethostname() and data.get("pid") == os.getpid():
            return None
        return data
    except Exception:
        return None

def acquire_db_lock(db_path: str) -> bool:
    lock_file = f"{db_path}.lock"
    lock_data = {
        "host": socket.gethostname(),
        "user": getpass.getuser(),
        "pid": os.getpid(),
        "timestamp": time.time(),
        "human_time": time.strftime("%Y-%m-%d %H:%M:%S")
    }
    try:
        os.makedirs(os.path.dirname(os.path.abspath(lock_file)), exist_ok=True)
        with open(lock_file, "w", encoding="utf-8") as f:
            json.dump(lock_data, f, indent=2)
        return True
    except Exception as e:
        logger.warning(f"Could not write lock file {lock_file}: {e}")
        return False

def release_db_lock(db_path: str):
    lock_file = f"{db_path}.lock"
    try:
        if os.path.exists(lock_file):
            os.remove(lock_file)
    except Exception as e:
        logger.warning(f"Could not remove lock file {lock_file}: {e}")

def init_archive_database(db_path: str, archive_name: str = "Mein Archiv"):
    """
    Ensures the SQLite database file exists, has all tables & FTS,
    and has at least one root node if brand new.
    """
    os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
    is_new = not os.path.exists(db_path) or os.path.getsize(db_path) == 0

    db = sqlite_utils.Database(db_path)
    ensure_schema(db)
    migrate_db(db_path)

    if is_new or db["nodes"].count == 0:
        db["nodes"].insert({
            "id": "root_main",
            "parent_id": None,
            "label": archive_name,
            "is_open": 1,
            "sort_order": 0,
            "layout_config": "[]"
        })
        logger.info(f"Initialized new archive database at {db_path} with root node '{archive_name}'")

def set_active_db_path(new_path: str, create_if_missing: bool = True, archive_name: str = "Mein Archiv") -> Dict[str, Any]:
    abs_path = os.path.abspath(new_path)
    if create_if_missing:
        init_archive_database(abs_path, archive_name=archive_name)
    
    cfg = load_config()
    old_db = cfg.get("active_db_path")
    if old_db and old_db != abs_path:
        release_db_lock(old_db)
    
    cfg["active_db_path"] = abs_path
    recent = cfg.get("recent_dbs", [])
    if abs_path in recent:
        recent.remove(abs_path)
    recent.insert(0, abs_path)
    cfg["recent_dbs"] = recent[:10] # keep last 10
    save_config(cfg)

    acquire_db_lock(abs_path)
    return {
        "status": "success",
        "active_db_path": abs_path,
        "recent_dbs": cfg["recent_dbs"]
    }
