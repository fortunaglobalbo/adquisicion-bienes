"""Build folder 6 from the user-supplied evaluation report; retain no sample purchase data."""
from pathlib import Path
from docx import Document
from docx.shared import Cm, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.style import WD_STYLE_TYPE
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
import json, hashlib

ROOT = Path(__file__).resolve().parents[1]

def build_evaluation_model():
    d = Document()
    sec = d.sections[0]
    sec.page_width, sec.page_height = Cm(21), Cm(29.7)
    sec.top_margin, sec.bottom_margin = Cm(3.9), Cm(2)
    sec.left_margin, sec.right_margin = Cm(2.75), Cm(2.05)
    sec.header_distance = Cm(1.4)
    normal = d.styles['Normal']
    normal.font.name, normal.font.size = 'Arial', Pt(11)
    normal.paragraph_format.space_after = Pt(7)
    normal.paragraph_format.widow_control = True
    # Repeat the institutional logo on every printed page, as in the reference.
    sec.header.paragraphs[0].add_run().add_picture(str(ROOT/'public/logo-ende-deoruro.png'),width=Cm(3.7))
    for name in ['Evaluation Title','Evaluation Form','Evaluation Name','Evaluation Role','Evaluation Process','Evaluation Rule','Evaluation Section']:
        d.styles.add_style(name,WD_STYLE_TYPE.PARAGRAPH).base_style=normal
    for name in ['Evaluation Name','Evaluation Process','Evaluation Section']:
        d.styles[name].font.bold=True
    d.styles['Evaluation Role'].font.bold=True
    d.styles['Evaluation Role'].font.color.rgb=RGBColor.from_string('808080')
    d.styles['Evaluation Role'].paragraph_format.space_before=Pt(10)
    title = d.add_paragraph('INFORME DE CONFORMIDAD\n(CONTRATACIONES)',style='Evaluation Title')
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title.runs[0].bold = True
    title.runs[0].font.size = Pt(11)
    title.paragraph_format.space_after=Pt(0)
    title.paragraph_format.keep_with_next = True
    form=d.add_paragraph('FORMULARIO A6-N014',style='Evaluation Form')
    form.alignment=WD_ALIGN_PARAGRAPH.CENTER
    form.paragraph_format.space_after=Pt(16)
    form.paragraph_format.keep_with_next=True
    band = d.add_table(rows=1, cols=2)
    for c,text in zip(band.rows[0].cells,['Oruro, {{fecha}}','INF.DE ORURO N.º {{numero}}']):
        c.text = text
        shade = OxmlElement('w:shd'); shade.set(qn('w:fill'),'EEEEEE'); c._tc.get_or_add_tcPr().append(shade)
        c.paragraphs[0].runs[0].bold = True
        c.paragraphs[0].paragraph_format.space_after=Pt(0)
    band.rows[0].cells[1].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.RIGHT
    d.add_paragraph('')
    references=d.add_table(rows=4,cols=2);references.autofit=False
    for j,width in enumerate([2.3,13.9]):
        references.columns[j].width=Cm(width)
        for row in references.rows:row.cells[j].width=Cm(width)
    for row,(label,key) in zip(references.rows,[('A:','destinatario'),('VIA:','via'),('De:','solicitante')]):
        row.cells[0].text=label
        p=row.cells[1].paragraphs[0];p.style=d.styles['Evaluation Name'];p.add_run('{{'+key+'_nombre}}')
        p.paragraph_format.space_after=Pt(0);p.paragraph_format.keep_with_next=True
        p=row.cells[1].add_paragraph('{{'+key+'_cargo}}',style='Evaluation Role')
        p.paragraph_format.space_after=Pt(0)
    process=references.rows[3]
    process.cells[0].text='PROCESO:'
    process.cells[0].paragraphs[0].runs[0].font.size=Pt(10)
    p=process.cells[1].paragraphs[0];p.style=d.styles['Evaluation Process']
    p.add_run('REMISIÓN DE INFORME TÉCNICO DE EVALUACIÓN DE COTIZACIONES Y SOLICITUD DE ADJUDICACIÓN - PROCESO "{{objeto}}" (Solicitud No. {{solicitud}})')
    p.alignment=WD_ALIGN_PARAGRAPH.JUSTIFY;p.paragraph_format.space_before=Pt(14);p.paragraph_format.space_after=Pt(0)
    process.cells[0].paragraphs[0].paragraph_format.space_before=Pt(14)
    p=process.cells[1].add_paragraph('INFORME TÉCNICO DE EVALUACIÓN DE OFERTAS Y CUADRO COMPARATIVO',style='Evaluation Process')
    p.alignment=WD_ALIGN_PARAGRAPH.JUSTIFY
    for row in references.rows:
        cant_split=OxmlElement('w:cantSplit');row._tr.get_or_add_trPr().append(cant_split)
        # Leave the label enough room to keep PROCESO on one line, as in the reference.
        margins=OxmlElement('w:tcMar');right=OxmlElement('w:right')
        right.set(qn('w:w'),'0');right.set(qn('w:type'),'dxa');margins.append(right)
        row.cells[0]._tc.get_or_add_tcPr().append(margins)
    rule=d.add_paragraph(style='Evaluation Rule')
    borders=OxmlElement('w:pBdr');bottom=OxmlElement('w:bottom')
    for k,v in [('val','double'),('sz','8'),('color','000000')]:bottom.set(qn('w:'+k),v)
    borders.append(bottom);rule._p.get_or_add_pPr().append(borders)
    def section(title,key):
        p=d.add_paragraph(title,style='Evaluation Section');p.runs[0].bold=True;p.paragraph_format.keep_with_next=True
        p.paragraph_format.space_before=Pt(10)
        d.add_paragraph('{{'+key+'}}')
    section('1. ANTECEDENTES','antecedentes')
    section('2. RECEPCIÓN DE COTIZACIONES','recepcion')
    section('3. EVALUACIÓN TÉCNICA Y ECONÓMICA','evaluacion')
    columns=[('numero','N.º'),('empresa','Empresa'),('cotizacion','Cotización / evaluación'),('precio','Precio (Bs)'),('respaldo','Respaldo / actividad económica')]
    table=d.add_table(rows=2, cols=5);table.style='Table Grid';table.autofit=False
    for j,((key,label),width) in enumerate(zip(columns,[1,2.6,5,2.1,5.5])):
        table.columns[j].width=Cm(width)
        for row in table.rows:row.cells[j].width=Cm(width)
        table.rows[0].cells[j].text=label
        table.rows[0].cells[j].paragraphs[0].runs[0].bold=True
        table.rows[1].cells[j].text='{{items.'+key+'}}'
    header=OxmlElement('w:tblHeader');table.rows[0]._tr.get_or_add_trPr().append(header)
    for cell in table.rows[0].cells:
        shade=OxmlElement('w:shd');shade.set(qn('w:fill'),'F3F4E5');cell._tc.get_or_add_tcPr().append(shade)
    for row in table.rows:
        for cell in row.cells:
            for p in cell.paragraphs:
                p.paragraph_format.space_after=Pt(4)
                for r in p.runs:r.font.size=Pt(9)
    section('4. CONCLUSIONES','conclusiones')
    section('5. RECOMENDACIONES','recomendaciones')
    d.add_paragraph('Es cuanto se informa para los fines consiguientes.')
    d.add_paragraph('')
    for text in ['____________________________','{{solicitante}}','Firma y sello']:
        signature=d.add_paragraph(text)
        signature.paragraph_format.keep_with_next=text!='Firma y sello'
        signature.paragraph_format.keep_together=True
        signature.paragraph_format.space_after=Pt(3)
    footer=sec.footer.paragraphs[0];footer.alignment=WD_ALIGN_PARAGRAPH.RIGHT
    footer.add_run('Página ')
    for instr,suffix in [('PAGE',' de '),('NUMPAGES','')]:
        f=OxmlElement('w:fldSimple');f.set(qn('w:instr'),instr);footer._p.append(f);footer.add_run(suffix)
    fields=[{'key':key,'label':label,'normative':False,'hint':''} for key,label in [
        ('fecha','Fecha del informe'),('numero','Número / referencia del informe'),('destinatario','Destinatario y cargo'),('via','Vía y cargo'),
        ('solicitante','Responsable informante y cargo'),('objeto','Proceso evaluado'),('solicitud','Número de solicitud S1'),
        ('antecedentes','Antecedentes'),('recepcion','Recepción de cotizaciones'),('evaluacion','Evaluación técnica y económica'),('conclusiones','Conclusiones'),('recomendaciones','Recomendaciones')]]
    d.core_properties.author='ENDE Deoruro S.A.'
    d.core_properties.title='Informe técnico de evaluación'
    d.core_properties.comments='Modelo reconstruido del ejemplo aportado. No acredita aprobación ni conserva firmas.'
    return d,fields,[{'key':key,'label':label} for key,label in columns]

if __name__=='__main__':
    out=ROOT/'templates/ende'
    d,fields,columns=build_evaluation_model();d.save(out/'06.docx')
    catalog=json.loads((out/'catalog.json').read_text(encoding='utf-8'))
    entry=next(x for x in catalog if x['number']==6)
    entry.update(title='Informe técnico de evaluación',version='2026-09-25.2',fields=fields,columns=columns,
                 source='Ejemplo aportado: PROCESO ADQUISICIÓN DE CORREAS DE SUJECIÓN Y AMORTIGUADOR DE IMPACTO (PDF). Se conserva el encabezado institucional INFORME DE CONFORMIDAD (CONTRATACIONES), FORMULARIO A6-N014, por indicación del usuario.',
                 sha256=hashlib.sha256((out/'06.docx').read_bytes()).hexdigest())
    (out/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('Modelo 6 preparado: informe técnico de evaluación.')
