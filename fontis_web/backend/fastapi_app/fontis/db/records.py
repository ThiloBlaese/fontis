import json
import logging
import time
import uuid
from typing import Any, Dict, List, Optional, Tuple

from fontis.db.helpers import build_fts_text

logger = logging.getLogger("fontis_db")


class RecordMixin:
    """Records, full-text index updates, app config, custom dictionary, and digital asset links."""

    def _get_node_label_and_layout(self, node_id: str) -> Tuple[str, List[Dict[str, Any]]]:
        try:
            node = self.db["nodes"].get(node_id)
            label = node["label"] or ""
            layout = json.loads(node["layout_config"]) if node.get("layout_config") else []
            return label, layout
        except Exception:
            return "", []

    def get_records(self, node_id: str) -> List[Dict[str, Any]]:
        rows = self.db["records"].rows_where("node_id = ?", [node_id], order_by="record_index")
        results = []
        for r in rows:
            try:
                data = json.loads(r["data"])
                data["id"] = r["id"]
                results.append(data)
            except Exception:
                continue
        return results

    def add_record(self, node_id: str, data: Dict[str, Any], index: int = -1) -> str:
        record_id = str(uuid.uuid4())

        if index == -1:
            try:
                current_max = self.db.execute(
                    "SELECT MAX(record_index) FROM records WHERE node_id = ?", [node_id]
                ).fetchone()[0]
                index = (current_max + 1) if current_max is not None else 0
            except Exception:
                index = 0

        now = time.time()
        self.db["records"].insert({
            "id": record_id,
            "node_id": node_id,
            "data": json.dumps(data),
            "record_index": index,
            "created_at": now,
            "updated_at": now,
        })

        node_label, layout_fields = self._get_node_label_and_layout(node_id)
        self.db["records_fts"].insert({
            "id": record_id,
            "text_content": build_fts_text(node_label, data, layout_fields),
            "node_id": node_id,
        })

        self.sync_node_assets(node_id)
        return record_id

    def update_records(
        self, node_id: str, records: List[Dict[str, Any]], max_records: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Replaces all records for a node transactionally and returns stored records with IDs."""
        if max_records is not None:
            old_count = self.db.execute(
                "SELECT count(*) FROM records WHERE node_id = ?", [node_id]
            ).fetchone()[0]
            total_count = self.db.execute("SELECT count(*) FROM records").fetchone()[0]
            if (total_count - old_count + len(records)) > max_records:
                raise ValueError(f"Aktion überschreitet das Datensatz-Limit von {max_records}.")

        with self.db.conn:
            old_ids = [
                r[0]
                for r in self.db.execute(
                    "SELECT id FROM records WHERE node_id = ?", [node_id]
                ).fetchall()
            ]
            if old_ids:
                placeholders = ",".join(["?"] * len(old_ids))
                self.db.execute(f"DELETE FROM records_fts WHERE id IN ({placeholders})", old_ids)

            self.db["records"].delete_where("node_id = ?", [node_id])

            node_label, layout_fields = self._get_node_label_and_layout(node_id)
            now = time.time()

            recs_to_ins = []
            fts_to_ins = []
            final_records = []

            for i, r in enumerate(records):
                rec_id = r.get("id") or str(uuid.uuid4())
                data_to_save = {k: v for k, v in r.items() if k != "id"}

                recs_to_ins.append({
                    "id": rec_id,
                    "node_id": node_id,
                    "data": json.dumps(data_to_save),
                    "record_index": i,
                    "created_at": now,
                    "updated_at": now,
                })

                return_record = data_to_save.copy()
                return_record["id"] = rec_id
                final_records.append(return_record)

                fts_to_ins.append(
                    (rec_id, build_fts_text(node_label, data_to_save, layout_fields), node_id)
                )

            if recs_to_ins:
                self.db["records"].insert_all(recs_to_ins)
                self.db.execute(
                    "INSERT INTO records_fts (id, text_content, node_id) VALUES "
                    + ",".join(["(?, ?, ?)"] * len(fts_to_ins)),
                    [x for item in fts_to_ins for x in item],
                )

        self.sync_node_assets(node_id)
        return final_records

    # --- App Config & Custom Dictionary ---

    def save_active_node(self, node_id: str) -> None:
        self.db["app_config"].insert(
            {"key": "active_node_id", "value": json.dumps(node_id)}, pk="key", replace=True
        )

    def get_custom_dictionary(self) -> List[str]:
        try:
            if "app_config" in self.db.table_names():
                row = self.db["app_config"].get("custom_dictionary")
                if row:
                    return json.loads(row["value"])
        except Exception:
            pass
        return []

    def add_custom_dictionary_word(self, word: str) -> List[str]:
        words = set(self.get_custom_dictionary())
        words.add(word)
        word_list = sorted(words)
        self.db["app_config"].insert(
            {"key": "custom_dictionary", "value": json.dumps(word_list)}, pk="key", replace=True
        )
        return word_list

    def remove_custom_dictionary_word(self, word: str) -> List[str]:
        words = set(self.get_custom_dictionary())
        words.discard(word)
        word_list = sorted(words)
        self.db["app_config"].insert(
            {"key": "custom_dictionary", "value": json.dumps(word_list)}, pk="key", replace=True
        )
        return word_list

    # --- Digital Asset Management ---

    def get_assets(self, node_id: str, record_id: Optional[str] = None) -> List[Dict[str, Any]]:
        query = "node_id = ?"
        params = [node_id]
        if record_id:
            query += " AND record_id = ?"
            params.append(record_id)
        else:
            query += " AND (record_id IS NULL OR record_id = '')"
        return list(self.db["digital_assets"].rows_where(query, params))

    def add_asset(
        self, node_id: str, cloud_file_id: str, label: str, record_id: Optional[str] = None
    ) -> str:
        asset_id = str(uuid.uuid4())
        self.db["digital_assets"].insert({
            "id": asset_id,
            "node_id": node_id,
            "record_id": record_id,
            "cloud_file_id": cloud_file_id,
            "label": label,
            "created_at": time.time(),
        })
        return asset_id

    def delete_asset(self, asset_id: str) -> None:
        self.db["digital_assets"].delete(asset_id)

    def sync_node_assets(self, node_id: str) -> None:
        """Keeps digital_assets in sync with inline 'asset:ID|...' references in node records."""
        if "digital_assets" not in self.db.table_names():
            return

        try:
            new_assets = []
            rows = list(self.db["records"].rows_where("node_id = ?", [node_id]))

            for r in rows:
                try:
                    data = json.loads(r["data"])
                    for val in data.values():
                        if isinstance(val, str) and val.startswith("asset:"):
                            for part in val[6:].split(";;"):
                                part = part.strip()
                                if not part:
                                    continue
                                sub_parts = part.split("|")
                                if sub_parts:
                                    new_assets.append({
                                        "id": str(uuid.uuid4()),
                                        "node_id": node_id,
                                        "record_id": r["id"],
                                        "cloud_file_id": sub_parts[0],
                                        "label": sub_parts[2] if len(sub_parts) > 2 else "Datei",
                                        "created_at": time.time(),
                                    })
                except Exception as e:
                    logger.warning(f"Failed to parse record {r.get('id')} for asset sync: {e}")

            with self.db.conn:
                self.db["digital_assets"].delete_where(
                    "node_id = ? AND record_id IS NOT NULL", [node_id]
                )
                if new_assets:
                    self.db["digital_assets"].insert_all(new_assets)
        except Exception as e:
            logger.error(f"Failed to sync node assets for {node_id}: {e}", exc_info=True)
