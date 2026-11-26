import pytest
import sqlite_utils
import json
from fontis.search_service import SearchService
from fontis.migration import ensure_schema

@pytest.fixture
def search_service():
    db = sqlite_utils.Database(":memory:")
    ensure_schema(db)
    # FTS Setup (normalerweise Teil von ensure_schema, aber zur Sicherheit hier)
    if "records_fts" not in db.table_names():
        db.execute("CREATE VIRTUAL TABLE records_fts USING fts5(id, text_content, node_id)")
    
    service = SearchService(":memory:")
    service.db = db
    return service

def test_full_text_search(search_service):
    # 1. Setup: Ein Knoten und ein Datensatz
    node_id = "node1"
    rec_id = "rec1"
    search_term = "Geheimdokument"
    
    # Layout Config ist wichtig für die Preview-Generierung im SearchService
    layout_config = json.dumps([{"id": "f1", "label": "Titel", "x": 0, "y": 0}])
    
    search_service.db["nodes"].insert({
        "id": node_id, "label": "Testbestand", "parent_id": None, "sort_order": 0, "layout_config": layout_config
    })
    
    search_service.db["records"].insert({
        "id": rec_id, "node_id": node_id, "data": json.dumps({"f1": search_term}), "record_index": 0
    })
    
    # 2. FTS Index befüllen
    search_service.db.execute(
        "INSERT INTO records_fts (id, text_content, node_id) VALUES (?, ?, ?)",
        (rec_id, f"Testbestand Titel: {search_term}", node_id)
    )
    
    # 3. Act: Suche nach dem Begriff (erwartet eine Liste von Strings)
    results = search_service.search([search_term])
    
    # 4. Assert: Erwarte einen Treffer
    assert len(results) == 1
    assert results[0]["id"] == rec_id
    assert results[0]["metadata"]["node_label"] == "Testbestand"
    assert search_term in results[0]["metadata"]["preview"]

def test_search_pagination(search_service):
    # Setup: 10 records with the term "Geheimdokument"
    node_id = "node1"
    layout_config = json.dumps([{"id": "f1", "label": "Titel", "x": 0, "y": 0}])
    search_service.db["nodes"].insert({
        "id": node_id, "label": "Testbestand", "parent_id": None, "sort_order": 0, "layout_config": layout_config
    })
    
    inserts = []
    fts_inserts = []
    for i in range(10):
        rec_id = f"rec_{i}"
        inserts.append({
            "id": rec_id, "node_id": node_id, "data": json.dumps({"f1": f"Geheimdokument {i}"}), "record_index": i
        })
        fts_inserts.append((rec_id, f"Testbestand Titel: Geheimdokument {i}", node_id))
        
    search_service.db["records"].insert_all(inserts)
    
    # Fill FTS Index
    for item in fts_inserts:
        search_service.db.execute(
            "INSERT INTO records_fts (id, text_content, node_id) VALUES (?, ?, ?)", item
        )
        
    # Search with limit=3, offset=0
    results_p1 = search_service.search(["Geheimdokument"], limit=3, offset=0)
    assert len(results_p1) == 3
    assert [r["id"] for r in results_p1] == ["rec_0", "rec_1", "rec_2"]
    
    # Search with limit=3, offset=3
    results_p2 = search_service.search(["Geheimdokument"], limit=3, offset=3)
    assert len(results_p2) == 3
    assert [r["id"] for r in results_p2] == ["rec_3", "rec_4", "rec_5"]
    
    # Search with limit=5, offset=8
    results_p3 = search_service.search(["Geheimdokument"], limit=5, offset=8)
    assert len(results_p3) == 2
    assert [r["id"] for r in results_p3] == ["rec_8", "rec_9"]

