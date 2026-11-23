"""
tools/scripts/build_task_1_docx.py
Compile docs/tasks/task_1.md into formatted Word document docs/tasks/task_1.docx
- Body: Times New Roman, 13 pt, 1.5 line spacing
- Code blocks & inline code: Consolas
- Tables: styled header (#EAECEE), alternating row shading (#FBFBFC), cell padding
- Images: ![caption](path) embedded centered (6.0 in) with italic caption
- Page breaks: <!-- pagebreak --> or \\pagebreak
"""

import os
import re
import sys
import docx
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import qn, nsdecls


def set_cell_margins(cell, top=100, bottom=100, left=140, right=140):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement("w:tcMar")
    for m, val in [("top", top), ("bottom", bottom), ("left", left), ("right", right)]:
        node = OxmlElement(f"w:{m}")
        node.set(qn("w:w"), str(val))
        node.set(qn("w:type"), "dxa")
        tcMar.append(node)
    tcPr.append(tcMar)


def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)


def set_table_borders(table, color="B0B0B0", sz="4", val="single"):
    tblPr = table._tbl.tblPr
    borders = parse_xml(
        f'<w:tblBorders {nsdecls("w")}>'
        f'  <w:top w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'  <w:bottom w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'  <w:left w:val="none"/>'
        f'  <w:right w:val="none"/>'
        f'  <w:insideH w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'  <w:insideV w:val="none"/>'
        f"</w:tblBorders>"
    )
    tblPr.append(borders)


def add_formatted_runs(paragraph, text, base_size_pt=13, force_bold=False):
    parts = re.split(r"(\*\*.*?\*\*|\*[^*]+?\*|`[^`]+?`)", text)
    for part in parts:
        if not part:
            continue
        if part.startswith("**") and part.endswith("**"):
            r = paragraph.add_run(part[2:-2])
            r.bold = True
            r.font.name = "Times New Roman"
            r.font.size = Pt(base_size_pt)
        elif part.startswith("*") and part.endswith("*"):
            r = paragraph.add_run(part[1:-1])
            r.italic = True
            r.font.name = "Times New Roman"
            r.font.size = Pt(base_size_pt)
            if force_bold:
                r.bold = True
        elif part.startswith("`") and part.endswith("`"):
            r = paragraph.add_run(part[1:-1])
            r.font.name = "Consolas"
            r.font.size = Pt(max(9.5, base_size_pt - 2))
            r.font.color.rgb = RGBColor(0x80, 0x20, 0x20)
            if force_bold:
                r.bold = True
        else:
            r = paragraph.add_run(part)
            r.font.name = "Times New Roman"
            r.font.size = Pt(base_size_pt)
            if force_bold:
                r.bold = True


def resolve_image_path(raw_path: str, md_dir: str) -> str | None:
    cleaned = raw_path.strip().replace("\\", os.sep).replace("/", os.sep)
    candidates = [
        os.path.join(md_dir, cleaned),
        os.path.join(os.getcwd(), cleaned),
        cleaned,
    ]
    for c in candidates:
        if os.path.isfile(c):
            return c
    return None


