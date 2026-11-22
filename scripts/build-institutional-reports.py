"""Apply the November Word references to the institutional report templates."""
import argparse
import hashlib
import json
import re
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt

ROOT = Path(__file__).resolve().parents[1] / "templates" / "ende"


def replace(paragraph, value):
    if paragraph.runs:
        paragraph.runs[0].text = value
        for run in paragraph.runs[1:]:
            run.clear()
    else:
        paragraph.add_run(value)


def replace_cell(cell, value):
    replace(cell.paragraphs[0], value)
    for paragraph in cell.paragraphs[1:]:
        paragraph._element.getparent().remove(paragraph._element)


def remove(paragraph):
    paragraph._element.getparent().remove(paragraph._element)


def compact(paragraph):
    paragraph.paragraph_format.space_before = Pt(0)
    paragraph.paragraph_format.space_after = Pt(0)
    paragraph.paragraph_format.line_spacing = 1


def format_report(document):
    roots = [part.element for part in document.part.package.parts
             if hasattr(part, "element") and str(part.partname).startswith("/word/")]
    for root in roots:
        for fonts in root.iter(qn('w:rFonts')):
            fonts.attrib.clear()
            for script in ('ascii', 'hAnsi', 'eastAsia', 'cs'):
                fonts.set(qn(f'w:{script}'), 'Tahoma')
    document.styles['Normal'].font.name = 'Tahoma'
    for section in document.sections:
        footer = section.footer
        if any('PAGE' in p._p.xml for p in footer.paragraphs):
            continue
        page = footer.add_paragraph() if footer.paragraphs[0].text else footer.paragraphs[0]
        page.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        page.add_run('Página ')
        for instruction, suffix in [('PAGE', ' de '), ('NUMPAGES', '')]:
            field = OxmlElement('w:fldSimple')
            field.set(qn('w:instr'), instruction)
            page._p.append(field)
            page.add_run(suffix)
    # Remove the authorship and revision metadata of the attached example.
    props = document.core_properties
    props.author = 'ENDE Deoruro S.A.'
    for key in ('last_modified_by', 'comments', 'subject', 'keywords', 'identifier', 'description'):
        if hasattr(props, key):
            setattr(props, key, '')


def memo(source):
    document = Document(source)
    paragraphs = document.paragraphs
    header, footer = document.tables
    replace_cell(header.cell(0, 0), 'CENTRAL - PLANTA, {{fecha}}')
    replace_cell(header.cell(0, 1), '{{numero}}')
    replace_cell(header.cell(2, 0), 'DE: {{solicitante_nombre}}')
    replace_cell(header.cell(3, 0), 'A: {{destinatario_nombre}}')
    for row, key in [(2, 'solicitante'), (3, 'destinatario')]:
        name = header.cell(row, 0).paragraphs[0]
        role = header.cell(row, 0).add_paragraph('{{'+key+'_cargo}}', style=name.style)
        compact(name)
        compact(role)
    replace(paragraphs[5], 'VÍA: {{via_nombre}}')
    via_role = paragraphs[6]
    replace(via_role, '{{via_cargo}}')
    compact(paragraphs[5])
    compact(via_role)
    replace(paragraphs[7], 'ASUNTO: SOLICITUD DE INICIO DE PROCESO — {{objeto}}')
    replace(paragraphs[10], '{{cuerpo}}')
    replace(paragraphs[11], 'Para consideración de la autoridad competente se detallan los respaldos del expediente:')
    replace(paragraphs[12], '{{anexos}}')
    for paragraph in paragraphs[13:16]:
        remove(paragraph)
    replace_cell(footer.cell(0, 0), 'Cc. Arch. / Adj. Lo indicado')
    document.core_properties.title = 'Solicitud de inicio de proceso'
    return document


