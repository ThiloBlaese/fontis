
import sqlite_utils
import json
import logging
import os
import shutil
import time
import uuid
from typing import Dict, Any, List

logger = logging.getLogger("fontis_migration")
logging.basicConfig(level=logging.INFO)

def migrate_db(db_path: str):
    """
    Migrates the database from the old 'app_state' single-row JSON blob
    to a normalized relational schema with FTS.
    """
    if not os.path.exists(db_path):
        logger.info(f"Database not found at {db_path}. Skipping migration.")
        return

    conn = sqlite_utils.Database(db_path)
    
    # Check if migration is needed
    if "app_state" not in conn.table_names():
        logger.info("Table 'app_state' not found. Assuming new DB or already migrated.")
        ensure_schema(conn)
        return

    if "nodes" in conn.table_names() and "records" in conn.table_names():
        if conn["nodes"].count > 0:
            logger.info("Target tables already exist. Checking schema compliance...")
            ensure_schema(conn)
            return

    # Create backup only if actual migration is about to run
    backup_path = f"{db_path}.{int(time.time())}.bak"
    try:
        shutil.copy2(db_path, backup_path)
        logger.info(f"Created backup at {backup_path}")
    except Exception as e:
        logger.error(f"Failed to create backup: {e}")
        return

    logger.info("Starting migration...")
    
    try:
        # 1. Read old state
        app_state_table = conn["app_state"]
        # Determine strictness: if empty or truncated, might fail
        try:
            row = app_state_table.get(1) # ID is always 1
            tree_data = json.loads(row["tree_data"])
            active_node_id = row.get("active_node_id", "root")
        except Exception:
            # Fallback if app_state is empty/broken
            logger.warning("Could not read app_state. Using default.")
            tree_data = []
            active_node_id = "root"
        
        # 2. Setup new Schema
        ensure_schema(conn)
        
        # 3. Migrate recursive
        logger.info("Migrating tree data...")
        # Use transaction for speed and safety
        with conn.conn:
            process_nodes(conn, tree_data, parent_id=None)
        
        # 4. Save Config
        conn["app_config"].insert({"key": "active_node_id", "value": json.dumps(active_node_id)}, pk="key", replace=True)
        
        # 5. Rename old table
        if "app_state_legacy" not in conn.table_names():
            conn.execute("ALTER TABLE app_state RENAME TO app_state_legacy")
        
        logger.info("Migration completed successfully.")
        
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        raise e