def build_docx_from_markdown(md_file_path: str, output_docx_path: str):
    md_dir = os.path.dirname(os.path.abspath(md_file_path))
    with open(md_file_path, "r", encoding="utf-8") as f:
        md_text = f.read()

    doc = docx.Document()

    normal_style = doc.styles["Normal"]
    normal_style.font.name = "Times New Roman"
    normal_style.font.size = Pt(13)
    normal_style.font.color.rgb = RGBColor(0x22, 0x22, 0x22)
    normal_style.paragraph_format.line_spacing = 1.5
    normal_style.paragraph_format.space_after = Pt(4)
    normal_style.paragraph_format.space_before = Pt(0)

    for sec in doc.sections:
        sec.top_margin = Inches(0.95)
        sec.bottom_margin = Inches(0.95)
        sec.left_margin = Inches(1.0)
        sec.right_margin = Inches(0.95)

    lines = md_text.split("\n")
    i = 0
    in_code_block = False
    code_lines: list[str] = []

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        # Code block handling
        if stripped.startswith("```"):
            if in_code_block:
                p = doc.add_paragraph()
                p.paragraph_format.line_spacing = 1.15
                p.paragraph_format.space_before = Pt(4)
                p.paragraph_format.space_after = Pt(6)
                p.paragraph_format.left_indent = Inches(0.25)
                run = p.add_run("\n".join(code_lines))
                run.font.name = "Consolas"
                run.font.size = Pt(10)
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

        # Explicit page break
        if stripped in ("<!-- pagebreak -->", r"\pagebreak"):
            doc.add_page_break()
            i += 1
            continue

        # Image embed: ![caption](path)
        img_match = re.match(r"^!\[(.*?)\]\((.*?)\)$", stripped)
        if img_match:
            caption = img_match.group(1).strip()
            img_path = resolve_image_path(img_match.group(2), md_dir)
            if img_path:
                pic_p = doc.add_paragraph()
                pic_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                pic_p.paragraph_format.space_before = Pt(6)
                pic_p.paragraph_format.space_after = Pt(2)
                pic_p.add_run().add_picture(img_path, width=Inches(6.0))
                if caption:
                    cap_p = doc.add_paragraph()
                    cap_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                    cap_p.paragraph_format.line_spacing = 1.15
                    cap_p.paragraph_format.space_after = Pt(8)
                    cap_r = cap_p.add_run(caption)
                    cap_r.font.name = "Times New Roman"
                    cap_r.font.size = Pt(11)
                    cap_r.italic = True
                    cap_r.font.color.rgb = RGBColor(0x44, 0x44, 0x44)
            i += 1
            continue

        # Markdown Table handling
        if stripped.startswith("|") and "|" in stripped[1:]:
            table_lines = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                table_lines.append(lines[i].strip())
                i += 1

            parsed_rows = []
            for tline in table_lines:
                cells = [c.strip() for c in tline.strip("|").split("|")]
                if all(re.match(r"^:?-+:?$", c) for c in cells):
                    continue
                parsed_rows.append(cells)

            if parsed_rows:
                num_cols = max(len(r) for r in parsed_rows)
                tbl = doc.add_table(rows=len(parsed_rows), cols=num_cols)
                tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
                set_table_borders(tbl)

                for row_idx, rdata in enumerate(parsed_rows):
                    row = tbl.rows[row_idx]
                    is_header = row_idx == 0
                    for col_idx in range(num_cols):
                        cell = row.cells[col_idx]
                        val = rdata[col_idx] if col_idx < len(rdata) else ""
                        cell.text = ""
                        cp = cell.paragraphs[0]
                        cp.paragraph_format.line_spacing = 1.15
                        cp.paragraph_format.space_before = Pt(2)
                        cp.paragraph_format.space_after = Pt(2)

                        sub_lines = val.replace("<br/>", "\n").replace("<br>", "\n").split("\n")
                        for s_idx, s_line in enumerate(sub_lines):
                            if s_idx > 0:
                                cp = cell.add_paragraph()
                                cp.paragraph_format.line_spacing = 1.15
                                cp.paragraph_format.space_before = Pt(1)
                                cp.paragraph_format.space_after = Pt(2)
                            add_formatted_runs(
                                cp,
                                s_line,
                                base_size_pt=10.5 if not is_header else 11,
                                force_bold=is_header,
                            )

                        set_cell_margins(cell, top=90, bottom=90, left=120, right=120)
                        if is_header:
                            set_cell_background(cell, "EAECEE")
                        elif row_idx % 2 == 1:
                            set_cell_background(cell, "FBFBFC")

                doc.add_paragraph()
            continue

        # Blank lines & horizontal rules
        if not stripped or stripped == "---":
            i += 1
            continue

        # Headings
        if stripped.startswith("# "):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(14)
            p.paragraph_format.space_after = Pt(6)
            p.paragraph_format.line_spacing = 1.5
            run = p.add_run(stripped[2:])
            run.font.name = "Times New Roman"
            run.font.size = Pt(17)
            run.bold = True
            run.font.color.rgb = RGBColor(0x11, 0x11, 0x11)
            i += 1
            continue
        elif stripped.startswith("## "):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(12)
            p.paragraph_format.space_after = Pt(4)
            p.paragraph_format.line_spacing = 1.5
            run = p.add_run(stripped[3:])
            run.font.name = "Times New Roman"
            run.font.size = Pt(15)
            run.bold = True
            run.font.color.rgb = RGBColor(0x1B, 0x36, 0x5D)
            i += 1
            continue
        elif stripped.startswith("### "):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(10)
            p.paragraph_format.space_after = Pt(3)
            p.paragraph_format.line_spacing = 1.5
            run = p.add_run(stripped[4:])
            run.font.name = "Times New Roman"
            run.font.size = Pt(13.5)
            run.bold = True
            run.font.color.rgb = RGBColor(0x2B, 0x4C, 0x7E)
            i += 1
            continue
        elif stripped.startswith("#### "):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(8)
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.line_spacing = 1.5
            run = p.add_run(stripped[5:])
            run.font.name = "Times New Roman"
            run.font.size = Pt(13)
            run.bold = True
            i += 1
            continue

        # Blockquote / Callout
        if stripped.startswith("> "):
            callout_lines = [stripped[2:]]
            while i + 1 < len(lines) and lines[i + 1].strip().startswith(">"):
                i += 1
                callout_lines.append(lines[i].strip().lstrip("> "))
            p = doc.add_paragraph()
            p.paragraph_format.left_indent = Inches(0.3)
            p.paragraph_format.right_indent = Inches(0.3)
            p.paragraph_format.space_before = Pt(5)
            p.paragraph_format.space_after = Pt(5)
            p.paragraph_format.line_spacing = 1.35
            add_formatted_runs(p, " ".join(callout_lines), base_size_pt=12)
            for r in p.runs:
                r.italic = True
                r.font.color.rgb = RGBColor(0x44, 0x44, 0x44)
            i += 1
            continue

        # Bullet / Numbered list
        bullet_match = re.match(r"^(\s*)([-*]|\d+\.)\s+(.*)$", line)
        if bullet_match:
            indent_spaces = len(bullet_match.group(1))
            bullet_char = bullet_match.group(2)
            item_text = bullet_match.group(3)

            p = doc.add_paragraph()
            p.paragraph_format.line_spacing = 1.5
            p.paragraph_format.space_before = Pt(1)
            p.paragraph_format.space_after = Pt(2)

            if indent_spaces >= 4:
                p.paragraph_format.left_indent = Inches(0.55)
                bullet_prefix = "– "
            elif indent_spaces >= 2:
                p.paragraph_format.left_indent = Inches(0.38)
                bullet_prefix = "• "
            else:
                p.paragraph_format.left_indent = Inches(0.22)
                bullet_prefix = f"{bullet_char} " if bullet_char[0].isdigit() else "• "

            pr = p.add_run(bullet_prefix)
            pr.font.name = "Times New Roman"
            pr.font.size = Pt(13)
            add_formatted_runs(p, item_text, base_size_pt=13)
            i += 1
            continue

        # Standard paragraph
        p = doc.add_paragraph()
        p.paragraph_format.line_spacing = 1.5
        p.paragraph_format.space_before = Pt(2)
        p.paragraph_format.space_after = Pt(4)
        add_formatted_runs(p, line, base_size_pt=13)
        i += 1

    os.makedirs(os.path.dirname(os.path.abspath(output_docx_path)), exist_ok=True)
    doc.save(output_docx_path)
    print(f"Document successfully written to: {output_docx_path}")


if __name__ == "__main__":
    md_in = sys.argv[1] if len(sys.argv) > 1 else r"docs\tasks\task_1.md"
    docx_out = sys.argv[2] if len(sys.argv) > 2 else r"docs\tasks\task_1.docx"
    build_docx_from_markdown(md_in, docx_out)