def test_semantic_and_hybrid_search(search_service):
    # 1. Setup: Two records with different topics
    node_id = "node1"
    layout_config = json.dumps([{"id": "f1", "label": "Titel", "x": 0, "y": 0}])
    search_service.db["nodes"].insert({
        "id": node_id, "label": "Testbestand", "parent_id": None, "sort_order": 0, "layout_config": layout_config
    })
    
    # Record 1: Feuerwehr (semantic search should match this for "Rettungsdienst" or "einsatz")
    search_service.db["records"].insert({
        "id": "rec_fire", "node_id": node_id, "data": json.dumps({"f1": "Freiwillige Feuerwehr Oestrich"}), "record_index": 0
    })
    search_service.db.execute(
        "INSERT INTO records_fts (id, text_content, node_id) VALUES (?, ?, ?)",
        ("rec_fire", "Testbestand Titel: Freiwillige Feuerwehr Oestrich", node_id)
    )
    
    # Record 2: Finanzen (semantic search should NOT match this for "Rettungsdienst")
    search_service.db["records"].insert({
        "id": "rec_finance", "node_id": node_id, "data": json.dumps({"f1": "Jahresbericht Haushaltsplan Finanzen"}), "record_index": 1
    })
    search_service.db.execute(
        "INSERT INTO records_fts (id, text_content, node_id) VALUES (?, ?, ?)",
        ("rec_finance", "Testbestand Titel: Jahresbericht Haushaltsplan Finanzen", node_id)
    )
    
    # 2. Test semantic search (pure)
    # Searching for "Rettungseinsatz" (not in FTS text, but semantically related to Feuerwehr)
    results = search_service.search(["Rettungseinsatz"], mode="semantic")
    
    assert len(results) >= 1
    assert results[0]["id"] == "rec_fire"
    # Ensure score is present and valid
    assert "score" in results[0]
    assert results[0]["score"] > 0.0
    
    # 3. Test hybrid search (RRF)
    # Searching for "Feuerwehr" should find both lexically and semantically, top rank should be rec_fire
    results_hybrid = search_service.search(["Feuerwehr"], mode="hybrid")
    assert len(results_hybrid) >= 1
    assert results_hybrid[0]["id"] == "rec_fire"

def test_sync_embeddings_hierarchy_and_assets(search_service):
    # Setup hierarchy: Root -> Intermediate (Bestand) -> Subnode (Klassifikation)
    search_service.db["nodes"].insert_all([
        {"id": "root", "label": "Hauptarchiv Oestrich", "parent_id": None, "sort_order": 0},
        {"id": "bestand_b", "label": "B - Gewerbewesen", "parent_id": "root", "sort_order": 1},
        {"id": "sub_b1", "label": "B1 - Bäckereien und Mühlen", "parent_id": "bestand_b", "sort_order": 2}
    ])
    
    # Record with digital asset reference in data
    # format: asset:<uuid>|<mime>|<filename>|<thumb>
    asset_ref = "asset:uuid-1234-abcd|image/jpeg|historische_muehle.jpg|thumb_uuid"
    rec_data = {
        "f_titel": "Kornmühle Josef Schmidt",
        "f_bild": asset_ref
    }
    
    search_service.db["records"].insert({
        "id": "rec_muehle",
        "node_id": "sub_b1",
        "data": json.dumps(rec_data),
        "record_index": 0
    })
    
    # Run sync_embeddings
    search_service.sync_embeddings()
    
    # Check that an embedding was created
    rows = list(search_service.db.query("SELECT id, text_hash, embedding FROM records_embeddings WHERE id = 'rec_muehle'"))
    assert len(rows) == 1
    assert len(rows[0]["embedding"]) > 0
    
    # Verify semantic search by ancestor category (e.g. "Gewerbewesen" or "Bäckereien")
    results = search_service.search(["Gewerbewesen"], mode="semantic")
    assert len(results) >= 1
    assert results[0]["id"] == "rec_muehle"
    assert results[0]["score"] >= 0.33


