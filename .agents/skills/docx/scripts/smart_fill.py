import os
import sys
import re
import json
import copy
from docx import Document
from docx.shared import Pt, RGBColor
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

def preserve_run_formatting(target_run, source_run):
    """Copia la fuente, tamaño, color y estilos de source_run a target_run."""
    if source_run.font.name:
        target_run.font.name = source_run.font.name
    if source_run.font.size:
        target_run.font.size = source_run.font.size
    if source_run.font.color and source_run.font.color.rgb:
        target_run.font.color.rgb = source_run.font.color.rgb
    target_run.bold = source_run.bold
    target_run.italic = source_run.italic
    target_run.underline = source_run.underline

def replace_text_in_paragraph(paragraph, old_text, new_text):
    """Reemplaza texto en un párrafo manteniendo los estilos de las runs."""
    full_text = paragraph.text
    if old_text not in full_text:
        return False
    
    # Si todo el párrafo coincide exactamente o contiene una sola run
    if len(paragraph.runs) == 1:
        run = paragraph.runs[0]
        run.text = run.text.replace(old_text, new_text)
        return True

    # Para párrafos con múltiples runs, encontrar dónde está el texto
    # Estrategia segura: actualizar las runs conservando la primera run de muestra
    template_run = paragraph.runs[0] if paragraph.runs else None
    new_full_text = full_text.replace(old_text, new_text)
    
    # Vaciar runs existentes
    p_element = paragraph._p
    for r in paragraph.runs:
        p_element.remove(r._r)
    
    # Crear nueva run con el formato original
    new_run = paragraph.add_run(new_full_text)
    if template_run:
        preserve_run_formatting(new_run, template_run)
    return True

def set_paragraph_content(paragraph, new_text):
    """Reemplaza el contenido completo de un párrafo preservando formato."""
    if not paragraph.runs:
        paragraph.add_run(new_text)
        return
    
    template_run = paragraph.runs[0]
    p_element = paragraph._p
    for r in paragraph.runs:
        p_element.remove(r._r)
    
    new_run = paragraph.add_run(new_text)
    preserve_run_formatting(new_run, template_run)

def fill_smart_docx(template_path: str, output_path: str, data: dict) -> dict:
    """
    Rellena inteligentemente cualquier documento Word (.docx):
    - Reemplazo de marcadores de posición (placeholders)
    - Actualización de secciones por encabezado
    - Inserción y actualización de tablas manteniendo bordes y estilos
    """
    if not os.path.exists(template_path):
        raise FileNotFoundError(f"Plantilla no encontrada: {template_path}")

    doc = Document(template_path)
    stats = {"replaced_placeholders": 0, "updated_sections": 0, "updated_tables": 0}

    # 1. Reemplazo de pares clave-valor directos (Placeholders y textos)
    replacements = data.get("replacements", {})
    if replacements:
        for p in doc.paragraphs:
            for old_val, new_val in replacements.items():
                if old_val in p.text:
                    if replace_text_in_paragraph(p, old_val, str(new_val)):
                        stats["replaced_placeholders"] += 1

        for table in doc.tables:
            for row in table.rows:
                for cell in row.cells:
                    for p in cell.paragraphs:
                        for old_val, new_val in replacements.items():
                            if old_val in p.text:
                                if replace_text_in_paragraph(p, old_val, str(new_val)):
                                    stats["replaced_placeholders"] += 1

    # 2. Actualización de Secciones por Título
    # Ejemplo: {"sections": {"ANTECEDENTES": "Nuevo texto de antecedentes...", "JUSTIFICACIÓN": "..."}}
    sections_data = data.get("sections", {})
    if sections_data:
        total_p = len(doc.paragraphs)
        for i, p in enumerate(doc.paragraphs):
            p_text = p.text.strip().upper()
            for sec_name, new_content in sections_data.items():
                sec_upper = sec_name.strip().upper()
                # Si este párrafo es el título de la sección
                if sec_upper in p_text and (len(p_text) - len(sec_upper) < 15):
                    # El siguiente párrafo no vacío es el contenido de la sección
                    for j in range(i + 1, min(i + 4, total_p)):
                        next_p = doc.paragraphs[j]
                        if next_p.text.strip():
                            set_paragraph_content(next_p, str(new_content))
                            stats["updated_sections"] += 1
                            break

    # 3. Relleno y ampliación de Tablas dinámicas
    # Ejemplo: {"tables": [{"table_index": 0, "rows": [...]}, ...]}
    tables_data = data.get("tables", [])
    for t_spec in tables_data:
        t_idx = t_spec.get("table_index", 0)
        if t_idx < len(doc.tables):
            table = doc.tables[t_idx]
            new_rows = t_spec.get("rows", [])
            replace_mode = t_spec.get("mode", "append") # "append" or "replace_from_row_1"
            
            if replace_mode == "replace_from_row_1" and len(table.rows) > 1:
                # Mantener cabecera (row 0), eliminar filas anteriores excepto una para clonar estilo
                sample_row = table.rows[1] if len(table.rows) > 1 else table.rows[0]
                # Inyectar nuevas filas
                for row_data in new_rows:
                    row = table.add_row()
                    for c_idx, val in enumerate(row_data):
                        if c_idx < len(row.cells):
                            row.cells[c_idx].text = str(val)
                stats["updated_tables"] += 1
            elif replace_mode == "direct_cells":
                # Asignación celda por celda: {"cells": [[r, c, "valor"], ...]}
                for r_idx, c_idx, val in t_spec.get("cells", []):
                    if r_idx < len(table.rows) and c_idx < len(table.rows[r_idx].cells):
                        table.rows[r_idx].cells[c_idx].text = str(val)
                stats["updated_tables"] += 1

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    doc.save(output_path)
    return {
        "status": "success",
        "output_path": output_path,
        "stats": stats
    }

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Uso: python smart_fill.py <plantilla.docx> <datos.json> <salida.docx>")
        sys.exit(1)
    
    tpl = sys.argv[1]
    with open(sys.argv[2], "r", encoding="utf-8") as f:
        d = json.load(f)
    out = sys.argv[3]
    
    res = fill_smart_docx(tpl, out, d)
    print(json.dumps(res, indent=2, ensure_ascii=False))
