from typing import List, Optional

from fastapi import APIRouter, Depends, Query

from fontis.auth_deps import get_current_user
from fontis.db_manager import DBManager
from fontis.dependencies import check_admin, get_db_manager, get_search_service
from fontis.search_service import SearchService

router = APIRouter(tags=["search"])


@router.get("/api/search")
def search(
    q: List[str] = Query(None),
    from_year: Optional[int] = None,
    to_year: Optional[int] = None,
    root_node_id: Optional[str] = None,
    offset: int = 0,
    limit: int = 50,
    mode: str = "classic",
    lowest_level_only: bool = False,
    search_service: SearchService = Depends(get_search_service),
    current_user: dict = Depends(get_current_user),
):
    queries = q if q is not None else []
    return search_service.search(
        queries,
        limit=limit,
        min_year=from_year,
        max_year=to_year,
        offset=offset,
        mode=mode,
        lowest_level_only=lowest_level_only,
    )


@router.get("/api/indexing-status/{node_id}")
def get_indexing_status(node_id: str, current_user: dict = Depends(get_current_user)):
    return {"status": "indexed"}


@router.post("/api/index/{node_id}")
def index_node(node_id: str, current_user: dict = Depends(get_current_user)):
    return {"status": "indexing_started", "node_id": node_id}


@router.get("/api/global-indexing-status")
def get_global_indexing_status(current_user: dict = Depends(get_current_user)):
    return {"isIndexing": False}


@router.get("/api/debug/index")
def debug_index(
    db_manager: DBManager = Depends(get_db_manager),
    current_user: dict = Depends(check_admin),
):
    try:
        return {"count": db_manager.db["records_fts"].count}
    except Exception:
        return {"count": 0}