def test_semantic_threshold_filtering(search_service):
    # Tests that matches with score >= 0.33 are included, while unrelated items are excluded
    node_id = "node_threshold"
    search_service.db["nodes"].insert({
        "id": node_id, "label": "Allgemeine Verwaltung", "parent_id": None, "sort_order": 0
    })
    
    # Record: Historical calculation device
    search_service.db["records"].insert({
        "id": "rec_rechenwalze",
        "node_id": node_id,
        "data": json.dumps({"f_titel": "Präzisions-Rechenwalze für Kalkulation", "f_material": "Metall, Papier"}),
        "record_index": 0
    })
    search_service.sync_embeddings()
    
    # "Mathematik" is contextually related (~0.35-0.45 score) -> should be found at 0.33 threshold
    results_math = search_service.search(["Mathematik"], mode="semantic")
    assert len(results_math) >= 1
    assert results_math[0]["id"] == "rec_rechenwalze"
    assert results_math[0]["score"] >= 0.33

    # "Brot backen" is unrelated (<0.30 score) -> should be excluded by threshold
    results_unrelated = search_service.search(["Brot backen"], mode="semantic")
    assert len(results_unrelated) == 0

def test_pure_date_range_search(search_service):
    node_id = "node_date"
    layout_config = json.dumps([
        {"id": "f_sig", "label": "Signatur", "x": 0, "y": 0},
        {"id": "f_title", "label": "Titel", "x": 100, "y": 0},
        {"id": "f_laufzeit", "label": "Laufzeit", "x": 0, "y": 50}
    ])
    search_service.db["nodes"].insert({
        "id": node_id, "label": "Historische Akten", "parent_id": None, "sort_order": 0, "layout_config": layout_config
    })
    
    search_service.db["records"].insert_all([
        {"id": "r_1850", "node_id": node_id, "data": json.dumps({"f_sig": "A-01", "f_title": "Alte Akte", "f_laufzeit": "1850"}), "record_index": 0},
        {"id": "r_1890_1910", "node_id": node_id, "data": json.dumps({"f_sig": "A-02", "f_title": "Jahrhundertwende", "f_laufzeit": "1890 - 1910"}), "record_index": 1},
        {"id": "r_1925", "node_id": node_id, "data": json.dumps({"f_sig": "A-03", "f_title": "Zwanziger Jahre", "f_laufzeit": "1925"}), "record_index": 2}
    ])
    
    # Search with only min_year=1900 and empty text query
    results = search_service.search([], min_year=1900, mode="classic")
    assert len(results) == 2
    ids = {r["id"] for r in results}
    assert ids == {"r_1890_1910", "r_1925"}
    # Verify that preview picked the title
    titles = {r["metadata"]["preview"] for r in results}
    assert "Jahrhundertwende" in titles
    assert "Zwanziger Jahre" in titles


def test_preview_matches_compound_betreff_label(search_service):
    node_id = "node_urkunden"
    layout_config = json.dumps([
        {"id": "f_sig", "label": "Signatur", "x": 0, "y": 0},
        {"id": "f_betreff", "label": "Betreff / Urkundentitel", "x": 100, "y": 0},
        {"id": "f_art", "label": "Urkundenart", "x": 200, "y": 0}
    ])
    search_service.db["nodes"].insert({
        "id": node_id, "label": "Urkunden", "parent_id": None, "sort_order": 0, "layout_config": layout_config
    })
    rec_data = {
        "f_sig": "U01/001",
        "f_betreff": "Bestätigung des Marktrechts-Privilegs durch Graf Engelbert",
        "f_art": "Pergamenturkunde / Privileg"
    }
    search_service.db["records"].insert({
        "id": "rec_u1", "node_id": node_id, "data": json.dumps(rec_data), "record_index": 0
    })
    search_service.db.execute(
        "INSERT INTO records_fts (id, text_content, node_id) VALUES (?, ?, ?)",
        ("rec_u1", "Urkunden Signatur: U01/001 Betreff / Urkundentitel: Bestätigung des Marktrechts-Privilegs Urkundenart: Pergamenturkunde", node_id)
    )

    results = search_service.search(["urkunde"], mode="classic")
    assert len(results) == 1
    assert results[0]["metadata"]["signature"] == "U01/001"
    assert results[0]["metadata"]["preview"] == "Bestätigung des Marktrechts-Privilegs durch Graf Engelbert"





