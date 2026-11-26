import os
import uuid
import shutil
import logging
import mimetypes
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse

from fontis.cloud_db import CloudDBManager
from fontis.app_config import get_active_db_path

mimetypes.add_type("video/ogg", ".ogv")
mimetypes.add_type("video/mp4", ".m4v")

try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None

logger = logging.getLogger("fontis_media_routes")

ALLOWED_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".tiff", ".tif",  # Images
    ".pdf", ".txt", ".doc", ".docx", ".xls", ".xlsx", ".odt", ".rtf",   # Documents
    ".mp4", ".webm", ".mov", ".ogv", ".m4v",                            # Video
    ".mp3", ".wav", ".m4a", ".ogg"                                      # Audio
}


def get_digitalisate_dir() -> str:
    """Returns the 'digitalisate' directory located next to the active archive .db file."""
    active_db = get_active_db_path()
    db_dir = os.path.dirname(os.path.abspath(active_db))
    digitalisate_dir = os.path.join(db_dir, "digitalisate")
    os.makedirs(digitalisate_dir, exist_ok=True)
    return digitalisate_dir


def get_cloud_db_manager() -> CloudDBManager:
    digitalisate_dir = get_digitalisate_dir()
    db_path = os.path.join(digitalisate_dir, "digitalisate.db")
    return CloudDBManager(db_path)


def get_storage_path() -> str:
    digitalisate_dir = get_digitalisate_dir()
    path = os.path.join(digitalisate_dir, "files")
    os.makedirs(path, exist_ok=True)
    return path


router = APIRouter(prefix="/api/cloud", tags=["media"])


@router.get("/usage")
def get_usage(cloud_db: CloudDBManager = Depends(get_cloud_db_manager)):
    """Returns local media storage usage (no cloud quota limit in standalone mode)."""
    used_bytes = cloud_db.get_total_size()
    return {
        "used_bytes": used_bytes,
        "quota_gb": 9999,
        "max_bytes": 9999 * 1024 * 1024 * 1024
    }


@router.post("/files")
async def upload_file(
    file: UploadFile = File(...),
    folder_id: Optional[str] = Form(None),
    cloud_db: CloudDBManager = Depends(get_cloud_db_manager),
    storage_path: str = Depends(get_storage_path)
):
    """Uploads a digital asset and stores it in the local file system and metadata DB."""
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Dateityp {file_ext} ist nicht erlaubt. Unterstützt: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    storage_filename = f"{uuid.uuid4()}_{file.filename}"
    target_path = os.path.join(storage_path, storage_filename)

    try:
        with open(target_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fehler beim Speichern der Datei: {str(e)}")

    thumbnail_id = None
    if file_ext == ".pdf" and fitz:
        try:
            doc = fitz.open(target_path)
            if len(doc) > 0:
                page = doc.load_page(0)
                pix = page.get_pixmap(alpha=False)
                thumb_filename = f"thumb_{uuid.uuid4()}.jpg"
                thumb_path = os.path.join(storage_path, thumb_filename)
                pix.save(thumb_path)
                thumbnail_id = thumb_filename
            doc.close()
        except Exception as e:
            logger.error(f"PDF-Vorschaubild konnte nicht erzeugt werden: {e}")

    file_size = os.path.getsize(target_path)
    return cloud_db.add_file(
        name=file.filename,
        size=file_size,
        mime_type=file.content_type,
        storage_path=storage_filename,
        folder_id=folder_id,
        thumbnail_id=thumbnail_id
    )


@router.get("/files/{file_id}")
def download_file(
    file_id: str,
    thumbnail: bool = False,
    cloud_db: CloudDBManager = Depends(get_cloud_db_manager),
    storage_path: str = Depends(get_storage_path)
):
    """Streams or downloads a local digital asset or its thumbnail."""
    file_record = cloud_db.get_file(file_id)
    if not file_record:
        raise HTTPException(status_code=404, detail="Datei nicht gefunden")

    target_filename = file_record["storage_path"]
    target_mime = file_record["mime_type"] or "application/octet-stream"

    guessed_mime, _ = mimetypes.guess_type(file_record["name"])
    if guessed_mime:
        if target_mime.startswith("video/") and guessed_mime == "audio/ogg":
            target_mime = "video/ogg"
        else:
            target_mime = guessed_mime
    if target_mime == "audio/mp3":
        target_mime = "audio/mpeg"

    if thumbnail and file_record.get("thumbnail_id"):
        target_filename = file_record["thumbnail_id"]
        target_mime = "image/jpeg"

    file_path = os.path.join(storage_path, target_filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Datei auf dem Datenträger nicht gefunden")

    inline_media = ["application/pdf"]
    is_inline = any(target_mime.startswith(prefix) for prefix in ["audio/", "video/", "image/"]) or target_mime in inline_media

    final_filename = file_record["name"] if not thumbnail else f"thumb_{file_record['name']}.jpg"
    disposition = "inline" if is_inline else "attachment"

    return FileResponse(
        path=file_path,
        filename=final_filename,
        media_type=target_mime,
        content_disposition_type=disposition
    )


@router.delete("/files/{file_id}")
def delete_file(
    file_id: str,
    cloud_db: CloudDBManager = Depends(get_cloud_db_manager),
    storage_path: str = Depends(get_storage_path)
):
    """Deletes a local digital asset from disk and metadata DB."""
    file_record = cloud_db.get_file(file_id)
    if not file_record:
        raise HTTPException(status_code=404, detail="Datei nicht gefunden")

    for filename_key in ("storage_path", "thumbnail_id"):
        fname = file_record.get(filename_key)
        if fname:
            fpath = os.path.join(storage_path, fname)
            if os.path.exists(fpath):
                try:
                    os.remove(fpath)
                except Exception as e:
                    logger.warning(f"Datei {fpath} konnte nicht gelöscht werden: {e}")

    cloud_db.delete_file(file_id)
    return {"status": "ok"}
