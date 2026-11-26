import json
from typing import Any, Dict, List, Optional


def normalize_parent_id(parent_id: Optional[str]) -> Optional[str]:
    """Converts frontend sentinel strings ('null', '') to None."""
    if parent_id == "null" or parent_id == "":
        return None
    return parent_id


def build_fts_text(node_label: str, data: Dict[str, Any], layout_fields: List[Dict[str, Any]]) -> str:
    """Builds the full-text search string for a single record."""
    label_by_id = {
        f.get("id"): f.get("label", "")
        for f in (layout_fields or [])
        if isinstance(f, dict) and f.get("id")
    }
    text_parts = []
    for key, val in data.items():
        if isinstance(val, str) and val.strip():
            field_label = label_by_id.get(key, "")
            text_parts.append(f"{field_label}: {val}" if field_label else val)
    return f"{node_label or ''} " + " ".join(text_parts)


def next_sort_order(db, parent_id: Optional[str]) -> int:
    """Returns the next sort_order integer for children of parent_id."""
    parent_id = normalize_parent_id(parent_id)
    try:
        if parent_id is None:
            current_max = db.execute("SELECT MAX(sort_order) FROM nodes WHERE parent_id IS NULL").fetchone()[0]
        else:
            current_max = db.execute(
                "SELECT MAX(sort_order) FROM nodes WHERE parent_id = ?", [parent_id]
            ).fetchone()[0]
        return (current_max + 1) if current_max is not None else 0
    except Exception:
        return 0


def sibling_label_exists(
    db, parent_id: Optional[str], label: str, exclude_node_id: Optional[str] = None
) -> bool:
    """Checks whether another node with the same label exists under parent_id."""
    parent_id = normalize_parent_id(parent_id)
    if parent_id is None:
        if exclude_node_id:
            rows = db["nodes"].rows_where(
                "parent_id IS NULL AND label = ? AND id != ?", [label, exclude_node_id]
            )
        else:
            rows = db["nodes"].rows_where("parent_id IS NULL AND label = ?", [label])
    else:
        if exclude_node_id:
            rows = db["nodes"].rows_where(
                "parent_id = ? AND label = ? AND id != ?", [parent_id, label, exclude_node_id]
            )
        else:
            rows = db["nodes"].rows_where("parent_id = ? AND label = ?", [parent_id, label])
    return bool(list(rows))


def resolve_unique_label(db, parent_id: Optional[str], base_label: str) -> str:
    """Appends ' (1)', ' (2)', ... until the label is unique among siblings."""
    parent_id = normalize_parent_id(parent_id)
    counter = 1
    resolved = base_label
    while sibling_label_exists(db, parent_id, resolved):
        resolved = f"{base_label} ({counter})"
        counter += 1
    return resolved


def clear_archive_tables(db) -> None:
    """Clears all archive content tables (nodes, records, FTS, digital assets)."""
    db.execute("DELETE FROM records")
    db.execute("DELETE FROM nodes")
    db.execute("DELETE FROM records_fts")
    if "digital_assets" in db.table_names():
        db.execute("DELETE FROM digital_assets")


def build_tree_snapshot(
    db, *, include_record_ids: bool = False, filter_valid_fields: bool = False
) -> List[Dict[str, Any]]:
    """Reconstructs the hierarchical node + record tree from relational tables."""
    nodes_by_parent: Dict[Optional[str], List[Dict[str, Any]]] = {}
    for n in db["nodes"].rows:
        nodes_by_parent.setdefault(n["parent_id"], []).append(n)
    for children in nodes_by_parent.values():
        children.sort(key=lambda x: x["sort_order"])

    records_by_node: Dict[str, List[Any]] = {}
    for r in db["records"].rows:
        try:
            r_data = json.loads(r["data"])
            if include_record_ids:
                r_data["id"] = r["id"]
            records_by_node.setdefault(r["node_id"], []).append((r["record_index"], r_data))
        except Exception:
            continue

    for nid, indexed_recs in records_by_node.items():
        indexed_recs.sort(key=lambda x: x[0])
        records_by_node[nid] = [x[1] for x in indexed_recs]

    def build_tree(parent_id: Optional[str]) -> List[Dict[str, Any]]:
        result = []
        for child in nodes_by_parent.get(parent_id, []):
            layout_fields = json.loads(child["layout_config"])
            raw_records = records_by_node.get(child["id"], [{}])

            if filter_valid_fields:
                valid_keys = {
                    f.get("id") for f in layout_fields if isinstance(f, dict) and "id" in f
                }
                records_list = [
                    {k: v for k, v in rec.items() if k in valid_keys} or {}
                    for rec in raw_records
                ]
            else:
                records_list = raw_records

            result.append({
                "id": child["id"],
                "label": child["label"],
                "isOpen": bool(child["is_open"]),
                "layoutFields": layout_fields,
                "records": records_list,
                "currentRecordIndex": 0,
                "children": build_tree(child["id"]),
            })
        return result

    return build_tree(None)
