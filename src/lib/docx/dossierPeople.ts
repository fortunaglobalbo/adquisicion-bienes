import type { Adquisicion } from '@/types';
import type { FixedDraft } from './fixedModels';
import { attachedTdr, coverPeople } from './tdrReference';
import { isInstitutionalRole, officialPeopleKeys } from './officialPeople';

type Person = { name: string; role: string };
const finance = 'SUPERINTENDENCIA DE ADMINISTRACIÓN & FINANZAS';
const manager = 'GERENTE GENERAL';
// Detect names inserted by older templates. They cannot designate an official.
const reportPeopleDefaults: Record<number,Record<string,string>> = {
  3: {destinatario:`Lic. MIGUEL ANGEL MAMANI CAMACHO\n${finance}`, via:`Lic. RAÚL ALBERTO TORRICO GÓMEZ\n${manager}`, solicitante:'TATIANA TORRES ANDRADE\nAPOYO A GERENCIA EN SEGURIDAD INDUSTRIAL'},
  6: {destinatario:`Lic. VICENTE PAUL VEGA RAMIREZ\n${finance}`, via:`Lic. RAÚL ALBERTO TORRICO GÓMEZ\n${manager}`, solicitante:'Ing. TATIANA TORRES ANDRADE\nSUPERVISOR SEGURIDAD INDUSTRIAL'},
};
const formRoles:Record<number,Record<string,string>> = {
  3:{destinatario:finance,via:manager},
  5:{destinatario:'SUPERINTENDENTE DE ADMINISTRACIÓN Y FINANZAS A.I.',via:'GERENTE GENERAL A.I.'},
  6:{destinatario:finance,via:manager},
  7:{destinatario:finance,via:manager},
  8:{destinatario:'SUPERINTENDENTE DE ADMINISTRACIÓN Y FINANZAS A.I.',solicitante:'SUPERVISOR DE SEGURIDAD INDUSTRIAL A.I.'},
  9:{destinatario:'GERENTE GENERAL A.I.'},
};
const normal = (value:string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' y ').replace(/[^a-z0-9]+/g,' ').trim();
const keyName = (name:string) => normal(name).replace(/^(?:(?:ing|lic|arq|dr|dra|tec|sr|sra|msc)\s+)+/,'');
const interim = /\b(?:a\s*i|interin[oa]|suplente)\s*$/;
const keyRole = (role:string) => normal(role).replace(interim,'').replace(/\bgerencia general\b/g,'gerente general')
  .replace(/\bsuperintendencia\b/g,'superintendente').replace(/\b(?:del?|en|a|la|el|y)\b/g,' ').replace(/\s+/g,' ').trim();
