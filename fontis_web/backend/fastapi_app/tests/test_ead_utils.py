import pytest
from fontis.ead_utils import parse_ead_xml

def test_parse_ead_xml_basic():
    # A minimal EAD XML structure
    ead_xml = """<?xml version="1.0" encoding="UTF-8"?>
    <ead>
      <archdesc level="collection">
        <did>
          <unittitle>Test Archiv</unittitle>
        </did>
        <dsc>
          <c level="file" id="c1">
            <did>
              <unittitle>Akte 1</unittitle>
              <unitid>SIG-001</unitid>
              <unitdate>1950</unitdate>
            </did>
          </c>
        </dsc>
      </archdesc>
    </ead>
    """
    
    mapping = {
        "unittitle": "Titel",
        "unitid": "Signatur",
        "unitdate": "Laufzeit"
    }
    
    result = parse_ead_xml(ead_xml, mapping)
    
    assert "treeData" in result
    assert len(result["treeData"]) == 1
    
    root_node = result["treeData"][0]
    assert root_node["label"] == "Akte 1"
    assert len(root_node["records"]) == 1
    
    record = root_node["records"][0]
    assert record["Titel"] == "Akte 1"
    assert record["Signatur"] == "SIG-001"
    assert record["Laufzeit"] == "1950"

def test_stable_id_generation():
    ead_xml = """<?xml version="1.0" encoding="UTF-8"?>
    <ead>
      <archdesc level="collection">
        <dsc>
          <c level="file">
            <did>
              <unittitle>Stabile Akte</unittitle>
              <unitid>SIG-STABLE</unitid>
            </did>
          </c>
        </dsc>
      </archdesc>
    </ead>
    """
    mapping = {"unittitle": "Titel", "unitid": "Signatur"}
    
    # Erster Import
    result1 = parse_ead_xml(ead_xml, mapping)
    id1 = result1["treeData"][0]["id"]
    
    # Zweiter Import (identische Daten)
    result2 = parse_ead_xml(ead_xml, mapping)
    id2 = result2["treeData"][0]["id"]
    
    assert id1 == id2
    assert id1.startswith("gen_")
    
    # Dritter Import (andere Signatur -> andere ID)
    ead_xml_diff = ead_xml.replace("SIG-STABLE", "SIG-DIFFERENT")
    result3 = parse_ead_xml(ead_xml_diff, mapping)
    id3 = result3["treeData"][0]["id"]
    
    assert id1 != id3

from fontis.ead_utils import generate_ead_xml

def test_ead_roundtrip():
    # 1. Ausgangs-XML
    original_xml = """<?xml version="1.0" encoding="UTF-8"?>
    <ead>
      <archdesc level="collection">
        <did><unittitle>Gesamtarchiv</unittitle></did>
        <dsc>
          <c level="file" id="node_a">
            <did>
              <unittitle>Akte A</unittitle>
              <unitid>SIG-A</unitid>
            </did>
            <c level="item" id="node_b">
              <did>
                <unittitle>Dokument B</unittitle>
              </did>
            </c>
          </c>
        </dsc>
      </archdesc>
    </ead>
    """
    mapping = {"unittitle": "Titel", "unitid": "Signatur"}
    
    # 2. Import: XML -> Dict
    import_result = parse_ead_xml(original_xml, mapping)
    
    # 3. Export: Dict -> XML
    export_xml = generate_ead_xml(import_result, mapping)
    
    # 4. Assert: Prüfe ob wichtige Begriffe im Export vorkommen
    assert "Akte A" in export_xml
    assert "Dokument B" in export_xml
    assert "SIG-A" in export_xml
    
    # 5. Re-Import: Export-XML -> Dict (Schleife schließen)
    final_result = parse_ead_xml(export_xml, mapping)
    
    assert len(final_result["treeData"]) == 1
    root = final_result["treeData"][0]
    assert root["label"] == "Akte A"
    
    # In Fontis Web, leaf components (like Dokument B) are grouped into records
    # of the parent node to keep the tree clean.
    assert len(root["records"]) == 2 # Akte A itself (since it has data) + Dokument B
    
    # Check if Dokument B is present in the records
    record_titles = [r.get("Titel") for r in root["records"]]
    assert "Dokument B" in record_titles


