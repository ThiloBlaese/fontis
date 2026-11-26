import datetime
import pytest
from fontis.pdf_generator import (
    clean_pdf_text,
    format_digitalisate,
    FindbuchPDF,
    FindbuchGenerator
)

def test_clean_pdf_text():
    # Test special characters and dashes
    raw = "Titel • Teil 1 – Band 2 — „Test“ und ‚Zitat‘ mit € und …"
    cleaned = clean_pdf_text(raw)
    assert "•" not in cleaned
    assert "–" not in cleaned
    assert "—" not in cleaned
    assert "EUR" in cleaned
    assert "..." in cleaned
    assert '"Test"' in cleaned
    assert "'Zitat'" in cleaned

    # Non-string input handling
    assert clean_pdf_text(None) == ""
    assert clean_pdf_text(12345) == "12345"

def test_format_digitalisate():
    # Pure text without asset: prefix
    assert format_digitalisate("Normaler Text") == "Normaler Text"
    assert format_digitalisate(123) == 123

    # Single asset
    asset_str = "asset:1234-5678-uuid|image/jpeg|urkunde_1848.jpg|thumb_uuid"
    assert format_digitalisate(asset_str) == "urkunde_1848.jpg"

    # Multiple assets delimited by ;;
    multi_asset = "asset:uuid1|image/png|karte1.png|thumb1 ;; asset:uuid2|image/png|karte2.png|thumb2"
    formatted = format_digitalisate(multi_asset)
    assert formatted == "karte1.png, karte2.png"

def test_is_blocked():
    generator = FindbuchGenerator("Testarchiv", [])
    now = datetime.datetime.now()
    future_year = str(now.year + 10)
    past_year = str(now.year - 10)

    # Future date is blocked
    assert generator.is_blocked(f"31.12.{future_year}") is True
    assert generator.is_blocked(future_year) is True

    # Past date is not blocked
    assert generator.is_blocked(f"01.01.{past_year}") is False
    assert generator.is_blocked(past_year) is False

    # Empty / non-date strings
    assert generator.is_blocked("") is False
    assert generator.is_blocked("Keine Frist vorhanden") is False

def test_findbuch_pdf_structure():
    pdf = FindbuchPDF(archiv_name="Stadtarchiv Oestrich")
    assert pdf.archiv_name == "Stadtarchiv Oestrich"
    assert pdf.color_primary == (54, 124, 168)
    assert pdf.color_dark == (30, 41, 59)

    # Page 1 (Title page) does not have a running header
    pdf.add_page()
    assert pdf.page_no() == 1

    # Page 2 has a running header with page number
    pdf.add_page()
    assert pdf.page_no() == 2

def test_findbuch_generator_end_to_end():
    tree_data = [
        {
            "id": "root1",
            "label": "Bestand A - Verwaltung",
            "parent_id": None,
            "layoutFields": [
                {"id": "sig", "label": "Signatur"},
                {"id": "title", "label": "Titel"},
                {"id": "runtime", "label": "Laufzeit"},
                {"id": "schutz", "label": "Schutzfrist"}
            ],
            "records": [
                {
                    "sig": "A-001",
                    "title": "Ratsprotokolle 1920",
                    "runtime": "1920",
                    "schutz": "01.01.1950"
                },
                {
                    "sig": "A-002",
                    "title": "Vertrauliche Personalakte",
                    "runtime": "2020",
                    "schutz": f"31.12.{datetime.datetime.now().year + 15}"
                }
            ],
            "children": [
                {
                    "id": "sub1",
                    "label": "A1 - Finanzen und Steuern",
                    "parent_id": "root1",
                    "layoutFields": [
                        {"id": "sig", "label": "Signatur"},
                        {"id": "title", "label": "Titel"}
                    ],
                    "records": [
                        {
                            "sig": "A1-100",
                            "title": "Haushaltsplan der Gemeinde"
                        }
                    ],
                    "children": []
                }
            ]
        }
    ]

    # 1. Normal generation (hide_blocked=False)
    gen_normal = FindbuchGenerator("Stadtarchiv Oestrich", tree_data, hide_blocked=False)
    pdf_bytes = gen_normal.generate()
    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 1000
    assert pdf_bytes.startswith(b"%PDF")
    # Must have at least Title, TOC, and content pages
    assert gen_normal.pdf.page_no() >= 3

    # 2. Generation with hide_blocked=True
    gen_blocked = FindbuchGenerator("Stadtarchiv Oestrich", tree_data, hide_blocked=True)
    pdf_blocked_bytes = gen_blocked.generate()
    assert isinstance(pdf_blocked_bytes, bytes)
    assert len(pdf_blocked_bytes) > 1000
