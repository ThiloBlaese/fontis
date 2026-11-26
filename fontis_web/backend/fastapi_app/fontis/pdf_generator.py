import json
import datetime
import re
from fpdf import FPDF
from typing import List, Dict, Any

def format_digitalisate(val: str) -> str:
    if not isinstance(val, str) or not val.startswith("asset:"):
        return val
    parts = val[6:].split(";;")
    filenames = []
    for part in parts:
        part = part.strip()
        if not part:
            continue
        sub_parts = part.split("|")
        if len(sub_parts) > 2 and sub_parts[2].strip():
            filenames.append(sub_parts[2].strip())
        elif len(sub_parts) > 0 and sub_parts[0].strip():
            filenames.append(sub_parts[0].strip())
    return ", ".join(filenames)

def clean_pdf_text(text: str) -> str:
    if not text:
        return ""
    if not isinstance(text, str):
        text = str(text)
    replacements = {
        "\u2022": "-",      # Bullet point •
        "\u2013": "-",      # En-dash –
        "\u2014": "-",      # Em-dash —
        "\u2018": "'",      # Left single quote ‘
        "\u2019": "'",      # Right single quote ’
        "\u201a": "'",      # Single low-9 quote ‚
        "\u201c": '"',      # Left double quote “
        "\u201d": '"',      # Right double quote ”
        "\u201e": '"',      # Double low-9 quote „
        "\u00ab": '"',      # Left-pointing double angle quote «
        "\u00bb": '"',      # Right-pointing double angle quote »
        "\u20ac": "EUR",    # Euro symbol €
        "\u2026": "...",    # Ellipsis …
        "\u00a0": " ",      # Non-breaking space
    }
    for key, val in replacements.items():
        text = text.replace(key, val)
    try:
        return text.encode("latin-1", errors="replace").decode("latin-1")
    except Exception:
        return text

class FindbuchPDF(FPDF):
    def cell(self, *args, **kwargs):
        if "text" in kwargs:
            kwargs["text"] = clean_pdf_text(kwargs["text"])
        elif len(args) > 2:
            args = list(args)
            args[2] = clean_pdf_text(args[2])
            args = tuple(args)
        return super().cell(*args, **kwargs)

    def multi_cell(self, *args, **kwargs):
        if "text" in kwargs:
            kwargs["text"] = clean_pdf_text(kwargs["text"])
        elif len(args) > 2:
            args = list(args)
            args[2] = clean_pdf_text(args[2])
            args = tuple(args)
        return super().multi_cell(*args, **kwargs)

    def write(self, *args, **kwargs):
        if "text" in kwargs:
            kwargs["text"] = clean_pdf_text(kwargs["text"])
        elif len(args) > 1:
            args = list(args)
            args[1] = clean_pdf_text(args[1])
            args = tuple(args)
        return super().write(*args, **kwargs)

    def __init__(self, archiv_name="Archiv"):
        super().__init__()
        self.archiv_name = archiv_name
        self.set_title(f"Findbuch - {archiv_name}")
        self.set_author("Fontis Web")
        
        # Archival Corporate Design Palette (Fontis Blue, Slate & Gray)
        self.color_primary = (54, 124, 168)    # Fontis Web Blue #367CA8
        self.color_dark = (30, 41, 59)         # Anthrazit Slate-800 #1E293B
        self.color_gray = (100, 116, 139)      # Medium Gray Slate-500 #64748B
        self.color_light_gray = (248, 250, 252) # Light Surface Slate-50 #F8FAFC
        self.color_border = (226, 232, 240)    # Divider Border Slate-200 #E2E8F0
        
    def header(self):
        if self.page_no() > 1:
            self.set_font("helvetica", "I", 8)
            self.set_text_color(*self.color_gray)
            
            # Truncate archive name if too long for the header to prevent overlap with page number
            display_name = self.archiv_name
            if len(display_name) > 60:
                display_name = display_name[:57] + "..."
                
            self.cell(145, 8, f"Findbuch: {display_name}", border=0, align="L")
            self.cell(0, 8, f"Seite {self.page_no()}", border=0, align="R")
            
            # Refined accent line in Fontis Blue
            self.set_draw_color(*self.color_primary)
            self.set_line_width(0.3)
            self.line(10, 18, 200, 18)
            self.ln(12)

    def footer(self):
        # Footer is kept clean and distraction-free on content pages
        pass

