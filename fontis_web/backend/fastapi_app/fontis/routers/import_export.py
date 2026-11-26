import json
import logging
import os
from datetime import datetime
from typing import Dict, Optional

from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, Query, Request, Response, UploadFile
from fastapi.responses import PlainTextResponse

from fontis.auth_deps import get_current_user
from fontis.backup_service import BackupService
from fontis.db_manager import DBManager
from fontis.dependencies import check_bearbeiter, get_backup_service, get_db_manager
from fontis.ead_utils import generate_ead_xml, parse_ead_xml
from fontis.pdf_generator import FindbuchGenerator

logger = logging.getLogger("fontis_backend")
router = APIRouter(tags=["import-export"])


def _create_pre_import_backup(backup_service: BackupService, import_label: str) -> None:
    """Creates a safety backup before any destructive or appending import."""
    logger.info(f"{import_label} requested. Triggering automatic pre-import backup...")
    try:
        backup_path = backup_service.perform_backup()
        logger.info(f"Pre-import backup successful: {backup_path}")
    except Exception as e:
        logger.error(f"Pre-import backup failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Import aborted: Failed to create safety backup.")


@router.get("/api/export/json")
def export_database_json(
    db_manager: DBManager = Depends(get_db_manager),
    current_user: dict = Depends(get_current_user),
):
    """Exports the entire database structure (nodes and records) as JSON."""
    try:
        return db_manager.export_data()
    except Exception as e:
        logger.error(f"Failed to export DB as JSON: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Database export failed.")


@router.post("/api/import/json")
def import_database_json(
    file: UploadFile = File(...),
    append: bool = Form(False),
    node_id: Optional[str] = Form(None),
    db_manager: DBManager = Depends(get_db_manager),
    backup_service: BackupService = Depends(get_backup_service),
    current_user: dict = Depends(check_bearbeiter),
):
    """Imports a JSON export, either replacing or appending to the current database."""
    if not file.filename.lower().endswith(".json"):
        raise HTTPException(status_code=400, detail="Must upload a .json file.")

    _create_pre_import_backup(backup_service, f"JSON Import (append={append})")

    try:
        data = json.loads(file.file.read())
        db_manager.import_data(
            data,
            append=append,
            max_records=current_user.get("max_records"),
            parent_node_id=node_id,
            filename=file.filename,
        )
        msg = "Daten wurden erfolgreich angehängt." if append else "Datenbank wurde erfolgreich ersetzt."
        return {"status": "ok", "message": msg}
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON file.")
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Import process failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Import process experienced an internal error.")


@router.get("/api/export/csv")
def export_database_csv(
    node_id: Optional[str] = Query(None),
    db_manager: DBManager = Depends(get_db_manager),
    current_user: dict = Depends(get_current_user),
):
    """Exports the database content as a flat Excel-compatible CSV file."""
    try:
        csv_data = db_manager.export_csv(node_id=node_id)
        return PlainTextResponse(content=csv_data, media_type="text/csv")
    except Exception as e:
        logger.error(f"Failed to export DB as CSV: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Database CSV export failed.")


@router.post("/api/import/csv")
def import_database_csv(
    file: UploadFile = File(...),
    append: bool = Form(False),
    node_id: Optional[str] = Form(None),
    db_manager: DBManager = Depends(get_db_manager),
    backup_service: BackupService = Depends(get_backup_service),
    current_user: dict = Depends(check_bearbeiter),
):
    """Imports a CSV file, replacing or appending to the current database or selected node."""
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Must upload a .csv file.")

    _create_pre_import_backup(backup_service, f"CSV Import (append={append}, node_id={node_id})")

    try:
        raw_content = file.file.read()
        try:
            content = raw_content.decode("utf-8-sig")
        except UnicodeDecodeError:
            try:
                content = raw_content.decode("latin-1")
            except UnicodeDecodeError as e:
                logger.error(f"Failed to decode CSV content: {e}")
                raise ValueError("CSV file encoding not supported. Please use UTF-8 or Latin-1.")

        db_manager.import_csv_data(
            content,
            append=append,
            max_records=current_user.get("max_records"),
            parent_node_id=node_id,
            filename=file.filename,
        )
        msg = (
            "Daten wurden erfolgreich angehängt."
            if append
            else "Datenbank wurde erfolgreich durch CSV ersetzt."
        )
        return {"status": "ok", "message": msg}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"CSV import process failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="CSV import process experienced an internal error.")


