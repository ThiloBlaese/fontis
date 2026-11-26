import os

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from fontis.backup_service import BackupService
from fontis.dependencies import check_admin, get_backup_service

router = APIRouter(prefix="/api/backups", tags=["backups"])


@router.get("")
def get_backups(
    backup_service: BackupService = Depends(get_backup_service),
    current_user: dict = Depends(check_admin),
):
    return backup_service.list_backups()


@router.post("")
def create_manual_backup(
    backup_service: BackupService = Depends(get_backup_service),
    current_user: dict = Depends(check_admin),
):
    """Creates a manual backup of the active archive .db file immediately."""
    backup_path = backup_service.perform_backup()
    return {"status": "ok", "filename": os.path.basename(backup_path)}


@router.post("/{filename}/restore")
def restore_backup(
    filename: str,
    backup_service: BackupService = Depends(get_backup_service),
    current_user: dict = Depends(check_admin),
):
    success = backup_service.restore_backup(filename)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to restore backup.")
    return {"status": "ok"}


@router.get("/{filename}/download")
def download_backup(
    filename: str,
    backup_service: BackupService = Depends(get_backup_service),
    current_user: dict = Depends(check_admin),
):
    path = backup_service.get_backup_path(filename)
    if not path:
        raise HTTPException(status_code=404, detail="Backup file not found.")
    return FileResponse(path, filename=filename, media_type="application/octet-stream")
