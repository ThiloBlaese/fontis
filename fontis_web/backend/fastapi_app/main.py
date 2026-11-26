import logging
import os
import sys
import threading

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from fontis.cloud_routes import router as cloud_router
from fontis.dependencies import ensure_recent_backup
from fontis.migration import migrate_db
from fontis.routers import (
    backups_router,
    import_export_router,
    nodes_router,
    search_router,
    system_router,
)

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("fontis.log"),
        logging.StreamHandler(),
    ],
    force=True,
)
logger = logging.getLogger("fontis_backend")

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fontis.db")

app = FastAPI(title="Fontis API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_no_cache_header(request, call_next):
    response = await call_next(request)
    if request.url.path == "/api/state":
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"

    origin = request.headers.get("origin")
    if origin:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "*"

    return response


# Register modular API routers
app.include_router(cloud_router)
app.include_router(system_router)
app.include_router(nodes_router)
app.include_router(search_router)
app.include_router(backups_router)
app.include_router(import_export_router)


@app.on_event("startup")
def startup():
    logger.info("Checking for database migration...")
    try:
        migrate_db(DB_PATH)
    except Exception as e:
        logger.error(f"Migration failed: {e}", exc_info=True)

    def prewarm_embeddings():
        try:
            from fontis.search_service import SearchService

            logger.info("Pre-warming semantic search embedding model...")
            SearchService.get_embedding_model()
            logger.info("Semantic search embedding model is ready.")
        except Exception as prewarm_err:
            logger.error(f"Failed to prewarm semantic model: {prewarm_err}")

    threading.Thread(target=ensure_recent_backup, daemon=True).start()
    threading.Thread(target=prewarm_embeddings, daemon=True).start()


# Static Frontend Bundle & SPA Catch-All
if getattr(sys, "frozen", False):
    bundle_dir = getattr(sys, "_MEIPASS", os.path.abspath(os.path.dirname(__file__)))
    FONTIS_DIST_DIR = os.path.join(bundle_dir, "fontis_web/dist")
else:
    FONTIS_DIST_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../dist"))

if os.path.exists(FONTIS_DIST_DIR):
    assets_dir = os.path.join(FONTIS_DIST_DIR, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="fontis_assets")
        app.mount("/apps/fontis/assets", StaticFiles(directory=assets_dir), name="fontis_legacy_assets")


@app.get("/{full_path:path}")
async def serve_fontis_spa(full_path: str):
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail=f"API route not found: /{full_path}")

    if os.path.exists(FONTIS_DIST_DIR):
        file_path = os.path.join(FONTIS_DIST_DIR, full_path)
        if full_path and os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)

        index_path = os.path.join(FONTIS_DIST_DIR, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)

    raise HTTPException(status_code=404, detail="Fontis frontend build files not found")
