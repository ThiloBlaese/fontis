from typing import List, Dict, Any, Optional
import re

def find_node_recursive(nodes: List[Dict[str, Any]], node_id: str) -> Optional[Dict[str, Any]]:
    for node in nodes:
        if node['id'] == node_id:
            return node
        if 'children' in node:
            found = find_node_recursive(node['children'], node_id)
            if found:
                return found
    return None

def extract_date_range(text: str) -> tuple[Optional[int], Optional[int]]:
    year_pattern = re.compile(r'\b(1\d{3}|20\d{2})\b')
    matches = year_pattern.findall(text)
    years = [int(y) for y in matches]
    if not years:
        return None, None
    return min(years), max(years)

def index_tree_recursive(nodes: List[Dict[str, Any]], search_service, parent_path: List[str] = None) -> int:
    """
    Recursively walks the tree data and indexes all records using the provided search_service.
    """
    count = 0
    
    # Regex for 4-digit years (1000-2999)
    year_pattern = re.compile(r'\b(1\d{3}|20\d{2})\b')
    if parent_path is None:
        parent_path = []

    for node in nodes:
        current_path = parent_path + [node['id']]
        
        # Index records in this node
        if 'records' in node and isinstance(node['records'], list):
            layout_fields = node.get('layoutFields', [])
            
            # Determine which fields are valid for indexing (e.g. text fields)
            # We index everything that has a value in the record matching a layout field
            valid_field_ids = {f['id'] for f in layout_fields}
            
            # Additional logic to identify the "First Field" (Top-Left) for preview
            # Sort fields by y, then x
            sorted_fields = sorted(layout_fields, key=lambda f: (f.get('y', 0), f.get('x', 0)))
            first_field_id = sorted_fields[0]['id'] if sorted_fields else None

            for i, record in enumerate(node['records']):
                # Skip empty records or special marker keys if any
                if not record:
                    continue
                
                # Construct text to index
                text_parts = []
                
                # Add node label to text so we can search by "Personalamt" etc.
                if 'label' in node:
                    text_parts.append(node['label'])
                
                preview_text = ""
                field_map = {}

                for key, value in record.items():
                    if key in valid_field_ids and isinstance(value, str) and value.strip():
                        # Add field label to text so we can search by "Signatur", "Titel" etc.
                        field_label = next((f["label"] for f in layout_fields if f["id"] == key), "")
                        if field_label:
                            text_parts.append(field_label)
                            field_map[field_label] = value.strip()[:50] # Store for dynamic preview

                        text_parts.append(value)
                        
                        # Set preview if this is the first field
                        if key == first_field_id:
                            preview_text = value.strip()[:50] # Truncate

                if text_parts:
                    full_text = " ".join(text_parts)
                    record_id = f"{node['id']}_{i}"
                    
                    # Extract year date range from this record
                    min_year, max_year = extract_date_range(full_text)
                    
                    metadata = {
                        "node_id": node['id'],
                        "record_index": i,
                        "node_label": node['label'],
                        "min_year": min_year,
                        "max_year": max_year,
                        "preview": preview_text,
                        "field_map": field_map,
                        "path": current_path # Store full path for scoped search
                    }
                    
                    search_service.upsert_record(record_id, full_text, metadata)
                    count += 1
        
        # Recurse
        if 'children' in node and isinstance(node['children'], list):
            count += index_tree_recursive(node['children'], search_service, current_path)
            
    return count