def ensure_schema(db: sqlite_utils.Database):
    # Nodes
    if "nodes" not in db.table_names():
        db["nodes"].create({
            "id": str,
            "parent_id": str,
            "label": str,
            "is_open": int,
            "sort_order": int,
            "layout_config": str 
        }, pk="id", foreign_keys=[("parent_id", "nodes", "id")])
        db["nodes"].create_index(["parent_id"], if_not_exists=True)

    # Records
    if "records" not in db.table_names():
        db["records"].create({
            "id": str,
            "node_id": str,
            "data": str,
            "record_index": int,
            "created_at": float,
            "updated_at": float
        }, pk="id", foreign_keys=[("node_id", "nodes", "id")])
        db["records"].create_index(["node_id"], if_not_exists=True)
        
    # Digital Assets (Links to local digitalisate.db)
    if "digital_assets" not in db.table_names():
        db["digital_assets"].create({
            "id": str,
            "node_id": str,
            "record_id": str, # Optional link to specific record
            "cloud_file_id": str, # ID in local digitalisate.db
            "label": str,
            "created_at": float
        }, pk="id", foreign_keys=[("node_id", "nodes", "id")])
        db["digital_assets"].create_index(["node_id"], if_not_exists=True)
        db["digital_assets"].create_index(["record_id"], if_not_exists=True)

    # App Config
    if "app_config" not in db.table_names():
        db["app_config"].create({
            "key": str,
            "value": str
        }, pk="key")

    db.conn.commit()
    rebuild_fts = False
    if "records_fts" in db.table_names():
        # Check configuration
        try:
            # We can checks sql from sqlite_master to see tokenizer
            sql = db.execute("SELECT sql FROM sqlite_master WHERE name = 'records_fts'").fetchone()[0]
            if "trigram" not in sql:
                logger.info("Detected old FTS configuration. Scheduling rebuild...")
                rebuild_fts = True
        except Exception:
            pass

    if rebuild_fts:
        # Drop old FTS to force recreation
        db.execute("DROP TABLE records_fts")

    if "records_fts" not in db.table_names():
        logger.info("Creating FTS5 table with trigram tokenizer...")
        # Create virtual table with trigram tokenizer for substring search
        # Note: 'trigram' requires SQLite 3.34+
        db.execute("""
            CREATE VIRTUAL TABLE records_fts USING fts5(
                id,
                text_content,
                node_id UNINDEXED,
                start_year UNINDEXED,
                end_year UNINDEXED,
                tokenize='trigram'
            )
        """)
        
        # Populate if we just created/rebuilt it and records exist
        # Check if we need to populate
        msg = "Repopulating" if rebuild_fts else "Populating"
        
        # Check if records exist but FTS is empty (which it is if we just created it)
        # We can just run population logic.
        logger.info(f"{msg} FTS index...")
        
        # Pull all records with node labels
        try:
             records = db.query("""
                SELECT r.id, r.node_id, r.data, n.label as node_label
                FROM records r
                LEFT JOIN nodes n ON r.node_id = n.id
             """)
             
             fts_batch = []
             for r in records:
                 try:
                     data = json.loads(r["data"])
                     text_parts = [str(v) for v in data.values() if isinstance(v, str)]
                     # Add node label
                     label = r["node_label"] if r["node_label"] else ""
                     text_content = label + " " + " ".join(text_parts)
                     
                     fts_batch.append((r["id"], text_content, r["node_id"]))
                 except:
                     continue
            
             if fts_batch:
                 # Batch insert
                 db.execute("INSERT INTO records_fts (id, text_content, node_id) VALUES " + 
                            ",".join(["(?, ?, ?)"] * len(fts_batch)),
                            [x for item in fts_batch for x in item])
                 db.conn.commit() # Explicit commit for safety
             logger.info(f"Index populated with {len(fts_batch)} records.")
        except Exception as e:
            logger.error(f"Failed to populate FTS: {e}")


def process_nodes(db: sqlite_utils.Database, nodes: List[Dict[str, Any]], parent_id: str = None):
    for i, node in enumerate(nodes):
        node_id = node.get("id")
        
        # Insert Node
        layout = json.dumps(node.get("layoutFields", []))
        
        db["nodes"].insert({
            "id": node_id,
            "parent_id": parent_id,
            "label": node.get("label", "Unbenannt"),
            "is_open": 1 if node.get("isOpen") else 0,
            "sort_order": i,
            "layout_config": layout
        }, pk="id", replace=True)
        
        # Insert Records
        records = node.get("records", [])
        for idx, record in enumerate(records):
            if not record: continue
            
            # Generate ID for record
            rec_id = str(uuid.uuid4())
            
            # Text for FTS (join values)
            text_values = []
            for k, v in record.items():
                if isinstance(v, str):
                    text_values.append(v)
            text_content = " ".join(text_values)
            
            db["records"].insert({
                "id": rec_id,
                "node_id": node_id,
                "data": json.dumps(record),
                "record_index": idx,
                "created_at": time.time(),
                "updated_at": time.time()
            })
            
            # Insert into FTS
            # We assume no date parsing for initial migration for simplicity, 
            # or we could try to extract if we had the regex.
            # search_service.py used logic to parse years. 
            # Ideally we'd reuse that logic, but let's keep it simple for migration.
            db.execute("INSERT INTO records_fts (id, text_content, node_id) VALUES (?, ?, ?)", 
                       (rec_id, text_content, node_id))

        # Children
        children = node.get("children", [])
        if children:
            process_nodes(db, children, parent_id=node_id)

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        migrate_db(sys.argv[1])
    else:
        print("Usage: python migration.py <path_to_db>")
