import os
import sqlite3
import shutil
import logging
from datetime import datetime, timedelta
from typing import List

logger = logging.getLogger("fontis_backend.backup")

class BackupService:
    def __init__(self, db_path: str, backup_dir: str, backup_prefix: str = "fontis_backup"):
        self.db_path = db_path
        self.backup_dir = backup_dir
        self.backup_prefix = backup_prefix
        
        # Ensure backup directory exists
        if not os.path.exists(self.backup_dir):
            os.makedirs(self.backup_dir)

    def perform_backup(self) -> str:
        """
        Creates a consistent snapshot of the SQLite database.
        Returns the path to the created backup file.
        """
        logger.info(f"Starting database backup of {self.db_path}")
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        backup_filename = f"{self.backup_prefix}_{timestamp}.db"
        backup_path = os.path.join(self.backup_dir, backup_filename)

        try:
            # Use SQLite's online backup API for consistency
            source_conn = sqlite3.connect(self.db_path)
            dest_conn = sqlite3.connect(backup_path)
            
            with source_conn:
                source_conn.backup(dest_conn)
                
            dest_conn.close()
            source_conn.close()
            
            logger.info(f"Backup successfully created at: {backup_path}")
            
            # Rotate backups after a successful backup
            self.rotate_backups()
            
            return backup_path
            
        except Exception as e:
            logger.error(f"Failed to perform backup: {e}", exc_info=True)
            # If the backup failed, try to clean up the partial file
            if os.path.exists(backup_path):
                try:
                    os.remove(backup_path)
                except:
                    pass
            raise e

    def rotate_backups(self, max_backups: int = 15):
        """
        Keeps only the newest `max_backups` backups for the configured prefix
        and deletes older ones.
        """
        logger.info(f"Starting backup rotation for prefix {self.backup_prefix} (keep newest {max_backups})...")
        try:
            files = [f for f in os.listdir(self.backup_dir) if f.startswith(f"{self.backup_prefix}_") and f.endswith(".db")]

            backups = []
            for f in files:
                filepath = os.path.join(self.backup_dir, f)
                try:
                    date_str = f.replace(f"{self.backup_prefix}_", "").replace(".db", "")
                    dt = datetime.strptime(date_str, "%Y-%m-%d_%H-%M-%S")
                    backups.append((dt, filepath))
                except ValueError:
                    logger.warning(f"Unrecognized backup file format: {f}")

            # Sort backups newest to oldest
            backups.sort(key=lambda x: x[0], reverse=True)

            backups_to_keep = backups[:max_backups]
            backups_to_delete = backups[max_backups:]

            deleted_count = 0
            for _, filepath in backups_to_delete:
                logger.info(f"Deleting old backup: {filepath}")
                os.remove(filepath)
                deleted_count += 1

            logger.info(f"Backup rotation complete. Kept {len(backups_to_keep)} backups, deleted {deleted_count}.")

        except Exception as e:
            logger.error(f"Error during backup rotation: {e}", exc_info=True)

    def list_backups(self) -> List[dict]:
        """Returns a list of all available backups."""
        backups = []
        try:
            files = [f for f in os.listdir(self.backup_dir) if f.startswith(f"{self.backup_prefix}_") and f.endswith(".db")]
            for f in files:
                filepath = os.path.join(self.backup_dir, f)
                try:
                    date_str = f.replace(f"{self.backup_prefix}_", "").replace(".db", "")
                    dt = datetime.strptime(date_str, "%Y-%m-%d_%H-%M-%S")
                    size = os.path.getsize(filepath)
                    backups.append({
                        "filename": f,
                        "timestamp": dt.isoformat(),
                        "size_bytes": size
                    })
                except Exception as parse_error:
                    logger.warning(f"Error parsing backup file stats {f}: {parse_error}")
            
            backups.sort(key=lambda x: x["timestamp"], reverse=True)
        except Exception as e:
            logger.error(f"Error listing backups: {e}", exc_info=True)
        return backups

    def restore_backup(self, filename: str) -> bool:
        """Restores a backup file, replacing the active database."""
        backup_path = os.path.join(self.backup_dir, filename)
        if not os.path.exists(backup_path) or not filename.startswith(f"{self.backup_prefix}_"):
            logger.error(f"Backup file not found or invalid filename: {filename}")
            return False

        logger.info(f"Starting restoration from backup: {filename}")
        try:
            # Use SQLite's online backup API to copy pages from backup to active db.
            # This safely writes the pages to the active db file under SQLite's transactional
            # locking, ensuring that all other active connections to the database will
            # immediately see the restored state upon their next query, and the WAL/SHM files
            # are correctly updated/invalidated by SQLite itself.
            source_conn = sqlite3.connect(backup_path)
            dest_conn = sqlite3.connect(self.db_path, timeout=20.0)
            
            with dest_conn:
                source_conn.backup(dest_conn)
                
            dest_conn.close()
            source_conn.close()
            
            logger.info("Database restoration completed successfully.")
            return True
        except Exception as e:
            logger.error(f"Failed to restore backup: {e}", exc_info=True)
            return False
            
    def get_backup_path(self, filename: str) -> str:
        """Helper to get and validate the path for a backup file, for downloading."""
        backup_path = os.path.join(self.backup_dir, filename)
        # Prevent path traversal
        if os.path.dirname(os.path.abspath(backup_path)) != os.path.abspath(self.backup_dir):
            return None
            
        if not os.path.exists(backup_path):
            return None
            
        return backup_path
