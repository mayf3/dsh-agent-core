"""Pure offline first-live Packet assembly; no key creation, signing or runtime calls.

REUSE Spec3986553, fixed first-live designs and parent implementation mandate.
Catalog carries only the actual historical public keys for native transition
validation. Fresh keys, custody/login/denial/PASS are derived only in native code.
"""
import argparse
import copy
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess

A = Path('/Users/yanfenma/workspace/artifacts/production-deployment-control-plane-v1')
P = Path(__file__).resolve().parents[4] / '.superpowers/sdd/PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1_FIRST_LIVE_CLOSURE'
STATIC = A / 'first-live-preparation/static-inputs-v7'
OPERATION = 'first-live-dsh-20260918-01'
WD = 'DCP_DSH_WATCHDOG_ACCEPTANCE_V1'
BROKER = 'WORKFLOW_ACTIVE_POOL_DISPOSITION_V1_BROKER_DELIVERY_V2'
SOURCE = 'd602b592fad345fb1c9adebe2bc6611a6f5cfdc2'
APP = '/usr/local/libexec/agent-core/app/'
LOCK_PARENTS = ['/private/var/run', '/usr/local/var/agent-core/production-mutation-locks',
                '/private/var/db/agent-core', '/private/var/db/agent-core/deployments']
ANCESTORS = ['/', '/usr', '/usr/local', '/usr/local/libexec', '/usr/local/libexec/agent-core',
             '/usr/local/libexec/agent-deployd', '/Library', '/Library/LaunchDaemons']
SOURCES = {
 'static-index': (STATIC/'index.json', '1ef5b271630238d422a21cb986dcb5eac7b8c3e8be74a771548cfb79d4710dcc'),
 'current-baseline': (A/'first-live-preparation/g2-baseline-binding.json', 'a487389caef5c4d0c995ec57d95cdb5d6d324274570293603a1f35044a17b966'),
 'enrollments': (P/'prospective-first-live-enrollments.json', '3211d45eb163c25ae026d1be71c81ca9ac96359261c679d03f7a8fe37843d193'),
 'watchdog-source': (P/'prospective-watchdog-source-policy.json', '1504fee8013a6b024545b1383f2132c4f65c0a4420ee07edf7ba61e4ce089d68'),
 'broker-source': (P/'prospective-broker-source-policy.json', 'a22d76d33f1a2724c4751dc2dcbdcc3b05e8d9ec3ead090127935426f4cc56f9'),
 'previous': (P/'first-live-initial-state-binding.json', '326246e85489c30e3995c60d632a8f54583c91ed4848fbd01b25604f61b940b0'),
 'watchdog-observation': (P/'prospective-watchdog-canonical-source-observation.json', 'a53f036ad21e314ca2fe507568c4e31a3ef1ee38c48ec3fa17ac78f6b59e6a2a'),
 'genesis-plan': (A/'genesis-bcfd929/plan.json', 'c3a5ed50ffe2588cedc26b7ba3931aef85de496143ea355d70b773648b6bd38e'),
 'supervisor': (A/'genesis-bcfd929/supervisor-policy.json', '980d3f08cd741139b6d1c1d5ade9b0a7a9deefe4a650776b1b504c0258cdb6a0'),
 'ancestors': (A/'first-live-preparation/ordinary-census/protected-ancestor-tuples.json', '86e4b2f5fbba97b32fa1c79ff440b4d3900dddabea78c5f14afcc53d2f28535a'),
 'lock-tools': (A/'first-live-preparation/ordinary-census/packet-lock-tool-input.json', '753c65c774d4f59bc2946d84ceeb16c13b48528850d8e6b954a345430adf0156'),
 'supplement': (A/'first-live-preparation/ordinary-census/static-input-supplement-v5.json', '8262df9a7971fbe62a849cbcfaa5b34d4522ea3c1b166a3357ed0b58a2488b9a'),
 'effective-sudo': (P/'ordinary-effective-sudo-policy.json', 'df3e4b069373452a4740349bf7aa5e110301d016a63979d92ed3b4d608a9f27c'),
 'sudoers': (A/'genesis-65559dd-20260918-01/reconciliation-bcfd929/login-failure-readback/observation-once/054-readonly-postinstall.stdout', '855b85fd8516cb607429eba0581d57a7a1df24b82ba5d42103b71f12ae1e56a1'),
}
FREEZE_FIELDS = {'source_sha', 'review_sha256', 'controller_sha256', 'owner_acceptance_digest',
                 'review_helper_sha256', 'retired_binary_sha256'}


