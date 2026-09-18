import copy
import importlib.util
import unittest
import tempfile
from pathlib import Path

spec = importlib.util.spec_from_file_location('prepare_inputs', Path(__file__).with_name('prepare_inputs.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def row(path='packages/broker/src/capabilities/workflow.js', kind='file'):
    value = dict(path=path, kind=kind, uid=505, gid=601, mode=0o644 if kind == 'file' else 0o755,
                 flags=0, device=42, inode=123, nlink=1)
    if kind == 'file':
        value['sha256'] = 'a' * 64
    if kind == 'symlink':
        value['target'] = '../packages/example'
    return value


def root():
    return dict(kind='directory', uid=505, gid=601, mode=0o755, flags=0,
                device=42, inode=99, nlink=4)


def optional_graph():
    a = 'node_modules/.pnpm/@anthropic-ai+claude-agent-sdk@0.3.220_@anthropic-ai+sdk@0.93.0_zod@4.4.3__@modelcontex_57ba44dcbc2a36491e18d36fec520472/node_modules/@anthropic-ai'
    b = 'node_modules/.pnpm/@openai+codex@0.147.0/node_modules/@openai'
    rows = {}
    def add(path,kind):
        parts=path.split('/')
        for i in range(1,len(parts)): rows.setdefault('/'.join(parts[:i]), row('/'.join(parts[:i]),'directory'))
        rows[path]=row(path,kind)
        return rows[path]
    for source,target,name,leaf,package,hashvalue in [(a,'@anthropic-ai+claude-agent-sdk-darwin-x64@0.3.220/node_modules/@anthropic-ai','claude-agent-sdk-darwin-x64','claude-agent-sdk-darwin-x64','claude-agent-sdk','1c9d0905f64e126850efe4fc4e7244c604a0855de8d4c82aff78da6f1988bd08'),
            (b,'@openai+codex@0.147.0-darwin-x64/node_modules/@openai','codex-darwin-x64','codex','codex','bbaf3b9597b54bc1d4cf4aea93870e9035629d79bdaba58234011c31f0cfcf3d')]:
        for path,up in [(source+'/'+name,'../../..'),('node_modules/.pnpm/node_modules/'+source.split('/')[-1]+'/'+name,'../..')]:
            add(path,'symlink')['target']=up+'/'+target+'/'+leaf
        add('node_modules/.pnpm/'+target.rsplit('/',1)[0],'directory')
        add(source+'/'+package+'/package.json','file')['sha256']=hashvalue
    for i,e in enumerate(rows.values(),1): e['inode']=i
    return [m.typed_tree([row()],root()), m.typed_tree(list(rows.values()),root()),m.typed_tree([row()],root())]


class StaticInputs(unittest.TestCase):
    def test_exact_four_optional_negative_edges_are_preserved_without_fake_target(self):
        trees=optional_graph();before=copy.deepcopy(trees)
        self.assertEqual(len(m.link_issues(trees)),4)
        m.closed_links(trees)
        self.assertEqual(trees,before)

    def test_optional_negative_edge_scope_never_accepts_drift_or_fifth(self):
        trees=optional_graph()
        issues=m.link_issues(trees)
        for issue in issues:
            bad=copy.deepcopy(trees);bad[1]['entries'][issue['path']]['link']+='/'
            with self.assertRaises(ValueError):m.closed_links(bad)
            bad=copy.deepcopy(trees);bad[1]['entries'].pop(issue['path'])
            with self.assertRaises(ValueError):m.closed_links(bad)
            bad=copy.deepcopy(trees);missing=issue['missing_path'].removeprefix(m.BASE+'harness/')
            bad[1]['entries'][missing]=m.entry(row(missing,'directory'))
            with self.assertRaises(ValueError):m.closed_links(bad)
        bad=copy.deepcopy(trees);extra=m.entry(row('fifth','symlink'));extra['link']='absent';bad[1]['entries']['fifth']=extra
        with self.assertRaises(ValueError):m.closed_links(bad)
        for p,e in trees[1]['entries'].items():
            if p.endswith('package.json'):
                bad=copy.deepcopy(trees);bad[1]['entries'][p]['sha256']='f'*64
                with self.assertRaises(ValueError):m.closed_links(bad)
    def test_public_configuration_retains_keys_and_omits_future_receipts(self):
        service = {'catalog': {'profiles': {'dsh-app': {'enabled': False, 'repo': 'mayf3/dsh-agent-core',
            'host': 'a'*64, 'revision': 'fixture-v1', 'verification_profiles': ['native'],
            'goal_verifiers': {'native': 'local-verifier'}}},
            'keys': {'local-verifier': {'role': 'VERIFIER', 'public_key': 'fixture-public-key'},
                     'fixture-authority': {'role': 'AUTHORITY', 'public_key': 'other-fixture'}}},
            'callers': [{'uid':502}], 'verifiers': {'native': {'kind':'native-installed-readback','issuer':'local-verifier'}},
            'socket_ancestor': None, 'socket_gid': 602}
        supplement = {'socket_ancestor': {'dev':42,'ino':100,'uid':0,'gid':1,'mode':0o775,'flags':0},
            'groups': {'502': {'groups':[20,602]}, '505': {'groups':[601]}}, 'services': {}}
        for label,uid,gid,script,args in [('runtime',505,601,'production-runtime.mjs',['--root','/Users/authsvc/.agent-core','--catchup','0']),
                ('scheduler-watchdog-w1',505,601,'scheduler-watchdog.mjs',['--role','w1']),
                ('scheduler-watchdog-w2',0,0,'scheduler-watchdog.mjs',['--role','w2'])]:
            supplement['services']['ai.agent-core.'+label] = {'uid':uid,'gid':gid,'sha256':'c'*64,
                'ProgramArguments':[m.BASE+'node-runtime/bin/node',m.BASE+'app/scripts/'+script]+args}
        tree = m.typed_tree([row(p) for p in m.MUTABLE], root())
        arguments = [service, [tree], [{'path':m.BASE+'node-runtime/bin/node','sha256':'d'*64}],
            supplement, {'SHELL':b'x','JS':b'y'}, {'/bin/launchctl':'e'*64,'/usr/bin/plutil':'f'*64},
            {'exit':0,'argv':['/bin/ls','-ldeO','/private/var/run'],'stdout':'drwxrwxr-x  fixture\n'}]
        before = copy.deepcopy(arguments)
        config,native = m.templates(*arguments)
        self.assertEqual(arguments,before)
        self.assertEqual(config['catalog']['keys'],service['catalog']['keys'])
        self.assertNotIn('denial_receipt',config['socket_ancestor'])
        self.assertNotIn('lifecycle_denial_digest',native)
        self.assertNotIn('controller_sha256',native)
        self.assertEqual(native['runtime_startup'],'catchup-zero')
        profile = copy.deepcopy(config['catalog']['profiles']['dsh-app']); profile['enabled']=False
        self.assertEqual(native['profile_digest'],m.sha(m.canonical(profile)))
        self.assertEqual([s['gid'] for s in native['services']],[601,601,0])
        for field,value in [('gid',20),('ProgramArguments',['/bin/true'])]:
            bad = copy.deepcopy(arguments)
            bad[3]['services']['ai.agent-core.runtime'][field]=value
            with self.assertRaises(ValueError):m.templates(*bad)
        bad = copy.deepcopy(arguments); bad[3]['groups']['502']['groups'].append(1)
        with self.assertRaises(ValueError):m.templates(*bad)

    def test_loader_bytes_are_checked_and_old_controller_payload_is_excluded(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory=Path(tmp); payloads=[]
            for i in range(22):
                raw=f'fixture-loader-{i}'.encode(); blob=f'payload-{i:02}'
                (directory/blob).write_bytes(raw)
                relative='bin/node' if i==0 else f'lib/lib{i}.dylib'
                payloads.append({'destination':m.BASE+'node-runtime/'+relative,'blob':blob,
                    'mode':0o555,'size':len(raw),'sha256':m.sha(raw)})
            payloads.append({'destination':'/usr/local/libexec/agent-deployd/agent-deployd'})
            files,blobs=m.loader_payloads({'payloads':payloads},directory)
            self.assertEqual(len(files),22);self.assertEqual(len(blobs),22)
            self.assertTrue(all(f['path'].startswith(m.BASE+'node-runtime/') for f in files))
            (directory/'payload-00').write_bytes(b'corrupt')
            with self.assertRaisesRegex(ValueError,'NODE_PAYLOAD_BYTES'):m.loader_payloads({'payloads':payloads},directory)

    def test_open_hardlink_alias_is_rejected_even_if_all_links_resolve(self):
        leaf=row('leaf'); leaf['nlink']=2
        trees=[m.typed_tree([leaf],root()) for _ in m.NAMES]
        with self.assertRaisesRegex(ValueError,'OPEN_ALIAS'):m.closed_links(trees)

    def test_source_document_requires_exact_digest_and_unique_json_members(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'input.json';p.write_bytes(b'{"same":1,"same":2}')
            with self.assertRaisesRegex(ValueError,'DUPLICATE_JSON_KEY'):m.document(p,m.sha(p.read_bytes()))
            with self.assertRaisesRegex(ValueError,'SOURCE_DIGEST_DRIFT'):m.document(p,'a'*64)

    def test_link_diagnostic_retains_missing_leaf_and_whole_observed_chain(self):
        directory = row('node_modules', 'directory')
        link = row('node_modules/missing', 'symlink'); link['target'] = './absent'
        trees = [m.typed_tree([directory, link], root()) for _ in m.NAMES]
        issues = m.link_issues(trees)
        self.assertEqual(len(issues), 3)
        issue = issues[0]
        self.assertEqual(issue['raw_link'], './absent')
        self.assertEqual(issue['missing_path'], m.BASE + 'app/node_modules/absent')
        self.assertTrue(issue['missing_final_leaf'])
        self.assertEqual(issue['ancestor_chain'][-1]['path'], m.BASE + 'app/node_modules')
        self.assertEqual(issue['ancestor_chain'][-1]['entry']['inode'], 123)
        with self.assertRaisesRegex(ValueError, 'LINK_DANGLING'): m.closed_links(trees)

    def test_link_diagnostic_distinguishes_intermediate_missing_escape_and_cycle(self):
        def graph(target):
            link = row('link', 'symlink'); link['target'] = target
            return [m.typed_tree([link], root()) for _ in m.NAMES]
        self.assertFalse(m.link_issues(graph('absent/file'))[0]['missing_final_leaf'])
        self.assertEqual(m.link_issues(graph('../../escape'))[0]['code'], 'LINK_ESCAPE')
        self.assertEqual(m.link_issues(graph('link'))[0]['code'], 'LINK_CYCLE')

    def test_closed_internal_cross_tree_link_needs_real_directory_and_leaf(self):
        leaf = row('leaf'); leaf['inode'] = 55
        link = row('link', 'symlink'); link['target'] = '../harness/leaf'
        trees = [m.typed_tree([link],root()), m.typed_tree([leaf],root()),m.typed_tree([leaf],root())]
        self.assertEqual(m.link_issues(trees), [])
        m.closed_links(trees)

    def test_tree_keeps_actual_preimage_and_only_declared_metadata_postimage(self):
        rows = [row(), row('node_modules/example', 'symlink')]
        result = m.typed_tree(rows, root())
        e = result['entries'][rows[0]['path']]
        self.assertEqual((e['uid'], e['gid'], e['mode'], e['device'], e['inode']), (505,601,0o644,42,123))
        self.assertEqual((e['sha256'], e['post_gid'], e['post_mode']), ('a'*64,601,0o644))
        link = result['entries']['node_modules/example']
        self.assertEqual((link['kind'],link['link'],link['post_mode']),('link','../packages/example',0o555))
        self.assertEqual(result['root']['inode'],99)

    def test_missing_bytes_identity_or_unknown_kind_cannot_be_invented(self):
        for field in ['sha256','inode','device','nlink','uid','gid']:
            value = row();value.pop(field)
            with self.assertRaises(ValueError):m.typed_tree([value],root())
        value=row();value['kind']='socket'
        with self.assertRaises(ValueError):m.typed_tree([value],root())

    def test_duplicate_escaping_or_unhashable_rows_fail(self):
        with self.assertRaises(ValueError):m.typed_tree([row(),row()],root())
        for path in ['../escape','a//b','/absolute','a/../b']:
            with self.assertRaises(ValueError):m.typed_tree([row(path)],root())
        value=row();value['sha256']=None
        with self.assertRaises(ValueError):m.typed_tree([value],root())

    def test_final_face_changes_only_reviewed_stubs_and_two_mutable_slots(self):
        paths=['packages/broker/src/capabilities/workflow.js','packages/scheduler/src/watchdog/incident-lifecycle.js',
               'scripts/trusted-cp-deploy-install.sh','scripts/production-runtime-launchd.mjs',
               'deployment-artifacts/scheduler-watchdog-routing-v1/run-routing-install.mjs',
               'deployment-artifacts/scheduler-watchdog-routing-v1/run-authorized-transaction.sh','immutable.js']
        tree=m.typed_tree([row(p) for p in paths],root())
        before=copy.deepcopy(tree)
        slots=m.initial_files(tree,{'SHELL':b'fixture shell','JS':b'fixture js'})
        self.assertEqual(tree,before)
        self.assertEqual({s['path'] for s in slots if s['mutable']},set(paths[:2]))
        self.assertEqual(len(slots),len(paths))
        by={s['path']:s for s in slots}
        self.assertNotEqual(by[paths[2]]['sha256'],'a'*64)
        self.assertEqual(by['immutable.js']['sha256'],'a'*64)
        self.assertTrue(all(s['mode']==0o644 and s['gid']==601 for s in slots))

    def test_final_face_never_invents_missing_legacy_retirement_paths(self):
        paths = list(m.MUTABLE) + ['scripts/trusted-cp-deploy-install.sh', 'scripts/production-runtime-launchd.mjs']
        tree = m.typed_tree([row(p) for p in paths], root())
        slots = m.initial_files(tree, {'SHELL': b'shell', 'JS': b'js'})
        self.assertEqual({e['path'] for e in slots}, set(paths))

    def test_final_face_requires_actual_mutable_slots(self):
        with self.assertRaises(ValueError):m.initial_files(m.typed_tree([row()],root()),{'SHELL':b'x','JS':b'y'})

    def test_stub_bytes_are_extracted_from_exact_rust_literals(self):
        source=r'''pub(super) const SHELL:&[u8]=b"#!/bin/sh\nprintf '%s\\n' 'retired';\n";
        pub(super) const JS:&[u8]=b"process.exit(64);\n";'''
        stubs=m.stub_bytes(source)
        self.assertEqual(stubs['SHELL'],b"#!/bin/sh\nprintf '%s\\n' 'retired';\n")
        self.assertEqual(stubs['JS'],b'process.exit(64);\n')
        with self.assertRaises(ValueError):m.stub_bytes(source+source)


if __name__ == '__main__':unittest.main()
