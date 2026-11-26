import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Body, Depends, HTTPException, Query
from pydantic import BaseModel

from fontis.auth_deps import get_current_user
from fontis.cloud_db import CloudDBManager
from fontis.cloud_routes import get_cloud_db_manager
from fontis.db_manager import DBManager
from fontis.dependencies import check_bearbeiter, get_db_manager

logger = logging.getLogger("fontis_backend")
router = APIRouter(tags=["nodes"])


class StatePayload(BaseModel):
    treeData: List[Dict[str, Any]]
    activeNodeId: str


@router.get("/api/nodes/root")
def get_root_nodes(
    db_manager: DBManager = Depends(get_db_manager),
    current_user: dict = Depends(get_current_user),
):
    try:
        return db_manager.get_children(None)
    except Exception as e:
        logger.error(f"Error fetching root nodes: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/nodes/{node_id}/children")
def get_node_children(
    node_id: str,
    db_manager: DBManager = Depends(get_db_manager),
    current_user: dict = Depends(get_current_user),
):
    return db_manager.get_children(node_id)


@router.get("/api/nodes/{node_id}/path")
def get_node_path(
    node_id: str,
    db_manager: DBManager = Depends(get_db_manager),
    current_user: dict = Depends(get_current_user),
):
    return db_manager.get_node_path(node_id)


@router.post("/api/nodes")
def create_node(
    parent_id: Optional[str] = Body(None, embed=True),
    label: str = Body(..., embed=True),
    layoutFields: List[Any] = Body([], embed=True),
    db_manager: DBManager = Depends(get_db_manager),
    current_user: dict = Depends(check_bearbeiter),
):
    try:
        return db_manager.create_node(parent_id, label, layoutFields)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Error creating node: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/api/nodes/{node_id}")
def update_node(
    node_id: str,
    updates: Dict[str, Any] = Body(...),
    db_manager: DBManager = Depends(get_db_manager),
    current_user: dict = Depends(check_bearbeiter),
):
    try:
        db_manager.update_node(node_id, updates)
        return {"status": "ok"}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Error updating node {node_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/api/nodes/{node_id}")
def delete_node(
    node_id: str,
    db_manager: DBManager = Depends(get_db_manager),
    current_user: dict = Depends(check_bearbeiter),
):
    db_manager.delete_node_recursive(node_id)
    return {"status": "ok"}


@router.get("/api/nodes/{node_id}/records")
def get_node_records(
    node_id: str,
    db_manager: DBManager = Depends(get_db_manager),
    current_user: dict = Depends(get_current_user),
):
    return db_manager.get_records(node_id)


@router.put("/api/nodes/{node_id}/records")
def update_node_records(
    node_id: str,
    records: List[Dict[str, Any]] = Body(...),
    db_manager: DBManager = Depends(get_db_manager),
    current_user: dict = Depends(check_bearbeiter),
):
    try:
        db_manager.update_records(node_id, records, max_records=current_user.get("max_records"))
        return db_manager.get_records(node_id)
    except Exception as e:
        logger.error(f"Error in update_node_records on DB {db_manager.db_path}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/state/active_node")
def set_active_node(
    node_id: str = Body(..., embed=True),
    db_manager: DBManager = Depends(get_db_manager),
    current_user: dict = Depends(get_current_user),
):
    db_manager.save_active_node(node_id)
    return {"status": "ok"}


@router.get("/api/state")
def get_state(db_manager: DBManager = Depends(get_db_manager)):
    state = db_manager.load_state()
    if not state:
        return {
            "treeData": [{
                "id": "root",
                "label": "Mein Fontis Archiv",
                "isRoot": True,
                "isOpen": True,
                "layoutFields": [],
                "records": [{}],
                "currentRecordIndex": 0,
                "children": [],
            }],
            "activeNodeId": "root",
        }
    return state


@router.post("/api/state")
def save_state(data: StatePayload, background_tasks: BackgroundTasks):
    logger.error("Attempted to call legacy save_state. Request blocked.")
    raise HTTPException(
        status_code=410,
        detail="Legacy save_state is disabled. Please use granular API.",
    )


# --- Digital Assets Links ---


@router.get("/api/nodes/{node_id}/assets")
def get_node_assets(
    node_id: str,
    record_id: Optional[str] = Query(None),
    db_manager: DBManager = Depends(get_db_manager),
    cloud_db: CloudDBManager = Depends(get_cloud_db_manager),
    current_user: dict = Depends(get_current_user),
):
    assets = db_manager.get_assets(node_id, record_id)
    enriched = []
    for asset in assets:
        cf = cloud_db.get_file(asset["cloud_file_id"])
        if cf:
            enriched.append({
                **asset,
                "file": {
                    "name": cf["name"],
                    "size": cf["size"],
                    "mime_type": cf["mime_type"],
                },
            })
    return enriched


@router.post("/api/nodes/{node_id}/assets")
def link_asset(
    node_id: str,
    data: Dict[str, Any] = Body(...),
    db_manager: DBManager = Depends(get_db_manager),
    current_user: dict = Depends(check_bearbeiter),
):
    asset_id = db_manager.add_asset(
        node_id,
        data["cloud_file_id"],
        data["label"],
        data.get("record_id"),
    )
    return {"id": asset_id, "status": "ok"}


@router.delete("/api/assets/{asset_id}")
def delete_asset_endpoint(
    asset_id: str,
    db_manager: DBManager = Depends(get_db_manager),
    current_user: dict = Depends(check_bearbeiter),
):
    db_manager.delete_asset(asset_id)
    return {"status": "ok"}
