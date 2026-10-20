import JSZip from 'jszip';
import {DOMParser, XMLSerializer} from '@xmldom/xmldom';
import {enableFieldUpdatesOnOpen, invalidatePaginationFields, WORD_NS} from './wordFields';
import {addTdrTableOfContents} from './tdrTableOfContents';

// Keep numbered TDR headings with their first paragraph; retain every template style/resource.
export async function keepTdrHeadingsWithBody(buffer:Buffer):Promise<Buffer> {
  const zip=await JSZip.loadAsync(buffer);
  const file=zip.file('word/document.xml');
  if(!file)return buffer;
  const xml=new DOMParser().parseFromString(await file.async('string'),'text/xml');
  const ns=WORD_NS;
  const paragraphs=xml.getElementsByTagNameNS(ns,'p');
  const bookmarks=Array.from(xml.getElementsByTagNameNS(ns,'bookmarkStart'));
  let nextBookmarkId=bookmarks.reduce((max,bookmark)=>Math.max(max,Number(bookmark.getAttributeNS(ns,'id')) || 0),0)+1;
  for(let i=0;i<paragraphs.length;i++){
    const paragraph=paragraphs.item(i)!;
    // An index entry is also numbered and uppercase, but it must not be kept
    // with the next entry or mistaken for the actual section heading.
    if(paragraph.getElementsByTagNameNS(ns,'fldSimple').length || paragraph.getElementsByTagNameNS(ns,'fldChar').length)continue;
    const texts=paragraph.getElementsByTagNameNS(ns,'t');let label='';
    for(let j=0;j<texts.length;j++)label+=texts.item(j)?.textContent||'';
    const heading=/^([1-9]|1[0-4])\.\s+[A-ZÁÉÍÓÚÑ /]+$/.exec(label.trim());
    if(!heading)continue;
    let properties=paragraph.getElementsByTagNameNS(ns,'pPr').item(0);
    if(!properties){properties=xml.createElementNS(ns,'w:pPr');paragraph.insertBefore(properties,paragraph.firstChild);}
    let keep=properties.getElementsByTagNameNS(ns,'keepNext').item(0);
    if(!keep){keep=xml.createElementNS(ns,'w:keepNext');properties.appendChild(keep);}
    keep.setAttributeNS(ns,'w:val','1');
    const name=`section_${heading[1]}`;
    let start=bookmarks.find(bookmark=>bookmark.getAttributeNS(ns,'name')===name);
    const id=start?.getAttributeNS(ns,'id') || String(nextBookmarkId++);
    let end=Array.from(xml.getElementsByTagNameNS(ns,'bookmarkEnd')).find(bookmark=>bookmark.getAttributeNS(ns,'id')===id);
    if(!start){start=xml.createElementNS(ns,'w:bookmarkStart');start.setAttributeNS(ns,'w:id',id);start.setAttributeNS(ns,'w:name',name);}
    if(!end){end=xml.createElementNS(ns,'w:bookmarkEnd');end.setAttributeNS(ns,'w:id',id);}
    // Anchor the beginning of the heading, rather than the old zero-width
    // position after its final run (which can fall on the next line/page).
    if(start!==properties.nextSibling)paragraph.insertBefore(start,properties.nextSibling);
    if(end!==paragraph.lastChild)paragraph.appendChild(end);
  }
  const stylesFile=zip.file('word/styles.xml');
  if(stylesFile){
    const styles=new DOMParser().parseFromString(await stylesFile.async('string'),'text/xml');
    if(addTdrTableOfContents(xml,styles))zip.file('word/styles.xml',new XMLSerializer().serializeToString(styles));
  }
  invalidatePaginationFields(xml);
  zip.file('word/document.xml',new XMLSerializer().serializeToString(xml));
  // Header PAGE/NUMPAGES caches become stale when body content or tables grow.
  for(const name of Object.keys(zip.files).filter(name=>/^word\/(?:header|footer)\d+\.xml$/.test(name))){
    const part=new DOMParser().parseFromString(await zip.file(name)!.async('string'),'text/xml');
    if(invalidatePaginationFields(part))zip.file(name,new XMLSerializer().serializeToString(part));
  }
  const settingsFile=zip.file('word/settings.xml');
  if(settingsFile){
    const settings=new DOMParser().parseFromString(await settingsFile.async('string'),'text/xml');
    enableFieldUpdatesOnOpen(settings);
    zip.file('word/settings.xml',new XMLSerializer().serializeToString(settings));
  }
  return zip.generateAsync({type:'nodebuffer'});
}
