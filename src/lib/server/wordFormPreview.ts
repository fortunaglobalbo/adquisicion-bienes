import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';

const ns='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const children=(e:Element,name:string)=>Array.from(e.childNodes).filter((n):n is Element=>n.nodeType===1&&(n as Element).localName===name);
const first=(e:Element|undefined,name:string)=>e?children(e,name)[0]:undefined;
const attr=(e:Element|undefined,name='val')=>e?.getAttributeNS(ns,name)||'';
const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const color=(s:string)=>/^[a-f0-9]{6}$/i.test(s)?s:'000000';
/** Preview S1's actual Word cells, including merges, colors and checkbox placement. */
export async function wordFormPreview(buffer:Buffer):Promise<string>{
  const zip=await JSZip.loadAsync(buffer);const content=await zip.file('word/document.xml')!.async('string');
  const xml=new DOMParser().parseFromString(content,'text/xml');
  const table=xml.getElementsByTagNameNS(ns,'tbl')[0];if(!table)throw Error('No se encontró el formulario Word.');
  const grid=children(first(table,'tblGrid')!,'gridCol').map(e=>Number(attr(e,'w'))||1);const total=grid.reduce((s,n)=>s+n,0);
  const rows=children(table,'tr');
  const matrix=rows.map(row=>{let column=0;return children(row,'tc').map(cell=>{const props=first(cell,'tcPr');const span=Number(attr(first(props,'gridSpan')))||1;const current={cell,props,column,span,merge:first(props,'vMerge')};column+=span;return current;});});
  const html=matrix.map((cells,r)=>`<tr style="height:${(Number(attr(first(first(rows[r],'trPr'),'trHeight')))||0)/20}pt">${cells.map(c=>{
    if(c.merge&&attr(c.merge)!=='restart')return '';
    let rowspan=1;if(c.merge)for(let i=r+1;i<matrix.length;i++){const next=matrix[i].find(n=>n.column===c.column);if(!next?.merge||attr(next.merge)==='restart')break;rowspan++;}
    const style=['padding:0 1.2pt;vertical-align:middle;overflow-wrap:normal'];
    const bottomProps=rowspan>1?matrix[r+rowspan-1].find(n=>n.column===c.column)?.props:c.props;
    for(const side of ['top','right','bottom','left']){
      const border=first(first(side==='bottom'?bottomProps:c.props,'tcBorders'),side);
      style.push(`border-${side}:${border&&!['nil','none',''].includes(attr(border))?`${(Number(attr(border,'sz'))||5)/8}pt solid #${color(attr(border,'color'))}`:'none'}`);
    }
    const fill=attr(first(c.props,'shd'),'fill');if(/^[a-f0-9]{6}$/i.test(fill))style.push(`background:#${fill}`);
    const paragraphs=children(c.cell,'p').map(p=>{
      const props=first(p,'pPr');const align=attr(first(props,'jc'));const runs=children(p,'r');
      const hasText=Array.from(p.getElementsByTagNameNS(ns,'t')).some(t=>!!t.textContent?.trim());
      const texts=runs.map(run=>{
        const rp=first(run,'rPr');const size=Number(attr(first(rp,'sz')))/2;const bold=first(rp,'b');
        const text=Array.from(run.childNodes).map(n=>n.nodeType===1?(n as Element).localName==='br'?'<br>':(n as Element).localName==='t'?escape(n.textContent||''):'':'').join('');
        return `<span style="font-size:${size||8}pt;color:#${color(attr(first(rp,'color')))};font-weight:${bold&&attr(bold)!=='0'?'bold':'normal'}">${text}</span>`;
      }).join('');
      return `<p style="margin:0;font-size:${hasText?'8pt':'1pt'};line-height:${hasText?'1.05':'1pt'};text-align:${['center','right'].includes(align)?align:'left'};white-space:pre-wrap">${hasText?texts:'&#8203;'}</p>`;
    }).join('');
    return `<td colspan="${c.span}" rowspan="${rowspan}" style="${style.join(';')}">${paragraphs}</td>`;
  }).join('')}</tr>`).join('');
  return `<table aria-label="Formulario S1 en Word" style="width:100%;table-layout:fixed;border-collapse:collapse;margin:0;font-family:Arial"><colgroup>${grid.map(w=>`<col style="width:${w/total*100}%">`).join('')}</colgroup><tbody>${html}</tbody></table>`;
}
