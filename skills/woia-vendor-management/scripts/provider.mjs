import {begin,finish,requireValue,ownKeys,approval,digest} from './guard.mjs';
export const actions=["vendor.search","vendor.read","vendor.qualify","vendor.quote.record","vendor.quote.compare","vendor.selection.record","vendor.performance.record"];
const writes=actions.filter(a=>!["vendor.search","vendor.read","vendor.quote.compare"].includes(a));
export const initial=organization=>({organization,revision:0,operations:{},history:[],vendors:{}});
export function execute(state,q){const c=begin(state,q,actions,writes);if(c.replay)return {state:c.next,result:c.replay};
 const vendors=c.next.vendors??={};let r=vendors[q.target];
 if(q.action==='vendor.search')return finish(c,q,Object.values(vendors).filter(x=>q.authority.resources.includes(x.person_ref)).map(x=>({person_ref:x.person_ref,qualification:x.qualification})));
 if(q.action==='vendor.read'){requireValue(r,'VENDOR_NOT_FOUND');return finish(c,q,structuredClone(r))}
 if(q.action==='vendor.quote.compare'){requireValue(r&&Array.isArray(q.payload?.quote_ids)&&q.payload.quote_ids.length>1,'QUOTES_REQUIRED');const quotes=q.payload.quote_ids.map(id=>r.quotes[id]);requireValue(quotes.every(Boolean),'QUOTE_NOT_FOUND');requireValue(quotes.every(x=>x.currency===quotes[0].currency&&x.scale===quotes[0].scale&&x.scope===quotes[0].scope),'INCOMPARABLE_QUOTES');return finish(c,q,quotes.map(x=>({quote_id:x.quote_id,amount_minor:x.amount_minor,evidence_ref:x.evidence_ref})).sort((a,b)=>BigInt(a.amount_minor)<BigInt(b.amount_minor)?-1:BigInt(a.amount_minor)>BigInt(b.amount_minor)?1:0))}
 requireValue(q.authority.department==='Vendor Management','VENDOR_MANAGEMENT_ONLY');
 if(q.action==='vendor.qualify'){ownKeys(q.payload,['person_ref','criteria_ref','decision']);requireValue(q.payload.person_ref===q.target&&q.authority.identity_verified===true&&q.payload.criteria_ref&&['qualified','rejected','pending'].includes(q.payload.decision),'QUALIFICATION_REQUIRED');r=vendors[q.target]??={person_ref:q.target,quotes:{},performance:[],selections:[]};r.qualification={...q.payload,evidence:q.evidence};}
 else {requireValue(r,'VENDOR_NOT_FOUND');if(q.action==='vendor.quote.record'){ownKeys(q.payload,['quote_id','amount_minor','currency','scale','scope','evidence_ref']);requireValue(q.payload.quote_id&&!r.quotes[q.payload.quote_id]&&/^\d+$/.test(q.payload.amount_minor)&&/^[A-Z]{3}$/.test(q.payload.currency)&&Number.isInteger(q.payload.scale)&&q.payload.scale>=0&&q.payload.scope&&q.payload.evidence_ref,'QUOTE_FIELDS_IMMUTABLE');r.quotes[q.payload.quote_id]={...q.payload,evidence:q.evidence};}
 else if(q.action==='vendor.selection.record'){ownKeys(q.payload,['quote_id','criteria_ref']);requireValue(r.qualification.decision==='qualified'&&r.quotes[q.payload.quote_id]&&q.payload.criteria_ref,'QUALIFIED_QUOTE_REQUIRED');r.selections.push({...q.payload,evidence:q.evidence,contract_authorized:false,payment_authorized:false});}
 else {ownKeys(q.payload,['observation','evidence_ref']);requireValue(q.payload.observation&&q.payload.evidence_ref,'PERFORMANCE_EVIDENCE_REQUIRED');r.performance.push({...q.payload,evidence:q.evidence})}}
 return finish(c,q,structuredClone(r));
}
