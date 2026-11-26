import pytest
import sqlite_utils
import json
from fontis.db_manager import DBManager
from fontis.migration import ensure_schema

@pytest.fixture
def db_manager():
    # Create an in-memory DB for testing
    db = sqlite_utils.Database(":memory:")
    ensure_schema(db)
    manager = DBManager(":memory:")
    manager.db = db
    return manager

def test_json_import_missing_node_ids(db_manager):
    # JSON data with missing node 'id'
    json_data = {
        "treeData": [
            {
                "label": "Root Folder",
                "layoutFields": [{"id": "titel", "type": "text", "label": "Titel"}],
                "records": [{"titel": "Record 1"}],
                "children": [
                    {
                        "label": "Subfolder",
                        "records": [{"titel": "Record 2"}]
                    }
                ]
            }
        ]
    }
    
    # Import should succeed and auto-generate node IDs
    db_manager.import_data(json_data, append=False)
    
    # Verify node counts
    nodes = list(db_manager.db["nodes"].rows)
    assert len(nodes) == 2
    
    # Verify records
    records = list(db_manager.db["records"].rows)
    assert len(records) == 2
    
    # All nodes must have generated UUID IDs
    for node in nodes:
        assert node["id"] is not None
        assert len(node["id"]) > 0

def test_json_import_malformed_records(db_manager):
    # JSON data with malformed non-dictionary records (e.g. a string)
    json_data = {
        "treeData": [
            {
                "id": "root_node",
                "label": "Root Folder",
                "layoutFields": [{"id": "titel", "type": "text", "label": "Titel"}],
                "records": [
                    "this is a raw string record",  # non-dict (string)
                    {"titel": "normal dict record"},
                    None  # empty record
                ]
            }
        ]
    }
    
    # Import should handle string gracefully without crashing
    db_manager.import_data(json_data, append=False)
    
    # Verify that the valid dictionary record and the converted string record are imported
    records = list(db_manager.db["records"].rows)
    assert len(records) == 2
    
    # Verify contents
    record_data = [json.loads(r["data"]) for r in records]
    assert any("this is a raw string record" in str(d.values()) for d in record_data)
    assert any("normal dict record" in str(d.values()) for d in record_data)

def test_csv_export_flat_format(db_manager):
    # Pre-populate database with nodes and records
    # Create parent node
    parent_id = "node_p"
    db_manager.db["nodes"].insert({
        "id": parent_id,
        "parent_id": None,
        "label": "Firmenarchiv",
        "is_open": 1,
        "sort_order": 0,
        "layout_config": json.dumps([
            {"id": "f_title", "type": "text", "label": "Titel"},
            {"id": "f_date", "type": "text", "label": "Datum"}
        ])
    })
    # Create child node
    child_id = "node_c"
    db_manager.db["nodes"].insert({
        "id": child_id,
        "parent_id": parent_id,
        "label": "Finanzberichte",
        "is_open": 1,
        "sort_order": 0,
        "layout_config": json.dumps([
            {"id": "f_title", "type": "text", "label": "Titel"},
            {"id": "f_amount", "type": "text", "label": "Betrag"}
        ])
    })
    # Create records
    db_manager.db["records"].insert({
        "id": "rec_1",
        "node_id": parent_id,
        "data": json.dumps({"f_title": "Jahresbericht 2025", "f_date": "2025"}),
        "record_index": 0,
        "created_at": 12345.0,
        "updated_at": 12345.0
    })
    db_manager.db["records"].insert({
        "id": "rec_2",
        "node_id": child_id,
        "data": json.dumps({"f_title": "Q1 Report", "f_amount": "5000 €"}),
        "record_index": 0,
        "created_at": 12345.0,
        "updated_at": 12345.0
    })
    
    # Export entire archive (no node_id passed)
    csv_content = db_manager.export_csv()
    
    # Verify the output structure
    lines = [line.strip() for line in csv_content.split("\n") if line.strip()]
    assert len(lines) == 3 # Header + 2 data rows
    
    # The header should contain "Ordner" and sorted unique field labels: "Betrag", "Datum", "Titel"
    # Parse CSV content using csv.DictReader to ensure RFC 4180 compatibility
    import csv
    import io
    # Strip BOM first if present
    clean_csv_content = csv_content.lstrip('\ufeff')
    f = io.StringIO(clean_csv_content)
    try:
        dialect = csv.Sniffer().sniff(clean_csv_content[:1024])
        reader = csv.DictReader(f, dialect=dialect)
    except csv.Error:
        reader = csv.DictReader(f, delimiter=';')
    assert reader.fieldnames[0] == "Ordner"
    assert "Betrag" in reader.fieldnames
    assert "Datum" in reader.fieldnames
    assert "Titel" in reader.fieldnames
    
    rows = list(reader)
    assert len(rows) == 2
    
    row1 = next(r for r in rows if r["Ordner"] == "Firmenarchiv")
    assert row1["Titel"] == "Jahresbericht 2025"
    assert row1["Datum"] == "2025"
    assert row1["Betrag"] == ""
    
    row2 = next(r for r in rows if r["Ordner"] == "Firmenarchiv / Finanzberichte")
    assert row2["Titel"] == "Q1 Report"
    assert row2["Datum"] == ""
    assert row2["Betrag"] == "5000 €"