def require(ok, reason):
    if not ok:
        raise ValueError(reason)


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False).encode()


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def digest(value, size=64):
    require(isinstance(value, str) and re.fullmatch('[0-9a-f]{' + str(size) + '}', value)
            and value != '0' * size, 'REQUIRED_EXACT_DIGEST')
    return value


def unique(pairs):
    value = {}
    for k, v in pairs:
        require(k not in value, 'DUPLICATE_JSON_KEY')
        value[k] = v
    return value


def decode(raw):
    def invalid(_):
        raise ValueError('NONFINITE_JSON')
    return json.loads(raw, object_pairs_hook=unique, parse_constant=invalid)


def verified_bytes(path, expected, bound=64*1024*1024):
    digest(expected)
    require(Path(path).is_absolute() and not Path(path).is_symlink(), 'SOURCE_PATH')
    raw = Path(path).read_bytes()
    require(0 < len(raw) <= bound and sha(raw) == expected, 'SOURCE_DIGEST_DRIFT:' + str(path))
    return raw


def load_sources():
    records, bindings = {}, {}
    for name, (path, expected) in SOURCES.items():
        raw = verified_bytes(path, expected)
        records[name] = decode(raw)
        bindings[name] = dict(path=str(path), sha256=expected, bytes=len(raw))
    index = records['static-index']
    require(index['operation_id'] == OPERATION and index['link_blockers'] == 0 and
            index['preserved_negative_edges'] == 4, 'STATIC_CLOSURE')
    baseline = records['current-baseline']
    require(baseline['operation_id'] == OPERATION and
            baseline['state'] == 'POST_V7_G2_BASELINE_BOUND_FOR_NONPRODUCTION_PACKAGE_PREPARATION' and
            baseline['production_mutation_performed_by_control_plane_goal'] is False and
            baseline['external_production_mutation_observed'] is True and
            baseline['fresh_static']['static_index_sha256'] == SOURCES['static-index'][1] and
            baseline['coordinates']['broker_workflow_preimage_sha256'] ==
                'd76791b7ebbacc872343ba8a26d13ce1f4f2315f4ff5a53fc8744f445b1e65ee' and
            baseline['coordinates']['watchdog_incident_lifecycle_sha256'] ==
                'cd0d7b0ca09a78d514f9c28dc240c16271536cd6ccaa2546805b2b569c18b1c1',
            'CURRENT_BASELINE_BINDING')
    for name, row in index['files'].items():
        require(re.fullmatch(r'[a-z0-9-]+\.json', name), 'STATIC_NAME')
        raw = verified_bytes(STATIC/name, row['sha256'])
        require(len(raw) == row['bytes'], 'STATIC_SIZE')
        bindings['static/'+name] = dict(path=str(STATIC/name), **row)
        # All tree bytes are pinned; only the small app tree is needed to derive legacy preimages.
        if name not in ('harness-inventory.json', 'node-runtime-inventory.json'):
            records[name] = decode(raw)
    records['configuration'] = records['configuration-template.json']
    records['native'] = records['native-enrollment-template.json']
    return records, bindings


def identity(row):
    require(row.get('kind', 'directory') in ('file', 'directory') and row.get('flags', 0) == 0, 'LOCK_SHAPE')
    result = {k: row[k] for k in ('device', 'inode', 'uid', 'gid', 'mode')}
    require(all(type(v) is int for v in result.values()) and result['device'] > 0 and
            result['inode'] > 0 and result['uid'] == 0, 'LOCK_METADATA')
    return result


