// Deployed capability manifests for the Life Workbench pilot (D3).
// Byte-source: personal-cognition-audit workbench/broker/life-workbench.mjs
// (reviewed), adapted to the deployed capabilities-module form: the transport
// wrapper is imported and applied at module load, exactly like forum.js —
// index.js only imports the resulting `lifeWorkbenchManifests` array.
import { withTransportErrors } from '../transport.js'

// Data-only consumer adapter for the existing Broker Config.manifests/targets.
// Deployment must append to the existing registries, preserving other targets.
// No credentials, identity lookup, network transport or runtime is implemented here.
const target = {targetId:'life-workbench', allowedOrigin:'http://127.0.0.1:7781', audience:'life-workbench'};
export function manifests(withTransportErrors) {
  const make = (id, scope, operations) => withTransportErrors({
    id, toolName:id, name:id, description:'Life Workbench agent capture/query; owner review stays in the UI.',
    requiredScopes:[scope], errors:[{code:'invalid_arguments',description:'Invalid business parameters'},
      {code:'unsupported_operation',description:'Operation is not available'}], operations,
  });
  const op = (name, method, path, properties={}, required=[], extra={}) => ({
    name, description:name, arguments:{properties,required},result:{type:'json'},errors:['invalid_arguments'],
    http:{target:target.targetId,method,path,...extra},
  });
  const strings = (...names) => Object.fromEntries(names.map(n=>[n,{type:'string',description:n}]));
  const entry = strings('request_id','body','occurred_at','source','content_author','source_role',
    'user_endorsement','capture_completeness','coverage','sensitivity','slug');
  const proposal = {...strings('request_id','entry'),nodes:{type:'array',description:'Candidate nodes'},
    edges:{type:'array',description:'Candidate relations'},questions:{type:'array',description:'Review questions'}};
  return [make('workbench_read','workbench.read',[
    op('entries','GET','/api/entries'),op('proposals','GET','/api/proposals'),
    op('explain','GET','/api/explain/{id}',strings('id'),['id'],{pathParams:['id']}),
    op('search','GET','/api/search',strings('q'),['q'],{query:['q']}),
  ]),make('workbench_propose','workbench.propose',[
    op('entry','POST','/api/entries',entry,['request_id','body','occurred_at','source','content_author','source_role','user_endorsement'],{body:Object.keys(entry)}),
    op('proposal','POST','/api/proposals',proposal,['request_id','entry','nodes','edges'],{body:Object.keys(proposal)}),
  ])];
}

const lifeWorkbenchManifests = manifests(withTransportErrors)
export { lifeWorkbenchManifests }