const usable = (v?:string) => v && !/pendiente|_{3}|por (?:identificar|confirmar)|sin (?:registrar|identificar|definir|confirmar)|no (?:consta|especificad[oa])|^\[?(?:nombre y apellidos?|vacante|no aplica)\]?$/i.test(v.trim()) ? v.trim() : '';
function parts(value?:string, separateRole?:string):Person {
  const text=(value || '').trim();
  const [head,...tail]=text.split(/\r?\n+|\s+[-–—]\s*|[-–—]\s+(?=[A-ZÁÉÍÓÚ])/);
  const role=usable(tail.join(' ')) || usable(separateRole);
  if (isInstitutionalRole(head)) return {name:'',role:role || usable(head).replace(/^cargo\s*:\s*/i,'')};
  return {name:usable(head),role};
}
function identityName(person:Person):boolean {
  return !!person.name && !isInstitutionalRole(person.name) && keyName(person.name).split(' ').length >= 2
    && !/\b(?:srl|sa|s a|empresa|proveedor|cotizante|pendiente|solicitante|autoridad|beneficiario)\b/.test(normal(person.name));
}
function unique(candidates:Person[]):Person | undefined {
  if (!candidates.length || new Set(candidates.map(p=>keyName(p.name))).size!==1) return;
  return candidates.find(p=>!!p.role) || candidates[0];
}
const attributes:Record<number,Record<string,[keyof Adquisicion,keyof Adquisicion]>>={
  1:{elaborado:['elaborado_por','elaborado_cargo'],revisado:['revisado_por','revisado_cargo'],aprobado:['aprobado_por','aprobado_cargo']},
  5:{destinatario:['solicitud_inicio_a_nombre','solicitud_inicio_a_cargo'],via:['solicitud_inicio_via_nombre','solicitud_inicio_via_cargo'],solicitante:['solicitud_inicio_de_nombre','solicitud_inicio_de_cargo']},
  7:{destinatario:['informe_conf_a_nombre','informe_conf_a_cargo'],via:['informe_conf_via_nombre','informe_conf_via_cargo'],solicitante:['informe_conf_de_nombre','informe_conf_de_cargo']},
  8:{destinatario:['memo_pago_a_nombre','memo_pago_a_cargo'],solicitante:['memo_pago_de_nombre','memo_pago_de_cargo']},
};
function identityDirectory(adq:Adquisicion, number:number, current:Record<string,string>) {
  const known:Person[]=[];
  const sources:Record<number,Record<string,Person>>={};
  const register=(model:number,key:string,p:Person,example=false) => {
    if (example || !identityName(p)) return;
    known.push(p);
    sources[model] ||= {}; sources[model][key]=p;
  };
  for(const [model,keys] of Object.entries(attributes)) for(const [key,[name,role]] of Object.entries(keys)) {
    register(+model,key,parts(String(adq[name] || ''),String(adq[role] || '')));
  }
  const company=adq.empresa_id || 'ende';
  const sharedTdr=adq.borradores_ia?.[1]?.draft;
  const validTdr=sharedTdr?.companyId===company ? sharedTdr : undefined;
  const reference=company==='ende' && attachedTdr(adq,validTdr || {items:[]});
  if(reference) coverPeople(reference).forEach((v,i)=>register(1,['elaborado','revisado','aprobado'][i],parts(v)));
  for (const fact of adq.asistente_compra?.facts || []) {
    const role = /^Responsable institucional:\s*(.+)$/i.exec(fact.topic)?.[1];
    if (role && isInstitutionalRole(role) && ['antecedente','imagen'].includes(fact.origin)) {
      const person = parts(fact.value,role);
      if (identityName(person)) known.push(person);
    }
  }
  for(const [modelName,keys] of Object.entries(officialPeopleKeys)) {
    const model=+modelName, stored=adq.borradores_ia?.[model]?.draft;
    const saved=stored?.companyId===company ? stored : undefined;
    const official=adq.responsables_oficiales?.[model] || {};
    for(const key of keys.filter(k=>k!=='cargo'&&k!=='area')){
      register(model,key,parts(official[key],key==='solicitante' ? official.cargo : undefined));
      // A newly seeded document can recover its last named reference. A newer
      // name in the editor supersedes the saved one immediately.
      const useCurrent = model===number && identityName(parts(current[key]));
      const fields=useCurrent ? current : saved?.fields;
      if(fields) register(model,key,parts(fields[key],key==='solicitante'?fields.cargo:undefined),
        !saved?.editedFields?.includes(key) && reportPeopleDefaults[model]?.[key]===fields[key]);
    }
  }
  const assigned=parts(adq.responsable_proceso);
  if(identityName(assigned)) known.push(assigned);
  function forRole(role:string):Person[] {
    const pool=known.filter(p=>p.role && keyRole(p.role)===keyRole(role));
    const exact=pool.filter(p=>interim.test(normal(p.role))===interim.test(normal(role)));
    return exact.length ? exact : pool;
  }
  return {known,forRole, sources,requester:sources[1]?.elaborado || sources[2]?.solicitante || (identityName(assigned)?assigned:undefined)};
}

