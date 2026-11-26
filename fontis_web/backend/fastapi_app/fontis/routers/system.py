import logging
import os
import threading
import time
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Request
from pydantic import BaseModel

from fontis.app_config import (
    check_db_lock,
    get_active_db_path,
    load_config,
    release_db_lock,
    set_active_db_path,
)
from fontis.auth_deps import get_current_user
from fontis.db_manager import DBManager
from fontis.dependencies import (
    ensure_recent_backup,
    get_archive_db_path,
    get_db_manager,
)

logger = logging.getLogger("fontis_backend")
router = APIRouter(tags=["system"])


class SelectDbRequest(BaseModel):
    db_path: str
    create_if_missing: bool = True
    archive_name: Optional[str] = "Mein Archiv"


class DictionaryWordRequest(BaseModel):
    word: str


@router.get("/api/system/database")
def get_system_database_info():
    cfg = load_config()
    active_path = get_active_db_path()
    lock_info = check_db_lock(active_path)
    return {
        "active_db_path": active_path,
        "recent_dbs": cfg.get("recent_dbs", []),
        "is_locked_by_other": bool(lock_info),
        "lock_info": lock_info,
    }


@router.post("/api/system/database/select")
def select_database(req: SelectDbRequest, background_tasks: BackgroundTasks):
    res = set_active_db_path(
        req.db_path,
        create_if_missing=req.create_if_missing,
        archive_name=req.archive_name or "Mein Archiv",
    )
    background_tasks.add_task(ensure_recent_backup)
    return res


@router.get("/api/system/dialog/select-db")
def select_db_dialog(mode: str = "open", default_name: str = "archiv.db"):
    selected = None
    try:
        import tkinter as tk
        from tkinter import filedialog

        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        if mode in ("create", "save"):
            selected = filedialog.asksaveasfilename(
                title="Neue Archiv-Datenbank anlegen",
                defaultextension=".db",
                initialfile=default_name,
                filetypes=[("SQLite Datenbank", "*.db"), ("Alle Dateien", "*.*")],
            )
        else:
            selected = filedialog.askopenfilename(
                title="Bestehende Archiv-Datenbank öffnen",
                filetypes=[("SQLite Datenbank", "*.db *.sqlite *.sqlite3"), ("Alle Dateien", "*.*")],
            )
        root.destroy()
    except Exception as e:
        logger.warning(f"File dialog error: {e}")
    return {"path": selected if selected else None}


@router.post("/api/system/exit")
def exit_application():
    try:
        release_db_lock(get_active_db_path())
    except Exception:
        pass

    def do_exit():
        time.sleep(0.2)
        os._exit(0)

    threading.Thread(target=do_exit, daemon=True).start()
    return {"status": "ok", "message": "Beende Anwendung..."}


@router.get("/api/system/dictionary")
def get_dictionary(db_manager: DBManager = Depends(get_db_manager)):
    return {"words": db_manager.get_custom_dictionary()}


@router.post("/api/system/dictionary")
def add_dictionary_word(
    req: DictionaryWordRequest, db_manager: DBManager = Depends(get_db_manager)
):
    return {"words": db_manager.add_custom_dictionary_word(req.word)}


@router.delete("/api/system/dictionary/{word}")
def delete_dictionary_word(word: str, db_manager: DBManager = Depends(get_db_manager)):
    return {"words": db_manager.remove_custom_dictionary_word(word)}


@router.get("/api/archives/current")
def get_current_archive_info(
    request: Request = None, current_user: dict = Depends(get_current_user)
):
    db_path = get_archive_db_path()
    archive_name = os.path.splitext(os.path.basename(db_path))[0]
    try:
        mgr = DBManager(db_path)
        roots = mgr.get_children(None)
        if roots:
            archive_name = roots[0].get("label", archive_name)
    except Exception:
        pass

    lock_info = check_db_lock(db_path)
    return {
        "id": "local",
        "name": archive_name,
        "db_path": db_path,
        "is_locked_by_other": bool(lock_info),
        "lock_info": lock_info,
        "cloud_quota_gb": 9999,
        "max_records": 999999,
        "role": "archivar",
    }


@router.post("/api/auth/login")
def login(request: Request = None):
    return {
        "access_token": "standalone_token",
        "token_type": "bearer",
        "role": "archivar",
        "username": "Archivar",
        "archive_id": "local",
    }


@router.get("/api/auth/archives")
def get_user_archives_route(current_user: dict = Depends(get_current_user)):
    db_path = get_archive_db_path()
    name = os.path.splitext(os.path.basename(db_path))[0]
    return [{
        "id": "local",
        "name": name,
        "db_filename": db_path,
        "role": "archivar",
    }]
