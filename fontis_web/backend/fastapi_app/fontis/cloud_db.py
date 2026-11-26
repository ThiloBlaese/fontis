import sqlite_utils
import logging
import time
import os
import uuid
from typing import List, Dict, Any, Optional
import sqlite3

logger = logging.getLogger("fontis_cloud")

class CloudDBManager:
    def __init__(self, db_path: str):
        self.db_path = db_path
        # Ensure directory exists
        db_dir = os.path.dirname(db_path)
        os.makedirs(db_dir, exist_ok=True)

        # Self-healing permissions: If we are running as root (e.g. in Docker), 
        # ensure the directory and DB file are writable so SQLite can create WAL/SHM files.
        if os.getuid() == 0:
            try:
                os.chmod(db_dir, 0o777)
                if os.path.exists(db_path):
                    os.chmod(db_path, 0o666)
            except Exception as e:
                logger.warning(f"Could not adjust permissions for {db_path}: {e}")
        
        conn = sqlite3.connect(db_path, check_same_thread=False, timeout=20.0)
        conn.execute("PRAGMA journal_mode=WAL;")
        self.db = sqlite_utils.Database(conn)
        self.ensure_schema()

    def ensure_schema(self):
        # Folders Table
        if "folders" not in self.db.table_names():
            self.db["folders"].create({
                "id": str,
                "parent_id": str,
                "name": str,
                "created_at": float,
                "updated_at": float
            }, pk="id", foreign_keys=[("parent_id", "folders", "id")])
            self.db["folders"].create_index(["parent_id"], if_not_exists=True)

        # Files Table
        if "files" not in self.db.table_names():
            self.db["files"].create({
                "id": str,
                "folder_id": str,
                "name": str,
                "size": int,
                "mime_type": str,
                "storage_path": str,
                "thumbnail_id": str,
                "created_at": float,
                "updated_at": float
            }, pk="id", foreign_keys=[("folder_id", "folders", "id")])
            self.db["files"].create_index(["folder_id"], if_not_exists=True)
        elif "thumbnail_id" not in self.db["files"].columns_dict:
            self.db["files"].add_column("thumbnail_id", str)
        
        self.db.conn.commit()

    def get_folders(self, parent_id: Optional[str] = None) -> List[Dict[str, Any]]:
        return list(self.db["folders"].rows_where("parent_id IS ?", [parent_id]))

    def get_files(self, folder_id: Optional[str] = None) -> List[Dict[str, Any]]:
        return list(self.db["files"].rows_where("folder_id IS ?", [folder_id]))

    def get_all_files(self) -> List[Dict[str, Any]]:
        """Returns all files in the cloud database for garbage collection."""
        return list(self.db["files"].rows)

    def create_folder(self, name: str, parent_id: Optional[str] = None) -> Dict[str, Any]:
        folder_id = str(uuid.uuid4())
        now = time.time()
        folder = {
            "id": folder_id,
            "parent_id": parent_id,
            "name": name,
            "created_at": now,
            "updated_at": now
        }
        self.db["folders"].insert(folder)
        return folder

    def add_file(self, name: str, size: int, mime_type: str, storage_path: str, folder_id: Optional[str] = None, thumbnail_id: Optional[str] = None) -> Dict[str, Any]:
        file_id = str(uuid.uuid4())
        now = time.time()
        file_record = {
            "id": file_id,
            "folder_id": folder_id,
            "name": name,
            "size": size,
            "mime_type": mime_type,
            "storage_path": storage_path,
            "thumbnail_id": thumbnail_id,
            "created_at": now,
            "updated_at": now
        }
        self.db["files"].insert(file_record)
        return file_record

    def delete_file(self, file_id: str) -> Optional[Dict[str, Any]]:
        """Deletes file record and returns record for physical deletion."""
        try:
            file_record = self.db["files"].get(file_id)
            self.db["files"].delete(file_id)
            return file_record
        except sqlite_utils.db.NotFoundError:
            return None

    def delete_folder_recursive(self, folder_id: str) -> List[str]:
        """Deletes folder and all sub-items. Returns list of storage_paths to delete physically."""
        paths_to_delete = []
        
        # Files in this folder
        for f in self.get_files(folder_id):
            paths_to_delete.append(f["storage_path"])
            if f.get("thumbnail_id"):
                # Note: This is an internal filename, same logic as storage_path
                paths_to_delete.append(f["thumbnail_id"])
            self.db["files"].delete(f["id"])
            
        # Subfolders
        for sub in self.get_folders(folder_id):
            paths_to_delete.extend(self.delete_folder_recursive(sub["id"]))
            
        # The folder itself
        self.db["folders"].delete(folder_id)
        
        return paths_to_delete

    def has_files_recursive(self, folder_id: str) -> bool:
        """Checks if a folder or any of its subfolders contain files recursively."""
        if len(self.get_files(folder_id)) > 0:
            return True
        for sub in self.get_folders(folder_id):
            if self.has_files_recursive(sub["id"]):
                return True
        return False

    def get_file(self, file_id: str) -> Optional[Dict[str, Any]]:
        try:
            return self.db["files"].get(file_id)
        except sqlite_utils.db.NotFoundError:
            return None

    def get_folder(self, folder_id: str) -> Optional[Dict[str, Any]]:
        try:
            return self.db["folders"].get(folder_id)
        except sqlite_utils.db.NotFoundError:
            return None

    def get_all_folders(self) -> List[Dict[str, Any]]:
        """Returns all folders in the cloud database."""
        return list(self.db["folders"].rows)

    def move_file(self, file_id: str, folder_id: Optional[str]) -> bool:
        """Moves a file to a new folder (or root)."""
        try:
            self.db["files"].update(file_id, {"folder_id": folder_id, "updated_at": time.time()})
            return True
        except sqlite_utils.db.NotFoundError:
            return False

    def move_folder(self, folder_id: str, parent_id: Optional[str]) -> bool:
        """Moves a folder to a new parent folder (or root)."""
        # Prevent moving a folder into itself
        if folder_id == parent_id:
            return False
            
        try:
            self.db["folders"].update(folder_id, {"parent_id": parent_id, "updated_at": time.time()})
            return True
        except sqlite_utils.db.NotFoundError:
            return False

    def get_total_size(self) -> int:
        """Returns total size of all files in bytes."""
        try:
            # We sum the 'size' column from the 'files' table
            result = list(self.db.query("SELECT SUM(size) as total FROM files"))
            if result and result[0]["total"] is not None:
                return int(result[0]["total"])
            return 0
        except Exception as e:
            logger.error(f"Error calculating total size: {e}")
            return 0

    def get_folder_size_recursive(self, folder_id: str) -> int:
        """Returns total size of all files inside a folder and its subfolders."""
        size = 0
        files = self.get_files(folder_id)
        size += sum(f["size"] for f in files)
        subfolders = self.get_folders(folder_id)
        for sub in subfolders:
            size += self.get_folder_size_recursive(sub["id"])
        return size

    def get_file_ids_recursive(self, folder_id: str) -> List[str]:
        """Returns a list of all file IDs inside a folder and its subfolders recursively."""
        ids = []
        files = self.get_files(folder_id)
        ids.extend(f["id"] for f in files)
        subfolders = self.get_folders(folder_id)
        for sub in subfolders:
            ids.extend(self.get_file_ids_recursive(sub["id"]))
        return ids
