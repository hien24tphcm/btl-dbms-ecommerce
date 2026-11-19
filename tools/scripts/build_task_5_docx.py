import os
import re
import docx
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import qn, nsdecls

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{m}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_table_borders(table, color="D3D3D3", sz="4", val="single"):
    tblPr = table._tbl.tblPr
    borders = parse_xml(
        f'<w:tblBorders {nsdecls("w")}>'
        f'  <w:top w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'  <w:bottom w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'  <w:left w:val="none"/>'
        f'  <w:right w:val="none"/>'
        f'  <w:insideH w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'  <w:insideV w:val="none"/>'
        f'</w:tblBorders>'
    )
    tblPr.append(borders)

def build_docx_from_markdown(md_file_path, output_docx_path):
    with open(md_file_path, 'r', encoding='utf-8') as f:
        md_text = f.read()

    doc = docx.Document()

    # Set normal style
    normal_style = doc.styles['Normal']
    normal_style.font.name = 'Times New Roman'
    normal_style.font.size = Pt(13)
    normal_style.font.color.rgb = RGBColor(0x22, 0x22, 0x22)
    normal_style.paragraph_format.line_spacing = 1.5
    normal_style.paragraph_format.space_after = Pt(4)
    normal_style.paragraph_format.space_before = Pt(0)

    # Page Margins
    for sec in doc.sections:
        sec.top_margin = Inches(1.0)
        sec.bottom_margin = Inches(1.0)
        sec.left_margin = Inches(1.0)
        sec.right_margin = Inches(1.0)

    lines = md_text.split('\n')
    i = 0
    in_code_block = False
    code_lines = []

    while i < len(lines):
        line = lines[i]

        # Code block handling
        if line.strip().startswith('```'):
            if in_code_block:
                # Flush code block
                p = doc.add_paragraph()
                p.paragraph_format.line_spacing = 1.15
                p.paragraph_format.space_before = Pt(4)
                p.paragraph_format.space_after = Pt(6)
                p.paragraph_format.left_indent = Inches(0.25)
                run = p.add_run('\n'.join(code_lines))
                run.font.name = 'Consolas'
                run.font.size = Pt(10.5)
                run.font.color.rgb = RGBColor(0x1B, 0x2A, 0x4A)
                code_lines = []
                in_code_block = False
            else:
                in_code_block = True
                code_lines = []
            i += 1
            continue

        if in_code_block:
            code_lines.append(line)
            i += 1
            continue

        # Markdown Table handling
        if line.strip().startswith('|') and '|' in line.strip()[1:]:
            # Collect full table
            table_lines = []
            while i < len(lines) and lines[i].strip().startswith('|'):
                table_lines.append(lines[i].strip())
                i += 1
            
            # Parse table rows
            parsed_rows = []
            for tline in table_lines:
                # check if separator
                cells = [c.strip() for c in tline.strip('|').split('|')]
                if all(re.match(r'^:?-+:?$', c) for c in cells):
                    continue
                parsed_rows.append(cells)

            if parsed_rows:
                num_cols = max(len(r) for r in parsed_rows)
                tbl = doc.add_table(rows=len(parsed_rows), cols=num_cols)
                tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
                set_table_borders(tbl, color="B0B0B0", sz="4", val="single")

                for row_idx, rdata in enumerate(parsed_rows):
                    row = tbl.rows[row_idx]
                    is_header = (row_idx == 0)
                    for col_idx in range(num_cols):
                        cell = row.cells[col_idx]
                        val = rdata[col_idx] if col_idx < len(rdata) else ""
                        cell.text = ""
                        cp = cell.paragraphs[0]
                        cp.paragraph_format.line_spacing = 1.15
                        cp.paragraph_format.space_before = Pt(3)
                        cp.paragraph_format.space_after = Pt(3)
                        
                        # Handle <br> tags inside table cell
                        sub_lines = val.replace('<br/>', '\n').replace('<br>', '\n').split('\n')
                        for s_idx, s_line in enumerate(sub_lines):
                            if s_idx > 0:
                                cp = cell.add_paragraph()
                                cp.paragraph_format.line_spacing = 1.15
                                cp.paragraph_format.space_before = Pt(1)
                                cp.paragraph_format.space_after = Pt(2)
                            parts = re.split(r'(\*\*.*?\*\*)', s_line)
                            for part in parts:
                                if part.startswith('**') and part.endswith('**'):
                                    r = cp.add_run(part[2:-2])
                                    r.bold = True
                                else:
                                    r = cp.add_run(part)
                                r.font.name = 'Times New Roman'
                                r.font.size = Pt(10.5 if not is_header else 11)
                                if is_header:
                                    r.bold = True
                        
                        set_cell_margins(cell, top=120, bottom=120, left=150, right=150)
                        if is_header:
                            set_cell_background(cell, "EAECEE")
                        elif row_idx % 2 == 1:
                            set_cell_background(cell, "FBFBFC")

                doc.add_paragraph() # spacing after table
            continue

        # Blank lines & Horizontal rules
        stripped = line.strip()
        if not stripped or stripped == '---':
            i += 1
            continue

        # Headings
        if stripped.startswith('# '):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(14)
            p.paragraph_format.space_after = Pt(6)
            p.paragraph_format.line_spacing = 1.5
            run = p.add_run(stripped[2:])
            run.font.name = 'Times New Roman'
            run.font.size = Pt(18)
            run.bold = True
            run.font.color.rgb = RGBColor(0x11, 0x11, 0x11)
            i += 1
            continue
        elif stripped.startswith('## '):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(12)
            p.paragraph_format.space_after = Pt(4)
            p.paragraph_format.line_spacing = 1.5
            run = p.add_run(stripped[3:])
            run.font.name = 'Times New Roman'
            run.font.size = Pt(15)
            run.bold = True
            run.font.color.rgb = RGBColor(0x1B, 0x36, 0x5D)
            i += 1
            continue
        elif stripped.startswith('### '):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(10)
            p.paragraph_format.space_after = Pt(3)
            p.paragraph_format.line_spacing = 1.5
            run = p.add_run(stripped[4:])
            run.font.name = 'Times New Roman'
            run.font.size = Pt(13.5)
            run.bold = True
            run.font.color.rgb = RGBColor(0x2B, 0x4C, 0x7E)
            i += 1
            continue
        elif stripped.startswith('#### '):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(8)
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.line_spacing = 1.5
            run = p.add_run(stripped[5:])
            run.font.name = 'Times New Roman'
            run.font.size = Pt(13)
            run.bold = True
            i += 1
            continue

        # Blockquote / Alert callout
        if stripped.startswith('> '):
            callout_text = stripped[2:]
            # collect continuous blockquote lines
            while i + 1 < len(lines) and lines[i+1].strip().startswith('>'):
                i += 1
                callout_text += " " + lines[i].strip().lstrip('> ')
            p = doc.add_paragraph()
            p.paragraph_format.left_indent = Inches(0.3)
            p.paragraph_format.right_indent = Inches(0.3)
            p.paragraph_format.space_before = Pt(6)
            p.paragraph_format.space_after = Pt(6)
            p.paragraph_format.line_spacing = 1.3
            run = p.add_run("“ " + callout_text + " ”")
            run.font.name = 'Times New Roman'
            run.font.size = Pt(12)
            run.italic = True
            run.font.color.rgb = RGBColor(0x44, 0x44, 0x44)
            i += 1
            continue

        # Bullet list item
        bullet_match = re.match(r'^(\s*)([-*]|\d+\.)\s+(.*)$', line)
        if bullet_match:
            indent_spaces = len(bullet_match.group(1))
            bullet_char = bullet_match.group(2)
            item_text = bullet_match.group(3)

            p = doc.add_paragraph()
            p.paragraph_format.line_spacing = 1.5
            p.paragraph_format.space_before = Pt(1)
            p.paragraph_format.space_after = Pt(2)

            if indent_spaces >= 4:
                p.paragraph_format.left_indent = Inches(0.5)
                bullet_prefix = "– "
            elif indent_spaces >= 2:
                p.paragraph_format.left_indent = Inches(0.35)
                bullet_prefix = "• "
            else:
                p.paragraph_format.left_indent = Inches(0.2)
                bullet_prefix = f"{bullet_char} " if bullet_char[0].isdigit() else "• "

            p.add_run(bullet_prefix)
            
            # Format inline bold/italic
            parts = re.split(r'(\*\*.*?\*\*|\*.*?\*|`.*?`)', item_text)
            for part in parts:
                if part.startswith('**') and part.endswith('**'):
                    r = p.add_run(part[2:-2])
                    r.bold = True
                elif part.startswith('*') and part.endswith('*'):
                    r = p.add_run(part[1:-1])
                    r.italic = True
                elif part.startswith('`') and part.endswith('`'):
                    r = p.add_run(part[1:-1])
                    r.font.name = 'Consolas'
                    r.font.size = Pt(11)
                    r.font.color.rgb = RGBColor(0x80, 0x20, 0x20)
                else:
                    r = p.add_run(part)
                r.font.name = 'Times New Roman'
                if not (part.startswith('`') and part.endswith('`')):
                    r.font.size = Pt(13)
            i += 1
            continue

        # Standard Paragraph
        p = doc.add_paragraph()
        p.paragraph_format.line_spacing = 1.5
        p.paragraph_format.space_before = Pt(2)
        p.paragraph_format.space_after = Pt(4)
        
        parts = re.split(r'(\*\*.*?\*\*|\*.*?\*|`.*?`)', line)
        for part in parts:
            if part.startswith('**') and part.endswith('**'):
                r = p.add_run(part[2:-2])
                r.bold = True
            elif part.startswith('*') and part.endswith('*'):
                r = p.add_run(part[1:-1])
                r.italic = True
            elif part.startswith('`') and part.endswith('`'):
                r = p.add_run(part[1:-1])
                r.font.name = 'Consolas'
                r.font.size = Pt(11)
                r.font.color.rgb = RGBColor(0x80, 0x20, 0x20)
            else:
                r = p.add_run(part)
            r.font.name = 'Times New Roman'
            if not (part.startswith('`') and part.endswith('`')):
                r.font.size = Pt(13)

        i += 1

    try:
        doc.save(output_docx_path)
        print(f"Document successfully written to: {output_docx_path}")
    except PermissionError:
        import time
        # Try a few times in case file was briefly locked
        saved = False
        for attempt in range(3):
            time.sleep(1)
            try:
                doc.save(output_docx_path)
                print(f"Document successfully written to: {output_docx_path} (on retry {attempt+1})")
                saved = True
                break
            except PermissionError:
                pass
        if not saved:
            base, ext = os.path.splitext(output_docx_path)
            fallback_path = f"{base}_updated{ext}"
            doc.save(fallback_path)
            print(f"WARNING: '{output_docx_path}' is currently locked (e.g. open in Word). Saved to fallback: {fallback_path}")

if __name__ == "__main__":
    import sys
    md_in = sys.argv[1] if len(sys.argv) > 1 else r"docs\tasks\task_5_re.md"
    docx_out = sys.argv[2] if len(sys.argv) > 2 else r"docs\tasks\task_5_re.docx"
    build_docx_from_markdown(md_in, docx_out)
