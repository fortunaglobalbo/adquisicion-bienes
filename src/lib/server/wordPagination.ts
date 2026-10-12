import JSZip from 'jszip';
import {DOMParser, XMLSerializer} from '@xmldom/xmldom';

// Keep numbered TDR headings with their first paragraph; retain every template style/resource.
export async function keepTdrHeadingsWithBody(buffer:Buffer):Promise<Buffer> {
  const zip=await JSZip.loadAsync(buffer);
  const file=zip.file('word/document.xml');
  if(!file)return buffer;
  const xml=new DOMParser().parseFromString(await file.async('string'),'text/xml');
  const ns='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const paragraphs=xml.getElementsByTagNameNS(ns,'p');
  for(let i=0;i<paragraphs.length;i++){
    const paragraph=paragraphs.item(i)!;
    const texts=paragraph.getElementsByTagNameNS(ns,'t');let label='';
    for(let j=0;j<texts.length;j++)label+=texts.item(j)?.textContent||'';
    if(!/^(?:[1-9]|1[0-4])\.\s+[A-ZÁÉÍÓÚÑ /]+$/.test(label.trim()))continue;
    let properties=paragraph.getElementsByTagNameNS(ns,'pPr').item(0);
    if(!properties){properties=xml.createElementNS(ns,'w:pPr');paragraph.insertBefore(properties,paragraph.firstChild);}
    let keep=properties.getElementsByTagNameNS(ns,'keepNext').item(0);
    if(!keep){keep=xml.createElementNS(ns,'w:keepNext');properties.appendChild(keep);}
    keep.setAttributeNS(ns,'w:val','1');
  }
  zip.file('word/document.xml',new XMLSerializer().serializeToString(xml));
  return zip.generateAsync({type:'nodebuffer'});
}