def compose(s, frozen):
    require(set(frozen) == FREEZE_FIELDS, 'FINAL_FREEZE_REQUIRED')
    for k, v in frozen.items():
        digest(v, 40 if k == 'source_sha' else 64)
    config, native = copy.deepcopy(s['configuration']), copy.deepcopy(s['native'])
    require(config['first_target_adoption'] == OPERATION and config['socket_gid'] == 602 and
            config['callers'] == [{'uid':502,'gid':20,'profiles':['dsh-app'],'producers':['local-deployment-registry']}], 'CONFIGURATION_BINDING')
    require('denial_receipt' not in config['socket_ancestor'] and 'lifecycle_denial_digest' not in native, 'PREFILLED_PROOF')
    profile = config['catalog']['profiles']['dsh-app']
    require(set(config['catalog']['profiles']) == {'dsh-app'} and profile['enabled'] is True and
            profile['host'] == native['host'] and native['runtime_startup'] == 'catchup-zero', 'NATIVE_BINDING')
    inert = copy.deepcopy(profile); inert['enabled'] = False
    require(sha(canonical(inert)) == native['profile_digest'], 'PROFILE_DIGEST')
    roles = s['genesis-plan']['roles']; keys = config['catalog']['keys']
    require(len(roles) == len(keys) == 6 and len({r['key_id'] for r in roles}) == 6, 'ROLE_SET')
    issuers = []
    for r in roles:
        key = keys[r['key_id']]
        require(r['role'] == key['role'] and r['scopes'] == key['scopes'] and
                r['generation'] == 'SystemCsprngEd25519' and r['custody'] == 'RootOnlyFile0600Directory0700', 'ROLE_BINDING')
        issuers.append(dict(proposed_key_id=r['key_id'], role=r['role'], scope=r['scopes'],
            service_identity=r['key_id'], public_key=None, custody_receipt=None,
            source_binding='PRODUCTION_DEPLOYMENT_CONTROL_PLANE_V1: existing genesis role ' + r['role'] + ' URI ' + r['service_identity'] +
            '; fresh preactivation custody after authenticated host closure; independent UID612 review retained'))
    wd = copy.deepcopy(s['enrollments']['watchdog_enrollment'])
    broker = copy.deepcopy(s['enrollments']['broker_enrollment_before_authenticated_child_binding'])
    require(wd['goal_id'] == WD and wd['frozen_source_sha'] == SOURCE and broker['goal_id'] == BROKER and
            broker['frozen_source_sha'] == '59472b631129d1ea3ca1202cbcbbc0799b083114', 'GOAL_BINDING')
    require(len(broker['prior_dependencies']) == 1 and
            'deployment_child' not in broker['prior_dependencies'][0] and
            broker['prior_dependencies'][0]['goal_id'] == wd['business_goal_id'], 'PREFILLED_CHILD')
    observed = s['watchdog-observation']; source = decode(observed['stdout'])
    require(observed['exit_code'] == 0 and observed['signing'] is False and observed['root'] is False and
            observed['policy_sha256'] == SOURCES['watchdog-source'][1] and source['source'] == SOURCE,
            'SOURCE_OBSERVATION')
    manifest = {'version':1, 'entries':source['slots']}
    require(sha(canonical(manifest)) == source['artifact'], 'MANIFEST_DIGEST')
    release = dict(goal_id=WD, acceptance_revision=wd['acceptance_revision'], source_sha=SOURCE,
                   artifact_sha256=source['artifact'], manifest_digest=source['artifact'])
    paths = s['lock-tools']['paths']
    permanent = identity(paths[LOCK_PARENTS[0]+'/agent-core-production-mutation.lock'])
    require(permanent['mode'] == 0o600, 'PERMANENT_LOCK')
    locks = dict(parents=[identity(paths[p]) for p in LOCK_PARENTS], permanent={'state':'present','identity':permanent})
    ancestors = {p: {k:s['ancestors']['paths'][p][k] for k in ('device','inode','uid','gid','mode','flags')} for p in ANCESTORS}
    tools = {p:r['sha256'] for p,r in s['lock-tools']['tools'].items()}
    tools['/bin/launchctl'] = native['launchctl_sha256']
    require(set(tools) == {'/bin/ps','/bin/sh','/bin/launchctl'}, 'TOOL_SET')
    entries = s['app-inventory.json']['entries']
    legacy = {APP+p:entries[p]['sha256'] for p in ('scripts/trusted-cp-deploy-install.sh','scripts/production-runtime-launchd.mjs')}
    legacy['/usr/local/libexec/lw-pilot-executor'] = s['effective-sudo']['executor']['sha256']
    require(s['effective-sudo']['exit_code'] == 0 and not s['effective-sudo']['stderr'], 'EFFECTIVE_SUDO')
    rows = s['previous']['rows']
    previous = {k:rows[k]['sha256'] for k in ('installation_receipt_sha256','service_sha256','issuer_policy_sha256','registry_sha256')}
    previous['trust_sha256'] = rows['local_trust_sha256']['sha256']
    require(rows['issuer_bindings']['expected_state'] == 'ABSENT', 'ORIGINAL_BINDINGS')
    labels = ['system/ai.agent-core.'+s for s in ('runtime','scheduler-watchdog-w1','scheduler-watchdog-w2')]
    files = s['static-index']['files']
    lifecycle = dict(legacy_locks=locks, ancestors=ancestors,
        app_inventory_sha256=files['app-inventory.json']['sha256'], harness_inventory_sha256=files['harness-inventory.json']['sha256'],
        node_inventory_sha256=files['node-runtime-inventory.json']['sha256'], node_payloads=s['node-payloads.json'],
        tool_sha256=tools, legacy_sha256=legacy, retired_binary_sha256=frozen['retired_binary_sha256'],
        sudoers_sha256=s['sudoers']['sudoers'], caller_groups=s['supplement']['groups']['502']['groups'],
        runtime_groups=s['supplement']['groups']['505']['groups'], loaded_services=dict.fromkeys(labels,True),
        disabled_services=dict.fromkeys(labels,False), effective_sudo_sha256=sha(s['effective-sudo']['stdout'].encode()))
    return dict(version=1, operation_id=OPERATION, host=digest(native['host']),
        **{k:frozen[k] for k in ('source_sha','review_sha256','controller_sha256','owner_acceptance_digest')},
        previous=previous, configuration=config, native_enrollment=native, issuer_bindings=issuers,
        watchdog=wd, broker=broker, watchdog_source=s['watchdog-source'], broker_source=s['broker-source'],
        codex_sha256=s['supervisor']['issuer_policy']['codex_sha256'], review_helper_sha256=frozen['review_helper_sha256'],
        policy_epoch=s['supervisor']['issuer_policy']['policy_epoch']+1, release=release,
        canary_plan=dict(version=1, source_sha=SOURCE, canary_agent_id='agt_scheduler-postdeploy-canary',
            logical_key='scheduler-postdeploy:'+SOURCE, at_delay_seconds=1200, not_after_delay_seconds=1380),
        health_max_age_ms=60000, heartbeat_max_age_ms=1800000, lifecycle=lifecycle)