def test_csv_import_with_ordner_column(db_manager):
    # CSV content with "Ordner" column to resolve/create path dynamically
    csv_content = """Ordner,Titel,Datum,Signatur
Firmenarchiv / Steuern,Steuererklärung 2024,2024,ST-01
Firmenarchiv / Steuern,Steuererklärung 2025,2025,ST-02
Vereinsarchiv,Satzung,,V-01
"""
    # Import replacing existing structure
    db_manager.import_csv_data(csv_content, append=False)
    
    # Check that nodes were created
    nodes = list(db_manager.db["nodes"].rows)
    # Expected nodes: "Firmenarchiv", "Firmenarchiv / Steuern" (as child), "Vereinsarchiv"
    assert len(nodes) == 3
    
    node_labels = {n["label"] for n in nodes}
    assert "Firmenarchiv" in node_labels
    assert "Steuern" in node_labels
    assert "Vereinsarchiv" in node_labels
    
    # Check node relationships
    parent_node = next(n for n in nodes if n["label"] == "Firmenarchiv")
    child_node = next(n for n in nodes if n["label"] == "Steuern")
    assert child_node["parent_id"] == parent_node["id"]
    
    # Check records
    records = list(db_manager.db["records"].rows)
    assert len(records) == 3
    
    # Verify data mapping to layout configuration of nodes
    # Let's inspect layout config of Steuern node
    steuern_layout = json.loads(child_node["layout_config"])
    # Should have fields for Titel, Datum, Signatur (since those are columns, and Ordner is ignored)
    field_labels = {f["label"] for f in steuern_layout}
    assert "Titel" in field_labels
    assert "Datum" in field_labels
    assert "Signatur" in field_labels
    
    # Find records for Steuern node
    steuern_recs = [r for r in records if r["node_id"] == child_node["id"]]
    assert len(steuern_recs) == 2
    rec_data_list = [json.loads(r["data"]) for r in steuern_recs]
    
    titel_field_id = next(f["id"] for f in steuern_layout if f["label"] == "Titel")
    datum_field_id = next(f["id"] for f in steuern_layout if f["label"] == "Datum")
    signatur_field_id = next(f["id"] for f in steuern_layout if f["label"] == "Signatur")
    
    assert any(d.get(titel_field_id) == "Steuererklärung 2024" and d.get(datum_field_id) == "2024" and d.get(signatur_field_id) == "ST-01" for d in rec_data_list)
    assert any(d.get(titel_field_id) == "Steuererklärung 2025" and d.get(datum_field_id) == "2025" and d.get(signatur_field_id) == "ST-02" for d in rec_data_list)


def test_csv_import_into_selected_node_matches_fields(db_manager):
    # Pre-populate database with an existing folder
    target_node_id = "target_folder_123"
    db_manager.db["nodes"].insert({
        "id": target_node_id,
        "parent_id": None,
        "label": "Bestand A",
        "is_open": 1,
        "sort_order": 0,
        "layout_config": json.dumps([
            {"id": "f_existing_title", "type": "text", "label": "Titel"},
            {"id": "f_existing_sign", "type": "text", "label": "Signatur"}
        ])
    })
    
    # CSV content WITHOUT "Ordner" column, containing standard table data
    # Notice the case of headers: "titel" (lowercase) vs existing "Titel", and a new column "Laufzeit"
    csv_content = """titel,Signatur,Laufzeit
Akte 1,A-01,1990-2000
Akte 2,A-02,2001-2010
"""
    
    # Import into the specific target node
    db_manager.import_csv_data(csv_content, append=True, parent_node_id=target_node_id, filename="test_file.csv")
    
    # Verify a new node was created as a child of target_node_id
    nodes = list(db_manager.db["nodes"].rows)
    assert len(nodes) == 2
    
    new_node = next(n for n in nodes if n["parent_id"] == target_node_id)
    assert new_node["label"] == "test_file.csv"
    
    # Verify the new node's layout config has the three fields
    layout = json.loads(new_node["layout_config"])
    assert len(layout) == 3 # Titel, Signatur, and Laufzeit
    
    # Get IDs
    titel_field = next(f for f in layout if f["label"].lower() == "titel")
    sign_field = next(f for f in layout if f["label"].lower() == "signatur")
    laufzeit_field = next(f for f in layout if f["label"].lower() == "laufzeit")
    
    # Check imported records are under the new node
    records = list(db_manager.db["records"].rows_where("node_id = ?", [new_node["id"]]))
    assert len(records) == 2
    
    rec_data_list = [json.loads(r["data"]) for r in records]
    assert any(d.get(titel_field["id"]) == "Akte 1" and d.get(sign_field["id"]) == "A-01" and d.get(laufzeit_field["id"]) == "1990-2000" for d in rec_data_list)
    assert any(d.get(titel_field["id"]) == "Akte 2" and d.get(sign_field["id"]) == "A-02" and d.get(laufzeit_field["id"]) == "2001-2010" for d in rec_data_list)
