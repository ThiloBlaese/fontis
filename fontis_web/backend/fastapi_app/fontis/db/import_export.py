import csv
import datetime
import hashlib
import io
import json
import logging
import os
import time
import uuid
from typing import Any, Dict, List, Optional

from fontis.db.helpers import (
    build_fts_text,
    build_tree_snapshot,
    clear_archive_tables,
    next_sort_order,
    normalize_parent_id,
    resolve_unique_label,
)

logger = logging.getLogger("fontis_db")


class ImportExportMixin:
    """Full state load/save and JSON / CSV import & export operations."""

    def load_state(self) -> Optional[Dict[str, Any]]:
        """Reconstructs the full treeData and activeNodeId from relational tables."""
        try:
            active_node_id = "root"
            try:
                row = self.db["app_config"].get("active_node_id")
                if row:
                    active_node_id = json.loads(row["value"])
            except Exception:
                pass

            tree_data = build_tree_snapshot(
                self.db, include_record_ids=True, filter_valid_fields=False
            )
            if not tree_data:
                return None

            return {"treeData": tree_data, "activeNodeId": active_node_id}
        except Exception as e:
            logger.error(f"Error loading state from DB: {e}")
            return None

    def save_state(
        self,
        tree_data: List[Dict[str, Any]],
        active_node_id: str,
        append: bool = False,
        parent_node_id: Optional[str] = None,
    ) -> None:
        """Persists a complete tree snapshot (replacing or appending to existing data)."""
        nodes_to_insert = []
        records_to_insert = []
        fts_to_insert = []
        now = time.time()

        def process_node(node_list, parent_id=None):
            if not isinstance(node_list, list):
                return
            base_sort_order = next_sort_order(self.db, parent_id) if append else 0

            for i, node in enumerate(node_list):
                if not isinstance(node, dict):
                    continue

                node_id = node.get("id")
                if not node_id or not str(node_id).strip():
                    node_id = str(uuid.uuid4())

                layout_fields = node.get("layoutFields", [])
                if not isinstance(layout_fields, list):
                    layout_fields = []

                node_label = node.get("label", "Unbenannt") or "Unbenannt"
                nodes_to_insert.append({
                    "id": node_id,
                    "parent_id": parent_id,
                    "label": node_label,
                    "is_open": 1 if node.get("isOpen") else 0,
                    "sort_order": base_sort_order + i,
                    "layout_config": json.dumps(layout_fields),
                })

                recs = node.get("records", [])
                if not isinstance(recs, list):
                    recs = []

                for idx, r in enumerate(recs):
                    if not r:
                        continue
                    if isinstance(r, str):
                        r = {"titel": r}
                    elif not isinstance(r, dict):
                        continue

                    r_copy = r.copy()
                    rec_id = r_copy.pop("id", r_copy.pop("_import_id", str(uuid.uuid4())))
                    if not rec_id or not str(rec_id).strip():
                        rec_id = str(uuid.uuid4())

                    records_to_insert.append({
                        "id": rec_id,
                        "node_id": node_id,
                        "data": json.dumps(r_copy),
                        "record_index": idx,
                        "created_at": now,
                        "updated_at": now,
                    })
                    fts_to_insert.append(
                        (rec_id, build_fts_text(node_label, r_copy, layout_fields), node_id)
                    )

                children = node.get("children")
                if children and isinstance(children, list):
                    process_node(children, node_id)

        process_node(tree_data, parent_id=parent_node_id)

        with self.db.conn:
            if not append:
                clear_archive_tables(self.db)

            self.db["nodes"].insert_all(nodes_to_insert, ignore=append)
            self.db["records"].insert_all(records_to_insert, ignore=append)

            if fts_to_insert:
                insert_verb = "INSERT OR IGNORE" if append else "INSERT"
                self.db.execute(
                    f"{insert_verb} INTO records_fts (id, text_content, node_id) VALUES "
                    + ",".join(["(?, ?, ?)"] * len(fts_to_insert)),
                    [x for item in fts_to_insert for x in item],
                )

            if not append or not list(self.db["nodes"].rows):
                self.db["app_config"].insert(
                    {"key": "active_node_id", "value": json.dumps(active_node_id)},
                    pk="key",
                    replace=True,
                )

        for node_to_sync in nodes_to_insert:
            self.sync_node_assets(node_to_sync["id"])

    def export_data(self) -> Dict[str, Any]:
        """Exports the entire database (nodes and cleaned records) into a JSON dict."""
        try:
            tree_data = build_tree_snapshot(
                self.db, include_record_ids=False, filter_valid_fields=True
            )
            return {
                "version": "1.0",
                "timestamp": time.time(),
                "treeData": tree_data,
            }
        except Exception as e:
            logger.error(f"Error exporting data: {e}", exc_info=True)
            raise

    def _create_import_parent_node(
        self, parent_node_id: Optional[str] = None, filename: Optional[str] = None
    ) -> str:
        parent_node_id = normalize_parent_id(parent_node_id)
        node_id = str(uuid.uuid4())
        base_label = os.path.basename(filename) if filename else "Importierte Daten"
        label = resolve_unique_label(self.db, parent_node_id, base_label)
        sort_order = next_sort_order(self.db, parent_node_id)

        self.db["nodes"].insert({
            "id": node_id,
            "parent_id": parent_node_id,
            "label": label,
            "is_open": 1,
            "layout_config": "[]",
            "sort_order": sort_order,
        })
        self.sync_node_assets(node_id)
        return node_id

    def import_data(
        self,
        data: Dict[str, Any],
        append: bool = False,
        max_records: Optional[int] = None,
        parent_node_id: Optional[str] = None,
        filename: Optional[str] = None,
    ) -> None:
        """Imports a JSON snapshot, replacing or appending data and generating missing layouts."""
        if "treeData" not in data:
            raise ValueError("Invalid import format: missing 'treeData' key")

        tree_data = data["treeData"]

        if max_records is not None:
            def count_records(node_list):
                count = 0
                for node in node_list:
                    count += len(node.get("records", []))
                    if "children" in node:
                        count += count_records(node["children"])
                return count

            new_records_count = count_records(tree_data)
            current_count = (
                self.db.execute("SELECT count(*) FROM records").fetchone()[0] if append else 0
            )
            if (current_count + new_records_count) > max_records:
                raise ValueError(f"Import überschreitet das Datensatz-Limit von {max_records}.")

        if append:
            def remap_ids(node_list):
                if not isinstance(node_list, list):
                    return
                for node in node_list:
                    if not isinstance(node, dict):
                        continue
                    if node.get("id"):
                        node["id"] = str(uuid.uuid4())
                    if isinstance(node.get("children"), list):
                        remap_ids(node["children"])

            remap_ids(tree_data)

        # Auto-generate layoutFields for fields found in records but missing in layout_config
        ignored_meta_keys = {"id", "created_at", "updated_at", "_import_id", "node_id", "record_index"}

        def ensure_layout_fields(node_list):
            if not isinstance(node_list, list):
                return
            for node in node_list:
                if not isinstance(node, dict):
                    continue
                layout_fields = node.get("layoutFields", [])
                if not isinstance(layout_fields, list):
                    layout_fields = []
                existing_field_ids = {
                    f.get("id") for f in layout_fields if isinstance(f, dict) and f.get("id")
                }

                records = node.get("records", [])
                if not isinstance(records, list):
                    records = []

                discovered_fields = set()
                for rec in records:
                    if not isinstance(rec, dict):
                        continue
                    for k, v in rec.items():
                        if k not in existing_field_ids and k not in ignored_meta_keys and str(v).strip():
                            discovered_fields.add(k)

                if discovered_fields:
                    start_y = max(
                        (f.get("y", 0) + 70 for f in layout_fields if isinstance(f, dict)),
                        default=0,
                    )
                    y_offset = start_y
                    field_mapping = {}

                    for field_id in sorted(discovered_fields):
                        stable_f_id = "f_" + hashlib.md5(field_id.encode("utf-8")).hexdigest()[:8]
                        field_mapping[field_id] = stable_f_id
                        layout_fields.append({
                            "id": stable_f_id,
                            "type": "text",
                            "label": field_id.capitalize(),
                            "x": 0,
                            "y": y_offset,
                            "width": 480,
                            "height": 168,
                            "color": "blue",
                        })
                        y_offset += 192

                    for rec in records:
                        if not isinstance(rec, dict):
                            continue
                        for old_id, new_id in field_mapping.items():
                            if old_id in rec:
                                rec[new_id] = rec.pop(old_id)

                node["layoutFields"] = layout_fields
                if isinstance(node.get("children"), list):
                    ensure_layout_fields(node["children"])

        ensure_layout_fields(tree_data)

        try:
            first_id = "root"
            if tree_data and "id" in tree_data[0]:
                first_id = tree_data[0]["id"]

            effective_parent_id = (
                self._create_import_parent_node(parent_node_id, filename) if append else None
            )
            self.save_state(
                tree_data,
                active_node_id=first_id,
                append=append,
                parent_node_id=effective_parent_id,
            )
            self.db.conn.commit()
        except Exception as e:
            logger.error(f"Error importing data: {e}", exc_info=True)
            raise

    def export_csv(self, node_id: Optional[str] = None) -> str:
        """Exports the archive (or a subtree) as UTF-8 BOM semicolon-delimited CSV."""
        if node_id:
            node_ids = []

            def collect_ids(nid):
                node_ids.append(nid)
                for child in self.db["nodes"].rows_where("parent_id = ?", [nid]):
                    collect_ids(child["id"])

            collect_ids(node_id)
            placeholders = ",".join(["?"] * len(node_ids))
            records_rows = list(
                self.db.execute(
                    f"SELECT id, node_id, data, record_index FROM records WHERE node_id IN ({placeholders}) ORDER BY node_id, record_index",
                    node_ids,
                ).fetchall()
            )
            records = [
                {"id": r[0], "node_id": r[1], "data": r[2], "record_index": r[3]}
                for r in records_rows
            ]
            nodes_rows = list(self.db["nodes"].rows_where(f"id IN ({placeholders})", node_ids))
        else:
            records = list(self.db["records"].rows)
            nodes_rows = list(self.db["nodes"].rows)

        fields_by_node: Dict[str, Dict[str, str]] = {}
        all_field_labels = set()
        for n in nodes_rows:
            fields_by_node[n["id"]] = {}
            try:
                for field in json.loads(n["layout_config"]):
                    if isinstance(field, dict) and "id" in field and "label" in field:
                        fields_by_node[n["id"]][field["id"]] = field["label"]
                        all_field_labels.add(field["label"])
            except Exception:
                pass

        sorted_field_labels = sorted(all_field_labels)
        output = io.StringIO()
        writer = csv.writer(output, delimiter=";")
        writer.writerow(["Ordner"] + sorted_field_labels)

        paths_cache: Dict[str, str] = {}

        def get_path_str(nid: str) -> str:
            if nid not in paths_cache:
                path = self.get_node_path(nid)
                paths_cache[nid] = " / ".join(node["label"] for node in path)
            return paths_cache[nid]

        for r in records:
            nid = r["node_id"]
            try:
                r_data = json.loads(r["data"])
            except Exception:
                continue

            node_fields = fields_by_node.get(nid, {})
            label_to_val = {
                node_fields[f_id]: f_val
                for f_id, f_val in r_data.items()
                if f_id in node_fields
            }
            writer.writerow([get_path_str(nid)] + [label_to_val.get(lbl, "") for lbl in sorted_field_labels])

        return "\ufeff" + output.getvalue()

    def import_csv_data(
        self,
        csv_content: str,
        append: bool = False,
        max_records: Optional[int] = None,
        parent_node_id: Optional[str] = None,
        filename: Optional[str] = None,
    ) -> None:
        """Imports flat or folder-structured CSV data, creating folders and layouts as needed."""
        csv_content = csv_content.lstrip("\ufeff")
        f = io.StringIO(csv_content)
        try:
            dialect = csv.Sniffer().sniff(csv_content[:1024])
            reader = csv.DictReader(f, dialect=dialect)
        except csv.Error:
            reader = csv.DictReader(f)

        rows = list(reader)
        if not rows:
            raise ValueError("CSV file is empty.")

        csv_headers = reader.fieldnames or []

        if max_records is not None:
            current_count = (
                self.db.execute("SELECT count(*) FROM records").fetchone()[0] if append else 0
            )
            if (current_count + len(rows)) > max_records:
                raise ValueError(f"CSV-Import überschreitet das Datensatz-Limit von {max_records}.")

        if not append:
            with self.db.conn:
                clear_archive_tables(self.db)
            parent_node_id = None
        else:
            parent_node_id = self._create_import_parent_node(parent_node_id, filename)

        node_record_counts: Dict[str, int] = {}
        record_inserts = []
        fts_inserts = []
        resolved_nodes: Dict[Any, str] = {}

        def resolve_path_to_node_id(path_str: Optional[str], base_id: Optional[str] = None) -> Optional[str]:
            if not path_str or not path_str.strip():
                return base_id
            segments = [s.strip() for s in path_str.split("/") if s.strip()]
            current_parent_id = base_id
            for segment in segments:
                cache_key = (current_parent_id, segment)
                if cache_key in resolved_nodes:
                    current_parent_id = resolved_nodes[cache_key]
                    continue

                if current_parent_id is None:
                    res_rows = list(
                        self.db["nodes"].rows_where("parent_id IS NULL AND label = ?", [segment])
                    )
                else:
                    res_rows = list(
                        self.db["nodes"].rows_where(
                            "parent_id = ? AND label = ?", [current_parent_id, segment]
                        )
                    )

                if res_rows:
                    node_id = res_rows[0]["id"]
                else:
                    node_id = str(uuid.uuid4())
                    self.db["nodes"].insert({
                        "id": node_id,
                        "parent_id": current_parent_id,
                        "label": segment,
                        "is_open": 1,
                        "layout_config": "[]",
                        "sort_order": next_sort_order(self.db, current_parent_id),
                    })
                resolved_nodes[cache_key] = node_id
                current_parent_id = node_id
            return current_parent_id

        node_mappings: Dict[str, Dict[str, str]] = {}

        def get_or_create_node_mapping(n_id: str) -> Dict[str, str]:
            if n_id in node_mappings:
                return node_mappings[n_id]

            node = self.db["nodes"].get(n_id)
            try:
                layout_config = json.loads(node["layout_config"])
            except Exception:
                layout_config = []

            existing_mapping = {}
            existing_ids = set()
            for field in layout_config:
                if isinstance(field, dict) and "label" in field and "id" in field:
                    existing_mapping[field["label"].lower().strip()] = field["id"]
                    existing_ids.add(field["id"])

            field_mapping = {}
            layout_updated = False
            start_y = max(
                (field.get("y", 0) + 160 for field in layout_config if isinstance(field, dict)),
                default=0,
            )
            x_offset = 0
            y_offset = start_y

            for col in csv_headers:
                if col == "Ordner" or not col or not col.strip():
                    continue
                col_key = col.lower().strip()
                if col_key in existing_mapping:
                    field_mapping[col] = existing_mapping[col_key]
                else:
                    stable_f_id = "f_" + hashlib.md5(col.encode("utf-8")).hexdigest()[:8]
                    while stable_f_id in existing_ids:
                        stable_f_id = "f_" + str(uuid.uuid4())[:8]
                    field_mapping[col] = stable_f_id
                    existing_ids.add(stable_f_id)
                    layout_config.append({
                        "id": stable_f_id,
                        "type": "text",
                        "label": col,
                        "x": x_offset,
                        "y": y_offset,
                        "width": 288,
                        "height": 128,
                        "bgColor": "bg-white",
                    })
                    x_offset += 320
                    if x_offset > 800:
                        x_offset = 0
                        y_offset += 160
                    layout_updated = True

            if layout_updated:
                self.db["nodes"].update(n_id, {"layout_config": json.dumps(layout_config)})

            node_mappings[n_id] = field_mapping
            return field_mapping

        has_ordner_col = "Ordner" in csv_headers
        default_folder_id = None
        if not has_ordner_col and not parent_node_id:
            timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
            default_folder_id = str(uuid.uuid4())
            self.db["nodes"].insert({
                "id": default_folder_id,
                "parent_id": None,
                "label": f"CSV Import {timestamp}",
                "is_open": 1,
                "layout_config": "[]",
                "sort_order": 0,
            })

        now = time.time()
        node_label_cache: Dict[str, str] = {}

        for row in rows:
            target_node_id = (
                resolve_path_to_node_id(row.get("Ordner"), parent_node_id)
                if has_ordner_col
                else (parent_node_id or default_folder_id)
            )
            if not target_node_id:
                continue

            if target_node_id not in node_record_counts:
                try:
                    current_max = self.db.execute(
                        "SELECT MAX(record_index) FROM records WHERE node_id = ?", [target_node_id]
                    ).fetchone()[0]
                    node_record_counts[target_node_id] = (current_max + 1) if current_max is not None else 0
                except Exception:
                    node_record_counts[target_node_id] = 0
            else:
                node_record_counts[target_node_id] += 1

            rec_index = node_record_counts[target_node_id]
            field_mapping = get_or_create_node_mapping(target_node_id)
            data = {}
            text_parts = []

            for col, val in row.items():
                if col == "Ordner" or not col or not val:
                    continue
                if col in field_mapping:
                    data[field_mapping[col]] = val
                    text_parts.append(val)

            rec_id = str(uuid.uuid4())
            record_inserts.append({
                "id": rec_id,
                "node_id": target_node_id,
                "data": json.dumps(data),
                "record_index": rec_index,
                "created_at": now,
                "updated_at": now,
            })

            if target_node_id not in node_label_cache:
                try:
                    node_label_cache[target_node_id] = self.db["nodes"].get(target_node_id)["label"]
                except Exception:
                    node_label_cache[target_node_id] = "Importiert"

            fts_inserts.append(
                (rec_id, f"{node_label_cache[target_node_id]} " + " ".join(text_parts), target_node_id)
            )

        with self.db.conn:
            if record_inserts:
                self.db["records"].insert_all(record_inserts)
            if fts_inserts:
                self.db.execute(
                    "INSERT INTO records_fts (id, text_content, node_id) VALUES "
                    + ",".join(["(?, ?, ?)"] * len(fts_inserts)),
                    [x for item in fts_inserts for x in item],
                )
            self.db.conn.commit()
