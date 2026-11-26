import xml.etree.ElementTree as ET
import json
import uuid
import time
from typing import Dict, Any, List

def build_ead_tree(node, records_by_node, nodes_by_parent, mapping: Dict[str, str], ead_parent: ET.Element):
    """Recursively builds EAD <c> components from Fontis Web nodes."""
    node_id = node["id"]
    
    # Create <c> element representing this node
    c_elem = ET.SubElement(ead_parent, "c", level="otherlevel", otherlevel="fontis_node")
    c_elem.set("id", f"fontis_{node_id}")
    
    did = ET.SubElement(c_elem, "did")
    
    # Always include a unittitle for the node itself (the folder/collection name)
    unittitle = ET.SubElement(did, "unittitle")
    unittitle.text = node.get("label", "Unbenannt")
    
    # In Fontis Web, a Node can own multiple Records.
    # In EAD, typically one physical item is one <c>. 
    # To map this, we can represent each Record as a sub-component <c> under this node.
    records = records_by_node.get(node_id, [])
    
    # Resolve field IDs from either exact ID or case-insensitive layoutFields label
    label_to_id = {
        str(f.get("label", "")).strip().lower(): f.get("id")
        for f in node.get("layoutFields", [])
        if isinstance(f, dict) and f.get("id")
    }

    def resolve_key(mapped_name):
        if not mapped_name:
            return ""
        return label_to_id.get(mapped_name.strip().lower(), mapped_name)

    for rec_index, r_data in records:
        rec_c = ET.SubElement(c_elem, "c", level="file")
        rec_id = str(uuid.uuid4()) 
        rec_c.set("id", f"fontis_rec_{rec_index}")
        
        rec_did = ET.SubElement(rec_c, "did")
        
        # Apply Mapping (match exact key first, then fallback to layout label)
        raw_title_key = mapping.get("unittitle", "")
        raw_id_key = mapping.get("unitid", "")
        raw_date_key = mapping.get("unitdate", "")

        title_key = raw_title_key if raw_title_key in r_data else resolve_key(raw_title_key)
        id_key = raw_id_key if raw_id_key in r_data else resolve_key(raw_id_key)
        date_key = raw_date_key if raw_date_key in r_data else resolve_key(raw_date_key)

        title_val = r_data.get(title_key)
        id_val = r_data.get(id_key)
        date_val = r_data.get(date_key)
        
        if title_val:
            ut = ET.SubElement(rec_did, "unittitle")
            ut.text = str(title_val)
        else:
            ut = ET.SubElement(rec_did, "unittitle")
            ut.text = f"[Datensatz {rec_index}]"
            
        if id_val:
            uid = ET.SubElement(rec_did, "unitid")
            uid.text = str(id_val)
            
        if date_val:
            udate = ET.SubElement(rec_did, "unitdate")
            udate.text = str(date_val)
            
        # Add unmapped fields to <odd>
        mapped_keys = {title_key, id_key, date_key}
        unmapped_data = {k: v for k, v in r_data.items() if k not in mapped_keys and v}
        
        if unmapped_data:
            odd = ET.SubElement(rec_c, "odd")
            odd_head = ET.SubElement(odd, "head")
            odd_head.text = "Zusätzliche Fontis Web Daten"
            for k, v in unmapped_data.items():
                p = ET.SubElement(odd, "p")
                p.text = f"{k}: {v}"

    # Recurse for children
    children = nodes_by_parent.get(node_id, [])
    for child in children:
        build_ead_tree(child, records_by_node, nodes_by_parent, mapping, c_elem)

