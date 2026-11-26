import logging
import os
import time
from typing import Any

from fastapi import Depends, Request

from fontis.app_config import get_active_db_path, init_archive_database
from fontis.auth_deps import get_current_user
from fontis.backup_service import BackupService
from fontis.db_manager import DBManager
from fontis.search_service import SearchService

logger = logging.getLogger("fontis_backend")

BACKUP_INTERVAL_SECONDS = 48 * 3600  # 2 days


def get_archive_db_path() -> str:
    """Returns the active archive .db path, initializing it if missing."""
    path = get_active_db_path()
    if not os.path.exists(path):
        init_archive_database(path)
    return path


def get_db_manager(current_user: dict = Depends(get_current_user)) -> DBManager:
    return DBManager(get_archive_db_path())


def get_search_service(current_user: dict = Depends(get_current_user)) -> SearchService:
    return SearchService(get_archive_db_path())


def get_backup_service(current_user: dict = Depends(get_current_user)) -> BackupService:
    db_path = get_archive_db_path()
    prefix = os.path.splitext(os.path.basename(db_path))[0]
    backup_dir = os.path.join(os.path.dirname(db_path), "backups")
    os.makedirs(backup_dir, exist_ok=True)
    return BackupService(db_path, backup_dir, backup_prefix=prefix)


def check_admin(request: Request = None, current_user: dict = Depends(get_current_user)) -> dict:
    """In standalone mode, the local user has full admin access."""
    return current_user


def check_bearbeiter(request: Request = None, current_user: dict = Depends(get_current_user)) -> dict:
    """Alias for check_admin in standalone mode."""
    return current_user


def perform_all_backups() -> None:
    """Creates a snapshot of the active archive .db file (excluding digital assets)."""
    try:
        active_db = get_active_db_path()
        if os.path.exists(active_db):
            logger.info(f"Backing up active archive database: {active_db}")
            backup_dir = os.path.join(os.path.dirname(active_db), "backups")
            os.makedirs(backup_dir, exist_ok=True)
            prefix = os.path.splitext(os.path.basename(active_db))[0]
            service = BackupService(active_db, backup_dir, backup_prefix=prefix)
            service.perform_backup()
    except Exception as e:
        logger.error(f"Backup failed: {e}", exc_info=True)


def ensure_recent_backup() -> None:
    """Creates an automatic backup only if no backup exists within the last 48 hours."""
    try:
        active_db = get_active_db_path()
        if not os.path.exists(active_db):
            return

        backup_dir = os.path.join(os.path.dirname(active_db), "backups")
        prefix = os.path.splitext(os.path.basename(active_db))[0]

        run_backup = True
        if os.path.exists(backup_dir):
            files = [
                f for f in os.listdir(backup_dir)
                if f.startswith(f"{prefix}_") and f.endswith(".db")
            ]
            if files:
                newest_file = max(files, key=lambda f: os.path.getmtime(os.path.join(backup_dir, f)))
                mtime = os.path.getmtime(os.path.join(backup_dir, newest_file))
                if time.time() - mtime < BACKUP_INTERVAL_SECONDS:
                    run_backup = False
                    logger.info("Backup check: Newest backup is less than 48 hours old. Skipping automatic backup.")

        if run_backup:
            logger.info("Backup check: No backup within last 48 hours. Creating automatic backup in background...")
            perform_all_backups()
    except Exception as e:
        logger.error(f"Failed to check/run automatic backup: {e}", exc_info=True)
