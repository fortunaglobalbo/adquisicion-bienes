import type { FixedModel } from '../docx/fixedModels';
import { extractJsonFromText } from '../ai/openCodeClient';

const record=(value:unknown):value is Record<string,any>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const invalid=()=>Error('La IA no entregó un documento válido. El borrador anterior se conserva.');
const numericFields=new Set(['numero','presupuesto','monto_verificado','presupuesto_usd','presupuesto_otro']);
type FixedResponse=Record<string,any>&{fields:Record<string,string>;items:Record<string,string>[]};
function fieldText(value:unknown,key:string):string|undefined {
  if(typeof value==='string')return value;
  if(Array.isArray(value)&&value.length&&value.every(line=>typeof line==='string'))return value.join('\n');
  if(numericFields.has(key)&&typeof value==='number'&&Number.isFinite(value))return String(value);
  return undefined;
}
function parseJson(value:string):unknown {
  try{return extractJsonFromText(value);}catch{return null;}
}

/** Balanced objects only: never close a truncated response or guess an unfinished string. */
function completeObjects(raw:string):string[] {
  const objects:string[]=[];
  let start=-1,depth=0,inString=false,escaped=false;
  for(let i=0;i<raw.length;i++){
    const character=raw[i];
    if(inString){if(escaped)escaped=false;else if(character==='\\')escaped=true;else if(character==='"')inString=false;continue;}
    if(character==='"'){inString=true;continue;}
    if(character==='{'){if(!depth)start=i;depth++;}
    if(character==='}'&&depth){depth--;if(!depth){objects.push(raw.slice(start,i+1));start=-1;if(objects.length>8)throw Error('La IA entregó varias versiones distintas. El borrador anterior se conserva.');}}
  }
  if(depth||inString)throw Error('La respuesta de la IA está incompleta. El borrador anterior se conserva.');
  return objects;
}

/** Accept harmless envelopes while keeping the server's model, company and row facts authoritative. */
export function parseFixedDocumentResponse(raw:string,model:FixedModel,options:{authoritativeItems:boolean;allowMissingItems:boolean}):FixedResponse {
  if(!raw.trim()||raw.length>500000)throw invalid();
  const candidates:Record<string,any>[]=[];
  const visit=(value:unknown,depth=0)=>{
    if(depth>4||!record(value))return;
    const supplied=record(value.fields)?value.fields:value.fields===undefined?value:null;
    const fields=supplied?Object.fromEntries(model.fields.flatMap(field=>{
      const content=fieldText(supplied[field.key],field.key);
      return content===undefined?[]:[[field.key,content]];
    })):{};
    if(Object.values(fields).some(content=>content.trim()))candidates.push({...value,fields});
    for(const key of ['draft','result','data'])if(record(value[key]))visit(value[key],depth+1);
  };
  visit(parseJson(raw));
  for(const object of completeObjects(raw))visit(parseJson(object));
  const normalized:FixedResponse[]=candidates.map(candidate=>{
    let items:Record<string,string>[]=[];
    if(model.columns.length&&!options.authoritativeItems){
      if(candidate.items===undefined&&options.allowMissingItems)items=[];
      else {
        if(!Array.isArray(candidate.items))throw Error('La IA no entregó una tabla válida. El borrador anterior se conserva.');
        if(candidate.items.length>100)throw Error('Revisa la cantidad de ítems (máximo 100).');
        items=candidate.items.map((item:unknown)=>{
          if(!record(item))throw Error('La IA no entregó una tabla válida. El borrador anterior se conserva.');
          return Object.fromEntries(model.columns.map(column=>{
            const value=item[column.key];
            if(value===undefined||value===null)return [column.key,''];
            if(typeof value==='string')return [column.key,value];
            if(typeof value==='number'&&Number.isFinite(value))return [column.key,String(value)];
            throw Error('La IA no entregó una tabla válida. El borrador anterior se conserva.');
          }));
        });
      }
    }
    return {...candidate,fields:candidate.fields as Record<string,string>,items};
  });
  const versions=new Map<string,typeof normalized[number]>();
  for(const candidate of normalized){
    const fingerprint=JSON.stringify({fields:candidate.fields,items:candidate.items,sourceIds:candidate.sourceIds,sourceQuotes:candidate.sourceQuotes,proposals:candidate.proposals});
    versions.set(fingerprint,candidate);
  }
  if(versions.size>1)throw Error('La IA entregó varias versiones distintas del documento. El borrador anterior se conserva.');
  const result=Array.from(versions.values())[0];
  if(!result)throw invalid();
  return result;
}