def generate_ead_xml(export_data: Dict[str, Any], mapping: Dict[str, str]) -> str:
    """Generates an EAD XML string from Fontis Web export data based on user mapping."""
    ead = ET.Element("ead", xmlns="urn:isbn:1-931666-22-9")
    
    eadheader = ET.SubElement(ead, "eadheader")
    eadid = ET.SubElement(eadheader, "eadid")
    eadid.text = "fontis_web_export_" + str(int(time.time()))
    filedesc = ET.SubElement(eadheader, "filedesc")
    titlestmt = ET.SubElement(filedesc, "titlestmt")
    titleproper = ET.SubElement(titlestmt, "titleproper")
    titleproper.text = "Fontis Web EAD Export"
    
    archdesc = ET.SubElement(ead, "archdesc", level="collection")
    did = ET.SubElement(archdesc, "did")
    unittitle = ET.SubElement(did, "unittitle")
    unittitle.text = "Gesamtexport Fontis Web Archiv"
    
    dsc = ET.SubElement(archdesc, "dsc") 
    
    def traverse_frontend_tree(node_list, parent_elem):
        for node in node_list:
            c_elem = ET.SubElement(parent_elem, "c", level="otherlevel", otherlevel="fontis_node")
            c_elem.set("id", f"fontis_{node['id']}")
            
            did = ET.SubElement(c_elem, "did")
            unittitle = ET.SubElement(did, "unittitle")
            unittitle.text = node.get("label", "Unbenannt")
            
            id_to_label = {f.get("id"): f.get("label", f.get("id")) for f in node.get("layoutFields", [])}
            
            for i, r_data in enumerate(node.get("records", [])):
                if not r_data: continue 
                rec_c = ET.SubElement(c_elem, "c", level="file")
                rec_did = ET.SubElement(rec_c, "did")
                
                title_val = r_data.get(mapping.get("unittitle", ""))
                id_val = r_data.get(mapping.get("unitid", ""))
                date_val = r_data.get(mapping.get("unitdate", ""))
                
                if title_val:
                    ut = ET.SubElement(rec_did, "unittitle")
                    ut.text = str(title_val)
                else:
                    ut = ET.SubElement(rec_did, "unittitle")
                    ut.text = f"[Datensatz {i}]"
                    
                if id_val:
                    uid = ET.SubElement(rec_did, "unitid")
                    uid.text = str(id_val)
                    
                if date_val:
                    udate = ET.SubElement(rec_did, "unitdate")
                    udate.text = str(date_val)
                    
                mapped_keys = {mapping.get("unittitle"), mapping.get("unitid"), mapping.get("unitdate")}
                unmapped_data = {k: v for k, v in r_data.items() if k not in mapped_keys and str(v).strip() and k in id_to_label}
                
                if unmapped_data:
                    odd = ET.SubElement(rec_c, "odd")
                    for k, v in unmapped_data.items():
                        field_label = id_to_label.get(k, k)
                        p = ET.SubElement(odd, "p", label=str(field_label))
                        p.set("id", str(k))
                        p.text = str(v)

            if "children" in node:
                 traverse_frontend_tree(node["children"], c_elem)

    traverse_frontend_tree(export_data.get("treeData", []), dsc)
    
    ET.indent(ead, space="  ", level=0)
    return ET.tostring(ead, encoding="unicode", method="xml")

