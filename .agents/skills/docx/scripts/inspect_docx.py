import os
import sys
import re
import json
from docx import Document

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

def inspect_docx(docx_path: str) -> dict:
    if not os.path.exists(docx_path):
        raise FileNotFoundError(f"Archivo no encontrado: {docx_path}")

    doc = Document(docx_path)
    
    paragraphs_info = []
    blank_pattern = re.compile(r'(__{2,}|\[[\w\s\.\,\-]+\]|\.{3,})')

    for idx, p in enumerate(doc.paragraphs):
        text = p.text.strip()
        if not text:
            continue
        
        matches = blank_pattern.findall(text)
        has_colon_prompt = ":" in text and (len(text.split(":", 1)[1].strip()) == 0 or bool(matches))
        
        paragraphs_info.append({
            "index": idx,
            "text": text,
            "style": p.style.name if p.style else None,
            "placeholders": matches,
            "is_fillable": bool(matches) or has_colon_prompt
        })

    tables_info = []
    for t_idx, table in enumerate(doc.tables):
        rows_data = []
        for r in table.rows:
            row_cells = [cell.text.strip().replace('\n', ' ') for cell in r.cells]
            rows_data.append(row_cells)
        
        headers = rows_data[0] if rows_data else []
        tables_info.append({
            "table_index": t_idx,
            "total_rows": len(table.rows),
            "total_columns": len(table.columns),
            "headers": headers,
            "sample_first_row": rows_data[1] if len(rows_data) > 1 else []
        })

    return {
        "file": os.path.basename(docx_path),
        "total_paragraphs": len(doc.paragraphs),
        "fillable_paragraphs_count": sum(1 for p in paragraphs_info if p["is_fillable"]),
        "paragraphs": paragraphs_info,
        "tables": tables_info
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python inspect_docx.py <archivo.docx>")
        sys.exit(1)
    
    res = inspect_docx(sys.argv[1])
    print(json.dumps(res, indent=2, ensure_ascii=False))