@router.get("/api/export/pdf")
def export_findbuch_pdf(
    request: Request,
    node_id: Optional[str] = Query(None),
    hide_blocked: bool = Query(False),
    db_manager: DBManager = Depends(get_db_manager),
    current_user: dict = Depends(get_current_user),
):
    """Generates a PDF Findbuch from the entire archive or a specific subtree."""
    try:
        state = db_manager.load_state()
        if not state or "treeData" not in state:
            raise HTTPException(status_code=404, detail="No data found to export.")

        tree_data = state["treeData"]
        archive_name = os.path.splitext(os.path.basename(db_manager.db_path))[0]
        if tree_data and tree_data[0].get("label"):
            archive_name = tree_data[0]["label"]

        if node_id:
            def find_subtree(nodes, target_id):
                for node in nodes:
                    if node["id"] == target_id:
                        return [node]
                    if node.get("children"):
                        found = find_subtree(node["children"], target_id)
                        if found:
                            return found
                return None

            subtree = find_subtree(tree_data, node_id)
            if not subtree:
                raise HTTPException(status_code=404, detail="Selected node not found in archive.")
            tree_data = subtree
            scoped_label = tree_data[0].get("label", "")
            if scoped_label and scoped_label != archive_name:
                archive_name = f"{archive_name} - {scoped_label}"

        generator = FindbuchGenerator(archive_name, tree_data, hide_blocked=hide_blocked)
        pdf_bytes = generator.generate()

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="findbuch_{datetime.now().strftime("%Y-%m-%d")}.pdf"'
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate PDF Findbuch: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="PDF generation failed.")


@router.post("/api/export/ead")
def export_database_ead(
    mapping: Dict[str, str] = Body(...),
    db_manager: DBManager = Depends(get_db_manager),
    current_user: dict = Depends(get_current_user),
):
    """Exports the archive structure as EAD XML using the provided field mapping."""
    try:
        data = db_manager.export_data()
        xml_string = generate_ead_xml(data, mapping)
        return PlainTextResponse(content=xml_string, media_type="application/xml")
    except Exception as e:
        logger.error(f"Failed to export DB as EAD XML: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Database EAD XML export failed.")


@router.post("/api/import/ead")
def import_database_ead(
    file: UploadFile = File(...),
    mapping: str = Form(...),
    append: bool = Form(False),
    node_id: Optional[str] = Form(None),
    db_manager: DBManager = Depends(get_db_manager),
    backup_service: BackupService = Depends(get_backup_service),
    current_user: dict = Depends(check_bearbeiter),
):
    """Imports an EAD XML file, replacing or appending to the current database."""
    if not file.filename.lower().endswith(".xml"):
        raise HTTPException(status_code=400, detail="Must upload a .xml file.")

    try:
        mapping_dict = json.loads(mapping)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid mapping JSON.")

    _create_pre_import_backup(backup_service, f"EAD XML Import (append={append})")

    try:
        content = file.file.read().decode("utf-8")
        parsed_data = parse_ead_xml(content, mapping_dict)
        db_manager.import_data(
            parsed_data,
            append=append,
            max_records=current_user.get("max_records"),
            parent_node_id=node_id,
            filename=file.filename,
        )
        msg = (
            "Daten wurden erfolgreich aus EAD XML angehängt."
            if append
            else "Datenbank wurde erfolgreich aus EAD XML wiederhergestellt."
        )
        return {"status": "ok", "message": msg}
    except ValueError as ve:
        logger.error(f"Validation error during EAD import: {ve}")
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"EAD XML import process failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Import process error: {str(e)}")