def read_freeze(path, expected):
    raw = verified_bytes(path, expected, 1024*1024)
    freeze = decode(raw)
    require(set(freeze) == {'source_sha','source_root','build_record','review_record','owner_acceptance'}, 'FREEZE_SCHEMA')
    source = digest(freeze['source_sha'],40)
    root = Path(freeze['source_root'])
    require(root.is_absolute() and root.is_dir(), 'SOURCE_ROOT')
    def git(ref):
        value = subprocess.run(['/usr/bin/git','-C',str(root),'rev-parse','--verify',ref],
            stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=10,check=False)
        require(value.returncode == 0 and len(value.stdout) <= 128, 'SOURCE_COMMIT')
        return value.stdout.decode().strip()
    require(git(source+'^{commit}') == source, 'SOURCE_COMMIT')
    tree = digest(git(source+'^{tree}'),40)
    bindings = {'freeze':dict(path=str(path),sha256=expected,bytes=len(raw))}
    def record(name, row, maximum=64*1024*1024):
        require(type(row) is dict and set(row)=={'path','sha256'}, 'FREEZE_RECORD')
        value=verified_bytes(Path(row['path']),row['sha256'],maximum)
        bindings[name]=dict(row,bytes=len(value))
        return value
    build=decode(record('build',freeze['build_record'],1024*1024))
    require(set(build)=={'version','source_sha','source_tree','executables'} and build['version']==1 and
            build['source_sha']==source and build['source_tree']==tree,'BUILD_SOURCE')
    names={'controller':'agent-deployd','review_helper':'agent-deploy-issuer','retired_binary':'agent-deploy-legacy-retired'}
    require(set(build['executables'])==set(names),'BUILD_EXECUTABLES')
    final={'source_sha':source}
    for key,name in names.items():
        row=build['executables'][key]
        require(Path(row['path']).name==name,'EXECUTABLE_NAME')
        record(key,row)
        final[key+'_sha256']=row['sha256']
    record('review',freeze['review_record'],4*1024*1024)
    record('owner-acceptance',freeze['owner_acceptance'],4*1024*1024)
    final['review_sha256']=freeze['review_record']['sha256']
    final['owner_acceptance_digest']=freeze['owner_acceptance']['sha256']
    # This binds existing records/bytes, not an assertion that their claimed review or authorization is valid.
    # Independent review and the future actual Owner grant remain separate mandatory gates.
    return final,bindings