export function dossierPersonFields(number:number, fields:Record<string,string>, adq:Adquisicion, edited:readonly string[]=[]):Record<string,string> {
  const result={...fields};
  const directory=identityDirectory(adq,number,fields);
  const keys=number===8 ? ['destinatario','solicitante'] : officialPeopleKeys[number] || [];
  for(const key of keys.filter(k=>k!=='cargo'&&k!=='area')) {
    if(edited.includes(key)) continue;
    const oldDefault=reportPeopleDefaults[number]?.[key];
    const roleAttribute = attributes[number]?.[key]?.[1];
    const inline=parts(fields[key]);
    const current=parts(fields[key],number===2 && key==='solicitante' ? fields.cargo : roleAttribute ? String(adq[roleAttribute] || '') : undefined);
    const historical=!!oldDefault && fields[key]===oldDefault && adq.responsables_oficiales?.[number]?.[key]!==oldDefault;
    const explicit=current.name && !historical;
    if(explicit && inline.role && number!==2) continue;
    let role=current.role || formRoles[number]?.[key] || '';
    const requester=key==='solicitante' || key==='remitente' || key==='elaborado';
    const saved=directory.sources[number]?.[key];
    const byRole=role ? directory.forRole(role) : [];
    let person:Person|undefined;
    if(explicit) {
      const matches=directory.known.filter(p=>keyName(p.name)===keyName(current.name)&&p.role);
      const roles=new Set(matches.map(p=>keyRole(p.role)));
      person={...current,role:current.role || (roles.size===1 ? matches[0].role : '')};
    } else {
      person=(!current.role && saved) || unique(byRole) || (!role && requester ? directory.requester : undefined);
    }
    if(!person) {
      if(role && !explicit) result[key]=number===2 && key==='solicitante'?'[PENDIENTE]':([3,5,6,9].includes(number)?'\n':'')+role;
      continue;
    }
    const differentAppointment = interim.test(normal(current.role)) !== interim.test(normal(person.role));
    role=historical || !current.role || differentAppointment ? person.role || current.role : current.role;
    if(number===2 && key==='solicitante') {
      result.solicitante=person.name;
      if(role && !edited.includes('cargo') && !usable(fields.cargo)) result.cargo=role;
    } else if(!explicit || !inline.role && role) result[key]=[person.name,role].filter(Boolean).join(number===1?' - ':'\n');
  }
  return result;
}

export function fillDossierPeople(number:number,draft:FixedDraft,adq:Adquisicion):FixedDraft {
  if(draft.companyId!==(adq.empresa_id||'ende'))return draft;
  return {...draft,fields:dossierPersonFields(number,draft.fields,adq,[...(draft.editedFields || []),...(draft.confirmedFields || [])])};
}

export function memoPeople(adq:Adquisicion) {
  const combine=(name?:string,role?:string)=>[usable(name),usable(role)].filter(Boolean).join('\n');
  const fields=dossierPersonFields(8,{destinatario:combine(adq.memo_pago_a_nombre,adq.memo_pago_a_cargo),solicitante:combine(adq.memo_pago_de_nombre,adq.memo_pago_de_cargo)},adq);
  const to=parts(fields.destinatario),from=parts(fields.solicitante);
  const edited=adq.memo_pago_personas_editadas || [];
  return {
    memo_pago_a_nombre:edited.includes('memo_pago_a_nombre') ? adq.memo_pago_a_nombre || '' : to.name,
    memo_pago_a_cargo:edited.includes('memo_pago_a_cargo') ? adq.memo_pago_a_cargo || '' : to.role || formRoles[8].destinatario,
    memo_pago_de_nombre:edited.includes('memo_pago_de_nombre') ? adq.memo_pago_de_nombre || '' : from.name,
    memo_pago_de_cargo:edited.includes('memo_pago_de_cargo') ? adq.memo_pago_de_cargo || '' : from.role || formRoles[8].solicitante,
  };
}