def parse_ead_xml(xml_content: str, mapping: Dict[str, str]) -> Dict[str, Any]:
    """Parses an EAD XML string back into Fontis Web export data structure."""
    
    root = ET.fromstring(xml_content)
    
    # EAD namespace handling
    has_ns = '}' in root.tag
    ns_uri = root.tag.split('}')[0][1:] if has_ns else ""
    ns = {'ead': ns_uri} if has_ns else {}
    
    def get_tag(tag_name):
        return f"{{{ns_uri}}}{tag_name}" if has_ns else tag_name

    def find_first(elem, tag_name):
        res = elem.find(f".//ead:{tag_name}", ns) if has_ns else elem.find(f".//{tag_name}")
        return res

    component_tags = ["c"] + [f"c{i:02d}" for i in range(1, 13)]
    
    def get_component_children(elem):
        children = []
        for tag in component_tags:
            children.extend(elem.findall(get_tag(tag)))
        return children

    tree_data = []
    
    dsc = find_first(root, "dsc")
    if dsc is None:
         archdesc = find_first(root, "archdesc")
         if archdesc:
             c_elems = get_component_children(archdesc)
         else:
             c_elems = []
    else:
         c_elems = get_component_children(dsc)
         
    def process_c_elem(c_node):
        level = c_node.get("level", "").lower()
        otherlevel = c_node.get("otherlevel", "").lower()
        
        did = c_node.find(get_tag("did"))
        title_elem = did.find(get_tag("unittitle")) if did is not None else None
        label = ""
        if title_elem is not None:
             label = "".join(title_elem.itertext()).strip()
        
        if not label:
             label = "Unbenannt"

        c_id = c_node.get("id", "").replace("fontis_", "") 
        if not c_id:
            # Generate stable ID from title and signature if available
            sig_elem = did.find(get_tag("unitid")) if did is not None else None
            sig = "".join(sig_elem.itertext()).strip() if sig_elem is not None else ""
            
            clean_label = label
            if label.startswith("[Datensatz "): clean_label = ""
            
            if sig or clean_label:
                import hashlib
                # Use a prefix to distinguish generated IDs
                seed = f"{level}_{sig}_{clean_label}"
                c_id = "gen_" + hashlib.md5(seed.encode("utf-8")).hexdigest()
            else:
                c_id = str(uuid.uuid4())
        
        is_folder = True
            
        node_obj = {
            "id": c_id,
            "label": label,
            "isOpen": True,
            "layoutFields": [], 
            "records": [],
            "children": []
        }
        
        child_components = get_component_children(c_node)
        
        # If this node itself is a file/item, it should represent its own data as a record.
        # This is reached if it's a top-level component or a complex file (with children).
        if level in ("file", "item"):
             record_data = process_record(c_node)
             node_obj["records"].append(record_data)
        
        for child in child_components:
             child_level = child.get("level", "").lower()
             child_sub_components = get_component_children(child)
             
             # Group simple files/items into records of the current node
             if child_level in ("file", "item") and not child_sub_components:
                  record_data = process_record(child)
                  node_obj["records"].append(record_data)
             else:
                  # Otherwise create a sub-node
                  sub_node = process_c_elem(child)
                  node_obj["children"].append(sub_node)
                         
        return node_obj

    def process_record(c_node):
        data = {}
        did = c_node.find(get_tag("did"))
        
        # Internal ID for the record (not stored in 'data' dict usually, but we'll add it for stability)
        c_id = c_node.get("id", "").replace("fontis_", "")
        if not c_id:
             title_elem = did.find(get_tag("unittitle")) if did is not None else None
             sig_elem = did.find(get_tag("unitid")) if did is not None else None
             label = "".join(title_elem.itertext()).strip() if title_elem is not None else ""
             sig = "".join(sig_elem.itertext()).strip() if sig_elem is not None else ""
             import hashlib
             seed = f"rec_{sig}_{label}"
             c_id = "gen_rec_" + hashlib.md5(seed.encode("utf-8")).hexdigest()
             
        data["_import_id"] = c_id # Temporarily store to pass to db_manager
        
        if did is not None:
             title_elem = did.find(get_tag("unittitle"))
             if title_elem is not None:
                 text = "".join(title_elem.itertext()).strip()
                 if text and not text.startswith("[Datensatz "):
                     key = mapping.get("unittitle", "titel")
                     data[key] = text
             
             id_elems = did.findall(get_tag("unitid"))
             id_parts = []
             for id_el in id_elems:
                 id_text = "".join(id_el.itertext()).strip()
                 if id_text:
                     id_type = id_el.get("type")
                     if id_type:
                         id_parts.append(f"{id_type}: {id_text}")
                     else:
                         id_parts.append(id_text)
             
             if id_parts:
                 key = mapping.get("unitid", "signatur")
                 data[key] = " / ".join(id_parts)
                 
             date_elem = did.find(get_tag("unitdate"))
             if date_elem is not None:
                 text = "".join(date_elem.itertext()).strip()
                 if text:
                     key = mapping.get("unitdate", "laufzeit")
                     data[key] = text

             abstract_elems = did.findall(get_tag("abstract"))
             for abs_el in abstract_elems:
                 abs_text = "".join(abs_el.itertext()).strip()
                 if abs_text:
                     abs_type = abs_el.get("type", "Inhalt")
                     key = f"Abstract ({abs_type})" if abs_type else "Abstract"
                     data[key] = abs_text

        odd_elems = c_node.findall(get_tag("odd"))
        for odd in odd_elems:
             paragraphs = odd.findall(get_tag("p"))
             for p in paragraphs:
                  label = p.get("label")
                  field_id = p.get("id")
                  key = label if label else field_id
                  p_text = "".join(p.itertext()).strip()
                  
                  if key and p_text:
                      data[key] = p_text
                  elif p_text and ": " in p_text:
                      k, v = p_text.split(": ", 1)
                      data[k] = v
                  elif p_text:
                      data["Zusatzinfo"] = p_text
        return data

    for c_elem in c_elems:
        tree_data.append(process_c_elem(c_elem))
        
    return {"treeData": tree_data}

if __name__ == "__main__":
    sample_data = {
        "treeData": [{
             "id": "root", "label": "Hauptarchiv",
             "records": [{"titel_feld": "Akte X", "datum_feld": "2020", "extra_info": "Geheim"}],
             "children": []
        }]
    }
    mapping = {"unittitle": "titel_feld", "unitdate": "datum_feld"}
    sample_xml = generate_ead_xml(sample_data, mapping)
    print("Exported XML:")
    print(sample_xml)
    print("\nParsed Back:")
    parsed = parse_ead_xml(sample_xml, mapping)
    print(json.dumps(parsed, indent=2))
