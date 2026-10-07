import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {initial,execute,actions} from '../skills/woia-vendor-management/scripts/provider.mjs';
 const hash=p=>createHash('sha256').update(JSON.stringify(p)).digest('hex');
 const department="Vendor Management";
 function request(s,action,payload,approved=false,target='subject',overrides={}){return {organization:s.organization,action,target,payload,operation_id:'op-'+s.revision,expected_revision:s.revision,evidence:{source:'synthetic-source',reference:'synthetic-reference',recorded_at:'2026-10-07T00:00:00Z'},authority:{authenticated:true,current:true,organization:s.organization,actor:'synthetic-actor',policy_revision:'synthetic-policy-1',actions,resources:['subject','other'],fields:['kind','display_name','contact_identifiers'],source_fields:['kind','display_name','contact_identifiers'],department,owner:'Synthetic owner',identity_verified:true,relationship_conflicts_checked:true,...(approved?{approval:{approved:true,current:true,principal:'synthetic-independent-owner',payload_digest:hash(payload),action,target,organization:s.organization,policy_revision:'synthetic-policy-1'}}:{}),...overrides}}}
 function run(s,a,p,approved=false,target='subject',overrides={}){return execute(s,request(s,a,p,approved,target,overrides))}
test('vendor qualification quotes comparisons selection and observations preserve evidence',()=>{
 let s=run(initial('synthetic-org'),'vendor.qualify',{person_ref:'subject',criteria_ref:'synthetic-criteria',decision:'qualified'}).state;
 s=run(s,'vendor.quote.record',{quote_id:'quote-1',amount_minor:'100',currency:'USD',scale:2,scope:'synthetic-work',evidence_ref:'original-1'}).state;
 s=run(s,'vendor.quote.record',{quote_id:'quote-2',amount_minor:'90',currency:'USD',scale:2,scope:'synthetic-work',evidence_ref:'original-2'}).state;
 assert.equal(run(s,'vendor.quote.compare',{quote_ids:['quote-1','quote-2']}).result[0].quote_id,'quote-2');
 s=run(s,'vendor.selection.record',{quote_id:'quote-2',criteria_ref:'synthetic-criteria'}).state;
 s=run(s,'vendor.performance.record',{observation:'synthetic observation',evidence_ref:'original-3'}).state;
 assert.equal(run(s,'vendor.read',{}).result.selections[0].contract_authorized,false);
 assert.equal(run(s,'vendor.search',{}).result.length,1);
 assert.equal(s.vendors.subject.quotes['quote-1'].evidence_ref,'original-1');
});
test('vendor cannot overwrite original quotes, mix currencies or contact vendors',()=>{
 let s=run(initial('synthetic-org'),'vendor.qualify',{person_ref:'subject',criteria_ref:'criteria',decision:'qualified'}).state;
 const quote={quote_id:'q1',amount_minor:'100',currency:'USD',scale:2,scope:'work',evidence_ref:'original'};
 s=run(s,'vendor.quote.record',quote).state;
 assert.throws(()=>run(s,'vendor.quote.record',quote),/IMMUTABLE/);
 s=run(s,'vendor.quote.record',{...quote,quote_id:'q2',currency:'EUR'}).state;
 assert.throws(()=>run(s,'vendor.quote.compare',{quote_ids:['q1','q2']}),/INCOMPARABLE_QUOTES/);
 assert.throws(()=>run(s,'communication.external.send',{}),/ACTION_DENIED/);
});
test('organization authentication action resource and provenance guards fail closed',()=>{const s=initial('synthetic-org');const q=request(s,'vendor.qualify',{"person_ref":"subject","criteria_ref":"synthetic-criteria","decision":"qualified"});assert.throws(()=>execute(s,{...q,organization:'other-org'}),/ORGANIZATION_SCOPE/);for(const authority of [{...q.authority,authenticated:false},{...q.authority,revoked:true},{...q.authority,current:false},{...q.authority,hold:true}])assert.throws(()=>execute(s,{...q,authority}),/AUTHORITY_REQUIRED/);assert.throws(()=>execute(s,{...q,authority:{...q.authority,resources:[]}}),/RESOURCE_SCOPE/);assert.throws(()=>execute(s,{...q,authority:{...q.authority,actions:[]}}),/ACTION_DENIED/);assert.throws(()=>execute(s,{...q,evidence:{}}),/PROVENANCE_REQUIRED/)});
test('idempotent receipt collision and stale concurrent revision preserve original state',()=>{const s=initial('synthetic-org');const q=request(s,'vendor.qualify',{"person_ref":"subject","criteria_ref":"synthetic-criteria","decision":"qualified"});const out=execute(s,q);assert.equal(s.revision,0);assert.deepEqual(execute(out.state,q),out);assert.throws(()=>execute(out.state,{...q,payload:{...q.payload,unexpected:true}}),/OPERATION_CONFLICT/);assert.throws(()=>execute(out.state,{...q,operation_id:'concurrent'}),/REVISION_CONFLICT/);assert.equal(out.state.history.length,1)});

test('caller mutation cannot alter accepted state or saved operation result',()=>{const s=initial('synthetic-org');const q=request(s,'vendor.qualify',{person_ref: 'subject', criteria_ref: 'criteria', decision: 'qualified'});const out=execute(s,q);const accepted=JSON.stringify(out.state);q.evidence.reference='changed-after';q.payload.injected='changed-after';if(q.payload.contact_identifiers)q.payload.contact_identifiers[0].id='changed-after';out.result.injected='changed-after';assert.equal(JSON.stringify(out.state),accepted)});
