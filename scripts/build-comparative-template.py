"""Derive folder 3 from the retained CUADRO COMPARATIVO.docx, without rebuilding it.

Only the main document's purchase-specific text and the core title/description are
changed. Headers, footers, logo, styles, numbering, relationships and page geometry
remain the original package parts. Run with the bundled Python runtime.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path
from zipfile import ZipFile

from lxml import etree as ET

ROOT = Path(__file__).resolve().parents[1]
REFERENCE_SHA256 = "1687217db635f8e18b9f54d6cd05d35a9cc668019b6932e40424ddd2f6aaed2f"
W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
NS = {"w": W}

FIELDS = [
    ("fecha", "Fecha del informe"),
    ("numero", "Número / referencia del informe"),
    ("solicitud", "Número de solicitud S1"),
    ("objeto", "Proceso comparado"),
    ("destinatario", "Destinatario y cargo"),
    ("via", "Vía y cargo"),
    ("solicitante", "Responsable informante y cargo"),
    ("antecedentes", "Antecedentes"),
    ("recepcion", "Recepción de cotizaciones"),
    ("evaluacion", "Evaluación técnica y económica"),
    ("conclusiones", "Conclusiones"),
    ("recomendaciones", "Recomendaciones"),
]
COLUMNS = [
    ("numero", "N.º"),
    ("empresa", "Empresa"),
    ("cotizacion", "Cotización / evaluación"),
    ("precio", "Precio (Bs)"),
    ("respaldo", "Respaldo / actividad económica"),
]


def text(element):
    return "".join(element.xpath(".//w:t/text()", namespaces=NS))


def replace_paragraph(paragraph, value):
    """Retain the existing paragraph and run formatting; replace visible text only."""
    texts = paragraph.xpath(".//w:t", namespaces=NS)
    if not texts:
        run = ET.SubElement(paragraph, f"{{{W}}}r")
        texts = [ET.SubElement(run, f"{{{W}}}t")]
    texts[0].text = value
    texts[0].set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
    for node in texts[1:]:
        node.text = ""
    # The old sample's line breaks must not remain after one placeholder.
    for node in paragraph.xpath(".//w:br|.//w:tab", namespaces=NS):
        node.getparent().remove(node)


def build(source: Path, output: Path, catalog: Path | None):
    raw = source.read_bytes()
    if hashlib.sha256(raw).hexdigest() != REFERENCE_SHA256:
        raise ValueError("El Word de referencia cambió: vuelve a inspeccionarlo antes de crear la plantilla.")
    with ZipFile(source) as archive:
        originals = {name: archive.read(name) for name in archive.namelist()}
        info = archive.infolist()
    document = ET.fromstring(originals["word/document.xml"])
    body = document.find("w:body", NS)
    if body is None:
        raise ValueError("No se encontró el cuerpo del Word original.")
    tables = body.findall("w:tbl", NS)
    if len(tables) != 3 or len(tables[2].findall("w:tr", NS)) != 5:
        raise ValueError("La estructura del Word no coincide con el modelo inspeccionado.")
    source_section = ET.tostring(body.find("w:sectPr", NS))
    source_table_properties = [ET.tostring(table.find("w:tblPr", NS)) for table in tables]
    source_table_grids = [ET.tostring(table.find("w:tblGrid", NS)) for table in tables]
    source_supplier_header = ET.tostring(tables[2].findall("w:tr", NS)[0])
    source_titles = [ET.tostring(paragraph) for paragraph in body.findall("w:p", NS) if paragraph.find("w:pPr/w:pStyle", NS) is not None and paragraph.find("w:pPr/w:pStyle", NS).get(f"{{{W}}}val") in {"EvaluationTitle", "EvaluationForm", "EvaluationSection", "EvaluationRule"}]

    date_cells = tables[0].findall("w:tr", NS)[0].findall("w:tc", NS)
    replace_paragraph(date_cells[0].find("w:p", NS), "Oruro, {{fecha}}")
    replace_paragraph(date_cells[1].find("w:p", NS), "INF.DE ORURO N.º {{numero}}")

    references = tables[1].findall("w:tr", NS)
    for row, key in zip(references[:3], ["destinatario", "via", "solicitante"]):
        paragraphs = row.findall("w:tc", NS)[1].findall("w:p", NS)
        replace_paragraph(paragraphs[0], "{{" + key + "_nombre}}")
        replace_paragraph(paragraphs[1], "{{" + key + "_cargo}}")
    process = references[3].findall("w:tc", NS)[1].findall("w:p", NS)[0]
    replace_paragraph(process, 'REMISIÓN DE INFORME TÉCNICO DE EVALUACIÓN DE COTIZACIONES Y SOLICITUD DE ADJUDICACIÓN - PROCESO "{{objeto}}" (Solicitud No. {{solicitud}})')

    # Stable direct-body positions were inventoried before authoring. Preserve each
    # section's real paragraph formatting; no sample law, result or vendor survives.
    original_blocks = list(body)
    for position, key in [(7, "antecedentes"), (11, "recepcion"), (13, "evaluacion"), (16, "conclusiones"), (18, "recomendaciones")]:
        paragraph = original_blocks[position]
        if paragraph.tag != f"{{{W}}}p":
            raise ValueError("Cambió la posición de una sección del modelo original.")
        replace_paragraph(paragraph, "{{" + key + "}}")
    # These are the example's second normative paragraph and a stray full stop,
    # not furniture or a reusable section. A single dynamic antecedents slot replaces them.
    for position in [8, 9]:
        body.remove(original_blocks[position])

    supplier_rows = tables[2].findall("w:tr", NS)
    for row in supplier_rows[2:]:
        tables[2].remove(row)
    for cell, (key, _label) in zip(supplier_rows[1].findall("w:tc", NS), COLUMNS):
        paragraphs = cell.findall("w:p", NS)
        replace_paragraph(paragraphs[0], "{{items." + key + "}}")
        for paragraph in paragraphs[1:]:
            replace_paragraph(paragraph, "")

    serialized = ET.tostring(document, xml_declaration=True, encoding="UTF-8", standalone=True)
    visible = text(document)
    forbidden = ["AIRES ACONDICIONADOS", "KAMOWI", "IMAN IMPORT", "SIAC BOLIVIA", "CLIMAZONE", "143.971", "3ra Versión", "26/04/2023", "DESCALIFICADO", "CUMPLE Y HABILITADO", "MAMANI", "TATIANA", "TORRICO"]
    if any(value in visible for value in forbidden):
        raise ValueError("La plantilla todavía contiene datos del ejemplo original.")
    expected = {"{{" + key + "}}" for key, _ in FIELDS if key not in {"destinatario", "via", "solicitante"}}
    expected.update("{{" + key + "_" + part + "}}" for key in ["destinatario", "via", "solicitante"] for part in ["nombre", "cargo"])
    expected.update("{{items." + key + "}}" for key, _ in COLUMNS)
    if set(re.findall(r"\{\{[^}]+\}\}", visible)) != expected:
        raise ValueError("Los campos de la plantilla no coinciden con el catálogo.")

    updated = dict(originals)
    updated["word/document.xml"] = serialized
    core = ET.fromstring(originals["docProps/core.xml"])
    for tag, value in [
        ("{http://purl.org/dc/elements/1.1/}title", "Cuadro comparativo"),
        ("{http://purl.org/dc/elements/1.1/}description", "Modelo institucional derivado del Word aportado; los datos de cada proceso se completan por separado."),
        ("{http://schemas.openxmlformats.org/package/2006/metadata/core-properties}lastModifiedBy", "ENDE Deoruro S.A."),
    ]:
        element = core.find(tag)
        if element is not None:
            element.text = value
    updated["docProps/core.xml"] = ET.tostring(core, xml_declaration=True, encoding="UTF-8", standalone=True)
    output.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(output, "w") as archive:
        for part in info:
            archive.writestr(part, updated[part.filename])
    # Preserve-only package comparison is an executable authoring gate.
    with ZipFile(output) as archive:
        for name, content in originals.items():
            if name not in {"word/document.xml", "docProps/core.xml"}:
                assert archive.read(name) == content, name
        final_document = ET.fromstring(archive.read("word/document.xml"))
        assert ET.tostring(final_document.find("w:body/w:sectPr", NS)) == source_section
        final_tables = final_document.findall("w:body/w:tbl", NS)
        assert [ET.tostring(table.find("w:tblPr", NS)) for table in final_tables] == source_table_properties
        assert [ET.tostring(table.find("w:tblGrid", NS)) for table in final_tables] == source_table_grids
        assert ET.tostring(final_tables[2].findall("w:tr", NS)[0]) == source_supplier_header
        final_titles = [ET.tostring(paragraph) for paragraph in final_document.findall("w:body/w:p", NS) if paragraph.find("w:pPr/w:pStyle", NS) is not None and paragraph.find("w:pPr/w:pStyle", NS).get(f"{{{W}}}val") in {"EvaluationTitle", "EvaluationForm", "EvaluationSection", "EvaluationRule"}]
        assert final_titles == source_titles
    assert hashlib.sha256(source.read_bytes()).hexdigest() == REFERENCE_SHA256
    if catalog:
        entries = json.loads(catalog.read_text(encoding="utf-8"))
        entry = next(entry for entry in entries if entry["number"] == 3)
        entry.update(title="Cuadro comparativo", version="2026-10-20.1", file="03.docx",
                     fields=[{"key": key, "label": label, "normative": False, "hint": ""} for key, label in FIELDS],
                     columns=[{"key": key, "label": label} for key, label in COLUMNS],
                     source="CUADRO COMPARATIVO.docx aportado por el usuario. Se conservan su encabezado, logotipo, formato A6-N014 y estructura; los datos del ejemplo se sustituyen por campos editables.",
                     sha256=hashlib.sha256(output.read_bytes()).hexdigest())
        catalog.write_text(json.dumps(entries, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("PASS plantilla 3: OOXML del original, encabezado/logotipo/pie/estilos/relaciones intactos, 12 campos y 5 columnas sin datos de ejemplo.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=Path.home() / "Downloads" / "CUADRO COMPARATIVO.docx")
    parser.add_argument("--output", type=Path, default=ROOT / "templates" / "ende" / "03.docx")
    parser.add_argument("--catalog", type=Path, default=ROOT / "templates" / "ende" / "catalog.json")
    parser.add_argument("--no-catalog", action="store_true")
    args = parser.parse_args()
    build(args.source.resolve(), args.output.resolve(), None if args.no_catalog else args.catalog.resolve())