def technical_report(source):
    document = Document(source)
    paragraphs = document.paragraphs
    header, items = document.tables
    replace(paragraphs[0], 'INFORME TÉCNICO')
    replace_cell(header.cell(0, 0), 'CENTRAL - PLANTA, {{fecha}}')
    replace_cell(header.cell(0, 1), '{{numero}}')
    for row, label, key in [(1, 'DE', 'solicitante'), (2, 'A', 'destinatario')]:
        replace_cell(header.cell(row, 0), label+': {{'+key+'_nombre}}')
        name = header.cell(row, 0).paragraphs[0]
        role = header.cell(row, 0).add_paragraph('{{'+key+'_cargo}}', style=name.style)
        compact(name)
        compact(role)
    replace(paragraphs[3], 'ASUNTO: {{objeto}}')
    sections = {
        'ANTECEDENTES': 'antecedentes',
        'OBJETIVOS': 'objetivos',
        'JUSTIFICACIÓN TÉCNICA Y NORMATIVA': 'justificacion',
        'CONCLUSIONES Y RECOMENDACIONES': 'conclusiones',
    }
    active = None
    for paragraph in paragraphs[4:]:
        title = paragraph.text.strip()
        if title in sections:
            active = sections[title]
            continue
        if title == 'REQUERIMIENTO TÉCNICO SUGERIDO' or title == 'Atentamente,':
            active = None
            continue
        if active:
            if isinstance(active, str):
                replace(paragraph, '{{'+active+'}}')
                props = paragraph._element.get_or_add_pPr()
                numbering = props.find(qn('w:numPr'))
                if numbering is not None:
                    props.remove(numbering)
                active = True
            else:
                remove(paragraph)
    columns = [
        ('numero', 'N.º'), ('ubicacion', 'ÁREA / UBICACIÓN'),
        ('especificaciones', 'CARACTERÍSTICAS TÉCNICAS'),
        ('descripcion', 'BIEN O SERVICIO'), ('cantidad', 'CANTIDAD'),
        ('justificacion_operativa', 'JUSTIFICACIÓN OPERATIVA'),
    ]
    for cell, (_, label) in zip(items.rows[0].cells, columns):
        replace_cell(cell, label)
    for cell, (key, _) in zip(items.rows[1].cells, columns):
        replace_cell(cell, '{{items.'+key+'}}')
    for row in items.rows[2:]:
        items._tbl.remove(row._tr)
    document.core_properties.title = 'Informe técnico de justificación'
    return document, [{'key': key, 'label': label} for key, label in columns]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('memo', type=Path)
    parser.add_argument('report', type=Path)
    sources = parser.parse_args()
    catalog_path = ROOT / 'catalog.json'
    catalog = json.loads(catalog_path.read_text(encoding='utf-8'))
    report, columns = technical_report(sources.report)
    reports = {number: Document(ROOT / f'{number:02}.docx') for number in (3, 6, 7)}
    reports.update({5: memo(sources.memo), 9: report})
    for number in (3, 6):
        document = reports[number]
        style = document.styles['Evaluation Role']
        compact(style)
        for paragraph in document.tables[1]._tbl.iter(qn('w:p')):
            value = ''.join(paragraph.xpath('.//w:t/text()'))
            if re.fullmatch(r'\{\{(?:destinatario|via|solicitante)_(?:nombre|cargo)\}\}', value):
                from docx.text.paragraph import Paragraph
                compact(Paragraph(paragraph, document))
    catalog = [entry for entry in catalog if entry['number'] != 9]
    catalog.append({
        'number': 9, 'title': 'Informe técnico de justificación', 'file': '09.docx',
        'version': '2026-11-21.1', 'source': sources.report.name,
        'fields': [{'key': key, 'label': label, 'hint': '', 'normative': False} for key, label in [
            ('fecha', 'Fecha'), ('numero', 'Número / referencia del informe'),
            ('solicitante', 'Responsable informante y cargo'), ('destinatario', 'Destinatario y cargo'),
            ('objeto', 'Asunto'), ('antecedentes', 'Antecedentes'), ('objetivos', 'Objetivos'),
            ('justificacion', 'Justificación técnica y normativa'), ('conclusiones', 'Conclusiones y recomendaciones'),
        ]],
        'columns': columns,
    })
    for model in catalog:
        number = model['number']
        if number not in reports:
            continue
        document = reports[number]
        format_report(document)
        path = ROOT / model['file']
        document.save(path)
        model['sha256'] = hashlib.sha256(path.read_bytes()).hexdigest()
        if number == 5:
            model['source'] = sources.memo.name
    catalog_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')


if __name__ == '__main__':
    main()