class FindbuchGenerator:
    def __init__(self, archiv_name: str, tree_data: List[Dict[str, Any]], hide_blocked: bool = False):
        self.archiv_name = archiv_name
        self.tree_data = tree_data
        self.hide_blocked = hide_blocked
        self.pdf = FindbuchPDF(archiv_name)
        self.pdf.set_auto_page_break(auto=True, margin=15)
        self.node_pages = {} # Map node ID to page number
        self.reference_date = datetime.datetime.now()
        
    def is_blocked(self, text: str) -> bool:
        """Python implementation of identifyBlockingPeriod from validators.js"""
        if not text or not isinstance(text, str) or not text.strip():
            return False
            
        # Regex for dates: DD.MM.YYYY or YYYY
        date_regex = r"(?:\b\d{1,2}\s*\.\s*\d{1,2}\s*\.\s*\d{4}\b)|(?:\b\d{4}\b)"
        matches = re.findall(date_regex, text)
        
        if len(matches) != 1:
            return False
            
        match_str = matches[0].replace(" ", "")
        try:
            if "." in match_str:
                day, month, year = map(int, match_str.split("."))
                date_obj = datetime.datetime(year, month, day)
            else:
                year = int(match_str)
                if year < 1000 or year > 9999: return False
                date_obj = datetime.datetime(year, 1, 1)
                
            # Use tomorrow as cutoff
            cutoff = self.reference_date + datetime.timedelta(days=1)
            cutoff = cutoff.replace(hour=0, minute=0, second=0, microsecond=0)
            
            return date_obj >= cutoff
        except Exception:
            return False

    def generate(self) -> bytes:
        # Title Page
        self._add_title_page()
        
        # Pass 1: Dummy Content to get page numbers (including TOC pages)
        self._add_toc()
        self._add_content()
        
        # Pass 2: Re-generate with TOC
        final_node_pages = self.node_pages.copy()
        self.pdf = FindbuchPDF(self.archiv_name)
        self.pdf.set_auto_page_break(auto=True, margin=15)
        self.node_pages = final_node_pages
        
        self._add_title_page()
        self._add_toc()
        self._add_content()

        return bytes(self.pdf.output())

    def _add_title_page(self):
        self.pdf.add_page()
        self.pdf.ln(55)
        
        # Archive / Fond Title
        self.pdf.set_text_color(*self.pdf.color_dark)
        self.pdf.set_font("helvetica", "B", 24)
        self.pdf.multi_cell(0, 11, self.archiv_name, align="C")
        self.pdf.ln(6)
        
        # Elegant Fontis Blue Accent Line
        self.pdf.set_draw_color(*self.pdf.color_primary)
        self.pdf.set_line_width(0.8)
        self.pdf.line(70, self.pdf.get_y(), 140, self.pdf.get_y())
        self.pdf.ln(8)
        
        # Subtitle
        self.pdf.set_font("helvetica", "B", 14)
        self.pdf.set_text_color(*self.pdf.color_primary)
        self.pdf.cell(0, 10, "F I N D B U C H", align="C", ln=True)
        
        # Bottom imprint & metadata
        self.pdf.set_y(245)
        self.pdf.set_draw_color(*self.pdf.color_border)
        self.pdf.set_line_width(0.3)
        self.pdf.line(40, 243, 170, 243)
        
        self.pdf.set_text_color(*self.pdf.color_gray)
        self.pdf.set_font("helvetica", "", 10)
        date_str = datetime.datetime.now().strftime("%d.%m.%Y")
        self.pdf.cell(0, 6, f"Erstellt am {date_str}", align="C", ln=True)

    def _add_toc(self):
        self.pdf.add_page()
        self.pdf.set_text_color(*self.pdf.color_dark)
        self.pdf.set_font("helvetica", "B", 16)
        self.pdf.cell(0, 10, "Inhaltsverzeichnis", ln=True)
        self.pdf.ln(2)
        
        self.pdf.set_draw_color(*self.pdf.color_primary)
        self.pdf.set_line_width(0.6)
        self.pdf.line(self.pdf.get_x(), self.pdf.get_y(), self.pdf.get_x() + 30, self.pdf.get_y())
        self.pdf.ln(6)
        
        def render_toc_recursive(nodes, level=0):
            for node in nodes:
                is_top_level = (level == 0)
                font_weight = "B" if is_top_level else ""
                font_size = 10.5 if is_top_level else 9.5
                self.pdf.set_font("helvetica", font_weight, font_size)
                self.pdf.set_text_color(*self.pdf.color_dark)
                
                indent_str = "    " * level
                label = node.get("label", "")
                page_num = str(self.node_pages.get(node["id"], "-"))
                
                # Truncate label if excessively long
                max_label_len = 65 - (level * 4)
                display_label = label if len(label) <= max_label_len else label[:max_label_len - 3] + "..."
                left_text = f"{indent_str}{display_label}"
                
                left_w = self.pdf.get_string_width(left_text) + 2
                page_w = self.pdf.get_string_width(page_num) + 4
                total_content_w = 190 # Printable width (210 - 20)
                dots_w = max(5, total_content_w - left_w - page_w)
                
                # Calculate number of dots to fill the gap
                dot_sample_w = self.pdf.get_string_width(". ")
                num_dots = max(1, int(dots_w / dot_sample_w))
                dots_str = ". " * num_dots
                
                self.pdf.cell(left_w, 7, left_text, border=0)
                self.pdf.set_font("helvetica", "", 8)
                self.pdf.set_text_color(180, 190, 205)
                self.pdf.cell(dots_w, 7, dots_str, border=0, align="R")
                
                self.pdf.set_font("helvetica", font_weight, font_size)
                self.pdf.set_text_color(*self.pdf.color_dark)
                self.pdf.cell(page_w, 7, page_num, border=0, align="R", ln=True)
                
                if "children" in node and node["children"]:
                    render_toc_recursive(node["children"], level + 1)
        
        render_toc_recursive(self.tree_data)

    def _add_content(self):
        # Page break after TOC
        self.pdf.add_page()
        
        def render_nodes_recursive(nodes, level=0, breadcrumbs=None):
            if breadcrumbs is None:
                breadcrumbs = []
                
            for node in nodes:
                # Every classification node begins on its own fresh page!
                # If we're not at the very top of a blank page, add a page break.
                if self.pdf.get_y() > 30:
                    self.pdf.add_page()
                
                self.node_pages[node['id']] = self.pdf.page_no()

                # Breadcrumb / Hierarchy path
                if breadcrumbs:
                    self.pdf.set_font("helvetica", "I", 8)
                    self.pdf.set_text_color(*self.pdf.color_gray)
                    crumb_str = " > ".join(breadcrumbs)
                    if len(crumb_str) > 85:
                        crumb_str = "..." + crumb_str[-82:]
                    self.pdf.cell(0, 4, crumb_str, ln=True)
                    self.pdf.ln(1)

                # Node Title
                font_size = 16 if level == 0 else (14 if level == 1 else 12)
                self.pdf.set_font("helvetica", "B", font_size)
                self.pdf.set_text_color(*self.pdf.color_dark)
                self.pdf.multi_cell(0, 7, f"{node['label']}")
                
                # Accent Underline in Fontis Blue
                self.pdf.set_draw_color(*self.pdf.color_primary)
                self.pdf.set_line_width(0.5)
                line_w = 45 if level == 0 else (30 if level == 1 else 20)
                self.pdf.line(self.pdf.get_x(), self.pdf.get_y() + 1, self.pdf.get_x() + line_w, self.pdf.get_y() + 1)
                self.pdf.ln(6)
                
                records = node.get("records", [])
                layout_fields = node.get("layoutFields", [])
                
                valid_records = []
                for rec in records:
                    if any(str(v).strip() for v in rec.values() if v is not None):
                        valid_records.append(rec)
                
                if not valid_records:
                    if not node.get("children"):
                         self.pdf.set_font("helvetica", "I", 9.5)
                         self.pdf.set_text_color(*self.pdf.color_gray)
                         self.pdf.cell(0, 8, "Keine Datensätze in diesem Gliederungspunkt vorhanden.", ln=True)
                else:
                    # Pre-identify Schutzfrist/Sperrfrist field IDs
                    schutzfrist_field_ids = []
                    for field in layout_fields:
                        field_label = str(field.get("label") or "").upper()
                        field_id = str(field.get("id") or "").upper()
                        if "SCHUTZFRIST" in field_label or "SPERRFRIST" in field_label or "SCHUTZFRIST" in field_id or "SPERRFRIST" in field_id:
                            schutzfrist_field_ids.append(field.get("id"))

                    for i, rec in enumerate(valid_records):
                        # Determine if this specific record is blocked
                        record_is_blocked = False
                        if self.hide_blocked:
                            for fid in schutzfrist_field_ids:
                                value = rec.get(fid)
                                if value and self.is_blocked(str(value)):
                                    record_is_blocked = True
                                    break

                        with self.pdf.unbreakable() as pdf:
                            # Record Item Header / Index
                            pdf.set_font("helvetica", "B", 9)
                            pdf.set_text_color(*self.pdf.color_primary)
                            pdf.cell(0, 5, f"Nr. {i+1}", ln=True, align="R")
                            
                            if record_is_blocked:
                                pdf.set_font("helvetica", "I", 9)
                                pdf.set_text_color(*self.pdf.color_gray)
                                pdf.multi_cell(0, 5, "Dieser Eintrag ist aufgrund einer laufenden Schutzfrist für die Öffentlichkeit gesperrt.")
                            else:
                                for field in layout_fields:
                                    field_id = field.get("id")
                                    field_label = field.get("label", "Feld")
                                    value = rec.get(field_id)
                                    
                                    if value and str(value).strip():
                                        val_str = format_digitalisate(str(value))
                                        if not val_str:
                                            continue
                                        pdf.set_font("helvetica", "B", 8.5)
                                        pdf.set_text_color(*self.pdf.color_gray)
                                        pdf.write(4.5, f"{field_label}: ")
                                        pdf.set_text_color(*self.pdf.color_dark)
                                        pdf.set_font("helvetica", "", 9)
                                        pdf.multi_cell(0, 4.5, val_str)
                            
                            # Clean Record Divider
                            pdf.ln(2)
                            pdf.set_draw_color(*self.pdf.color_border)
                            pdf.set_line_width(0.2)
                            pdf.cell(0, 0, "", ln=True, border="T")
                            pdf.ln(2)

                if "children" in node and node["children"]:
                    next_breadcrumbs = breadcrumbs + [node.get("label", "")]
                    render_nodes_recursive(node["children"], level + 1, next_breadcrumbs)

        render_nodes_recursive(self.tree_data)