def input_manifest(s, bindings):
    return {'version':1,'operation_id':OPERATION,'state':'STATIC_INPUTS_JOINED_FINAL_FREEZE_REQUIRED',
        'ready':False,'sources':bindings,'final_freeze_required':sorted(FREEZE_FIELDS),
        'deferred_native_field':'lifecycle.tool_sha256./usr/bin/sudo',
        'native_input_names':{'app-inventory.json':'app-inventory.json','harness-inventory.json':'harness-inventory.json',
                              'node-inventory.json':'node-runtime-inventory.json'},
        'policy_choices':{'policy_epoch':2,'health_max_age_ms':60000,'heartbeat_max_age_ms':1800000,
            'canary_delays_seconds':[1200,1380],'required_loaded_services':True,'required_disabled_services':False},
        'runtime_preconditions':{
            'fourth_legacy_lock':{'path':LOCK_PARENTS[3]+'/transaction.lock',
                'ordinary_observation_errno':s['lock-tools']['paths'][LOCK_PARENTS[3]+'/transaction.lock']['errno'],
                'required_native_state':'ABSENT'},
            'locks':'Actual exclusion/unknown-holder census under existing MutationGuard required',
            'current_state':'All retained ordinary metadata, group, code, sudo, loaded/disabled state must pass current protected preflight',
            'fresh_derived':'Native host closure then new custody, dedicated reviewer login, denial, canary and receipts only',
            'historical_keys':'Configuration carries real old public catalog solely for native custody transition validation; no fresh keys predicted'},
        'limitations':['No private keys/auth/state read','No production process, endpoint or privileged operation called',
            'Source record hashes identify data; they do not independently authorize deployment or attest a build/review verdict',
            'Output is not an Owner grant, production readiness, adoption, acceptance or parent Goal completion']}


def publish(out, packet, manifest, bindings):
    require(not out.exists(), 'OUTPUT_EXISTS')
    out.mkdir(mode=0o700,parents=True)
    def write(name, raw):
        with (out/name).open('xb') as stream:
            stream.write(raw)
            stream.flush()
            os.fsync(stream.fileno())
    if packet is not None:
        raw=canonical(packet)
        write('packet-template.json',raw)
        manifest.update(state='PACKET_TEMPLATE_ASSEMBLED_NOT_AUTHORIZED',packet_template_sha256=sha(raw))
        manifest['output_files']={'packet-template.json':sha(raw)}
        for target, source in manifest['native_input_names'].items():
            row=bindings['static/'+source]
            data=verified_bytes(Path(row['path']),row['sha256'])
            write(target,data);manifest['output_files'][target]=sha(data)
    write('binding-manifest.json',canonical(manifest))


def main():
    require(os.geteuid()!=0,'NONROOT_OFFLINE_ONLY')
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--binding-only',action='store_true')
    parser.add_argument('--freeze',type=Path)
    parser.add_argument('--freeze-sha256')
    parser.add_argument('--out',type=Path,required=True)
    args=parser.parse_args()
    require(args.binding_only and args.freeze is None and args.freeze_sha256 is None or
            not args.binding_only and args.freeze is not None and args.freeze_sha256 is not None,'FINAL_FREEZE_REQUIRED')
    sources,bindings=load_sources()
    manifest=input_manifest(sources,bindings)
    packet=None
    if not args.binding_only:
        frozen,freeze_bindings=read_freeze(args.freeze,args.freeze_sha256)
        packet=compose(sources,frozen)
        manifest['final_freeze_sources']=freeze_bindings
        manifest['final_freeze_required']=[]
    publish(args.out,packet,manifest,bindings)
    print(json.dumps({'output':str(args.out),'state':manifest['state'],'ready':False}))


if __name__=='__main__':
    main()
