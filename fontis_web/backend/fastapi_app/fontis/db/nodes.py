import json
import logging
import time
import uuid
from typing import Any, Dict, List, Optional

import sqlite_utils

from fontis.db.helpers import (
    build_fts_text,
    next_sort_order,
    normalize_parent_id,
    resolve_unique_label,
    sibling_label_exists,
)

logger = logging.getLogger("fontis_db")


class NodeMixin:
    """Archive hierarchy (Tektonik / nodes) CRUD and drag-and-drop reordering."""

    def get_children(self, parent_id: Optional[str]) -> List[Dict[str, Any]]:
        parent_id = normalize_parent_id(parent_id)

        if parent_id is None:
            rows = list(
                self.db["nodes"].rows_where("parent_id IS NULL OR parent_id = ''", order_by="sort_order")
            )
        else:
            rows = list(
                self.db["nodes"].rows_where("parent_id = ?", [parent_id], order_by="sort_order")
            )

        result = []
        for r in rows:
            has_children = self.db["nodes"].count_where("parent_id = ?", [r["id"]]) > 0
            record_count = len(self.get_records(r["id"]))
            result.append({
                "id": r["id"],
                "label": r["label"],
                "isOpen": False,
                "hasChildren": has_children,
                "layoutFields": json.loads(r["layout_config"]),
                "recordCount": record_count,
            })
        return result

    def get_node(self, node_id: str) -> Optional[Dict[str, Any]]:
        try:
            row = self.db["nodes"].get(node_id)
            return {
                "id": row["id"],
                "parent_id": row.get("parent_id"),
                "sort_order": row.get("sort_order", 0),
                "label": row["label"],
                "isOpen": bool(row["is_open"]),
                "layoutFields": json.loads(row["layout_config"]),
            }
        except sqlite_utils.db.NotFoundError:
            return None

    def get_node_path(self, node_id: str) -> List[Dict[str, Any]]:
        """Returns the path from root to the given node (inclusive)."""
        path = []
        current_id = node_id
        while current_id:
            try:
                node = self.db["nodes"].get(current_id)
                path.insert(0, {
                    "id": node["id"],
                    "label": node["label"],
                    "parent_id": node["parent_id"],
                })
                current_id = node["parent_id"]
            except sqlite_utils.db.NotFoundError:
                break
        return path

    def create_node(
        self,
        parent_id: Optional[str],
        label: str,
        layout_config: List[Any],
        after_node_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        node_id = str(uuid.uuid4())
        parent_id = normalize_parent_id(parent_id)

        base_label = label.strip() if label else "Neuer Bestand"
        resolved_label = resolve_unique_label(self.db, parent_id, base_label)
        sort_order = next_sort_order(self.db, parent_id)

        self.db["nodes"].insert({
            "id": node_id,
            "parent_id": parent_id,
            "label": resolved_label,
            "is_open": 0,
            "sort_order": sort_order,
            "layout_config": json.dumps(layout_config),
        })

        return {
            "id": node_id,
            "label": resolved_label,
            "isOpen": False,
            "hasChildren": False,
            "layoutFields": layout_config,
            "recordCount": 0,
        }

    def _cleanup_deleted_layout_fields(
        self,
        node_id: str,
        node_label: str,
        deleted_field_ids: List[str],
        new_layout_fields: List[Dict[str, Any]],
    ) -> None:
        """Removes values of deleted layout fields from records and refreshes FTS & asset links."""
        try:
            rows = list(self.db["records"].rows_where("node_id = ?", [node_id]))
            for r in rows:
                try:
                    data = json.loads(r["data"])
                    modified = False
                    for fid in deleted_field_ids:
                        if fid in data:
                            data.pop(fid)
                            modified = True

                    if modified:
                        self.db["records"].update(
                            r["id"], {"data": json.dumps(data), "updated_at": time.time()}
                        )
                        text_content = build_fts_text(node_label, data, new_layout_fields)
                        self.db.execute(
                            "UPDATE records_fts SET text_content = ? WHERE id = ?",
                            [text_content, r["id"]],
                        )
                except Exception as rec_err:
                    logger.error(f"Error cleaning record {r.get('id')} after field deletion: {rec_err}")

            self.sync_node_assets(node_id)
        except Exception as clean_err:
            logger.error(
                f"Error executing records data cleanup for node {node_id}: {clean_err}",
                exc_info=True,
            )

    def update_node(self, node_id: str, updates: Dict[str, Any]) -> None:
        db_updates: Dict[str, Any] = {}

        if "label" in updates:
            new_label = updates["label"].strip()
            if not new_label:
                raise ValueError("Name darf nicht leer sein.")
            current_node = self.get_node(node_id)
            if current_node and sibling_label_exists(
                self.db, current_node.get("parent_id"), new_label, exclude_node_id=node_id
            ):
                raise ValueError(
                    f"Ein Bestand mit dem Namen '{new_label}' existiert bereits auf dieser Ebene."
                )
            db_updates["label"] = new_label

        if "isOpen" in updates:
            db_updates["is_open"] = 1 if updates["isOpen"] else 0

        deleted_field_ids: List[str] = []
        node_label = ""
        if "layoutFields" in updates:
            db_updates["layout_config"] = json.dumps(updates["layoutFields"])
            try:
                current_node_row = self.db["nodes"].get(node_id)
                if current_node_row:
                    node_label = current_node_row.get("label") or ""
                    if current_node_row.get("layout_config"):
                        old_layout = json.loads(current_node_row["layout_config"])
                        old_ids = {f["id"] for f in old_layout if isinstance(f, dict) and "id" in f}
                        new_ids = {
                            f["id"]
                            for f in updates["layoutFields"]
                            if isinstance(f, dict) and "id" in f
                        }
                        deleted_field_ids = list(old_ids - new_ids)
            except Exception as e:
                logger.error(f"Failed to identify deleted fields for node {node_id}: {e}")

        if "parentId" in updates:
            db_updates["parent_id"] = updates["parentId"]
        if "sortOrder" in updates:
            db_updates["sort_order"] = updates["sortOrder"]

        # Resolve target parent for Drag & Drop positioning
        if "targetId" in updates and "position" in updates:
            target_id = updates["targetId"]
            position = updates["position"]
            if target_id == "root":
                db_updates["parent_id"] = None
                if position == "inside":
                    db_updates["sort_order"] = next_sort_order(self.db, None)
            else:
                target_node = self.get_node(target_id)
                if target_node:
                    if position == "inside":
                        db_updates["parent_id"] = target_id
                        db_updates["sort_order"] = next_sort_order(self.db, target_id)
                    else:
                        db_updates["parent_id"] = target_node.get("parent_id")

        # Validate target parent for duplicate labels before modifying sort_order
        if "parent_id" in db_updates:
            new_parent_id = normalize_parent_id(db_updates["parent_id"])
            db_updates["parent_id"] = new_parent_id
            current_node = self.get_node(node_id)
            if current_node:
                label_to_check = db_updates.get("label", current_node.get("label"))
                if sibling_label_exists(
                    self.db, new_parent_id, label_to_check, exclude_node_id=node_id
                ):
                    raise ValueError(
                        f"Ein Bestand mit dem Namen '{label_to_check}' existiert bereits am Zielort."
                    )

        # Shift sibling sort_order when dropping before/after another node
        if "targetId" in updates and "position" in updates:
            target_id = updates["targetId"]
            position = updates["position"]
            if target_id != "root" and position != "inside":
                target_node = self.get_node(target_id)
                if target_node:
                    new_parent_id = normalize_parent_id(target_node.get("parent_id"))
                    target_sort_order = target_node.get("sort_order", 0)
                    parent_filter = "parent_id = ?" if new_parent_id else "parent_id IS NULL"
                    parent_val = [new_parent_id] if new_parent_id else []

                    if position == "before":
                        db_updates["sort_order"] = target_sort_order
                        self.db.execute(
                            f"UPDATE nodes SET sort_order = sort_order + 1 WHERE {parent_filter} AND sort_order >= ?",
                            parent_val + [target_sort_order],
                        )
                    else:
                        db_updates["sort_order"] = target_sort_order + 1
                        self.db.execute(
                            f"UPDATE nodes SET sort_order = sort_order + 1 WHERE {parent_filter} AND sort_order > ?",
                            parent_val + [target_sort_order],
                        )

        if not db_updates:
            return

        with self.db.conn:
            columns = ", ".join([f"{k} = ?" for k in db_updates.keys()])
            values = list(db_updates.values()) + [node_id]
            self.db.execute(f"UPDATE nodes SET {columns} WHERE id = ?", values)

            if deleted_field_ids:
                self._cleanup_deleted_layout_fields(
                    node_id, node_label, deleted_field_ids, updates["layoutFields"]
                )

    def delete_node_recursive(self, node_id: str) -> None:
        children = list(self.db["nodes"].rows_where("parent_id = ?", [node_id]))
        for child in children:
            self.delete_node_recursive(child["id"])

        self.db["records"].delete_where("node_id = ?", [node_id])
        if "digital_assets" in self.db.table_names():
            self.db["digital_assets"].delete_where("node_id = ?", [node_id])
        self.db.execute("DELETE FROM records_fts WHERE node_id = ?", [node_id])
        self.db["nodes"].delete(node_id)
