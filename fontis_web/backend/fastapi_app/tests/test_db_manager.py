import pytest
import sqlite_utils
import json
from fontis.db_manager import DBManager
from fontis.migration import ensure_schema

@pytest.fixture
def db_manager():
    # Erstelle eine temporäre In-Memory Datenbank für jeden Test
    db = sqlite_utils.Database(":memory:")
    ensure_schema(db)
    # Mocking DBManager to use our in-memory connection
    manager = DBManager(":memory:")
    manager.db = db
    return manager

def test_move_node(db_manager):
    # 1. Setup: Ein Elternknoten und zwei Kinder
    db_manager.db["nodes"].insert_all([
        {"id": "p1", "parent_id": None, "label": "Parent 1", "sort_order": 0, "layout_config": "[]"},
        {"id": "p2", "parent_id": None, "label": "Parent 2", "sort_order": 1, "layout_config": "[]"},
        {"id": "c1", "parent_id": "p1", "label": "Child 1", "sort_order": 0, "layout_config": "[]"}
    ])
    
    # 2. Act: Verschiebe Child 1 von Parent 1 in Parent 2
    # Die update_node Logik in db_manager.py erwartet targetId und position
    db_manager.update_node("c1", {"targetId": "p2", "position": "inside"})
    
    # 3. Assert: Überprüfe die neue parent_id
    node = db_manager.db["nodes"].get("c1")
    assert node["parent_id"] == "p2"
    
    # 4. Assert: Überprüfe die Kinderliste von p2
    children = db_manager.get_children("p2")
    assert len(children) == 1
    assert children[0]["id"] == "c1"

def test_update_node_layout_field_deletion(db_manager):
    # Setup node, layout config, and a record with asset references
    db_manager.db["nodes"].insert({
        "id": "node1",
        "parent_id": None,
        "label": "Test Node",
        "sort_order": 0,
        "layout_config": json.dumps([
            {"id": "field_1", "label": "Field 1"},
            {"id": "field_2", "label": "Field 2"}
        ])
    })
    
    db_manager.db["digital_assets"].insert({
        "id": "asset1",
        "node_id": "node1",
        "record_id": "rec1",
        "cloud_file_id": "file123",
        "label": "File",
        "created_at": 12345
    })
    
    db_manager.db["records"].insert({
        "id": "rec1",
        "node_id": "node1",
        "data": json.dumps({
            "field_1": "some text",
            "field_2": "asset:file123|image/png|pic.png|thumb123"
        }),
        "record_index": 0,
        "created_at": 12345,
        "updated_at": 12345
    })
    
    # Act: Update layout Fields to delete field_2
    db_manager.update_node("node1", {
        "layoutFields": [
            {"id": "field_1", "label": "Field 1"}
        ]
    })
    
    # Assert 1: The field is removed from layout_config
    node = db_manager.db["nodes"].get("node1")
    layout = json.loads(node["layout_config"])
    assert len(layout) == 1
    assert layout[0]["id"] == "field_1"
    
    # Assert 2: The record data no longer contains field_2
    record = db_manager.db["records"].get("rec1")
    data = json.loads(record["data"])
    assert "field_2" not in data
    assert "field_1" in data
    assert data["field_1"] == "some text"
    
    # Assert 3: sync_node_assets was run and removed the asset link from digital_assets
    assets = list(db_manager.db["digital_assets"].rows)
    assert len(assets) == 0

def test_create_node_name_conflict_resolution(db_manager):
    # Setup: root node and a child named "Test Node"
    db_manager.db["nodes"].insert_all([
        {"id": "p1", "parent_id": None, "label": "Parent", "sort_order": 0, "layout_config": "[]"},
        {"id": "c1", "parent_id": "p1", "label": "Test Node", "sort_order": 0, "layout_config": "[]"}
    ])
    
    # Create another node under p1 with the same label "Test Node"
    new_node = db_manager.create_node("p1", "Test Node", [])
    
    # Should resolve conflict by suffixing
    assert new_node["label"] == "Test Node (1)"
    
    # Verify it was inserted in database
    db_node = db_manager.db["nodes"].get(new_node["id"])
    assert db_node["label"] == "Test Node (1)"

def test_rename_node_conflict_raises_value_error(db_manager):
    # Setup: two sibling nodes
    db_manager.db["nodes"].insert_all([
        {"id": "p1", "parent_id": None, "label": "Parent", "sort_order": 0, "layout_config": "[]"},
        {"id": "c1", "parent_id": "p1", "label": "Node A", "sort_order": 0, "layout_config": "[]"},
        {"id": "c2", "parent_id": "p1", "label": "Node B", "sort_order": 1, "layout_config": "[]"}
    ])
    
    # Rename Node A to Node B should raise ValueError
    with pytest.raises(ValueError) as exc:
        db_manager.update_node("c1", {"label": "Node B"})
    assert "existiert bereits auf dieser Ebene" in str(exc.value)

def test_move_node_conflict_raises_value_error(db_manager):
    # Setup: parent 1 with child "Node A", parent 2 with child "Node A"
    db_manager.db["nodes"].insert_all([
        {"id": "p1", "parent_id": None, "label": "Parent 1", "sort_order": 0, "layout_config": "[]"},
        {"id": "p2", "parent_id": None, "label": "Parent 2", "sort_order": 1, "layout_config": "[]"},
        {"id": "c1", "parent_id": "p1", "label": "Node A", "sort_order": 0, "layout_config": "[]"},
        {"id": "c2", "parent_id": "p2", "label": "Node A", "sort_order": 0, "layout_config": "[]"}
    ])
    
    # Move c1 ("Node A" under p1) inside p2 (which already contains "Node A")
    with pytest.raises(ValueError) as exc:
        db_manager.update_node("c1", {"targetId": "p2", "position": "inside"})
    assert "existiert bereits am Zielort" in str(exc.value)

def test_import_data_no_records_success(db_manager):
    # Setup: import data containing only nodes and no records
    import_payload = {
        "treeData": [
            {
                "id": "node1",
                "label": "Testbestand ohne Datensaetze",
                "isOpen": True,
                "layoutFields": [],
                "records": [],
                "children": []
            }
        ]
    }
    
    # Act: This should succeed and not crash on empty records_fts insert
    db_manager.import_data(import_payload, append=False)
    
    # Assert
    nodes = list(db_manager.db["nodes"].rows)
    assert len(nodes) == 1
    assert nodes[0]["id"] == "node1"
    assert nodes[0]["label"] == "Testbestand ohne Datensaetze"
    
    records = list(db_manager.db["records"].rows)
    assert len(records) == 0

def test_custom_dictionary(db_manager):
    # Initially empty
    assert db_manager.get_custom_dictionary() == []

    # Add word
    words = db_manager.add_custom_dictionary_word("Archivalie")
    assert "Archivalie" in words
    assert db_manager.get_custom_dictionary() == ["Archivalie"]

    # Add another word (sorted, unique)
    words = db_manager.add_custom_dictionary_word("Aktenplan")
    assert words == ["Aktenplan", "Archivalie"]

    # Remove word
    words = db_manager.remove_custom_dictionary_word("Aktenplan")
    assert words == ["Archivalie"]
    assert db_manager.get_custom_dictionary() == ["Archivalie"]

