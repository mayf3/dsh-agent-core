"""Finite R35 verifier derivation from exact b530; no I/O or operation selection."""
import ast, hashlib, re
BASE_SHA='b530737dde4e7d250302aed96660bea84a03d2d636c6eab42f54eaba155876e5'
sha=lambda b:hashlib.sha256(b).hexdigest()
def need(v,why):
 if not v:raise ValueError(why)
INVERSE_HELPERS=r'''
# BEGIN FIXED R35 SUCCESSOR EXACT INVERSES
R35_CONTEXT = __CONTEXT__
def r35_source_proofs(execution, previous, codec, oldcodec):
    try:
        if dig(previous.encode()) != 'c901aabdbc385230e553e0dd051e463c95bf770e857e4152c73e39702c209818' or dig(oldcodec.encode()) != '6a18dd2bd09edd2973631a5546481b5a6ed2adde4b6a0a5d0de0ab135abcdf8d':
            return False
        nodes = [n for c in ast.parse(previous).body if isinstance(c, ast.ClassDef) and c.name == 'Execution' for n in c.body if isinstance(n, ast.FunctionDef) and n.name == 'r34_pre_intent_checkpoint']
        if len(nodes) != 1:
            return False
        n = nodes[0]
        method = ''.join(previous.splitlines(keepends=True)[n.lineno-1:n.end_lineno])
        subject = "op=='b7-packet-r34-1cfeff2a5b138629-e35'"
        if method.count(subject) != 1:
            return False
        added_method = method.replace('def r34_pre_intent_checkpoint(', 'def r35_pre_intent_checkpoint(', 1).replace(subject, 'op=='+repr(R35_CONTEXT['operation']), 1).replace('fixed_r34_pre_intent_worker', 'fixed_r35_pre_intent_worker', 1)
        anchor = ' def execute(self,r,peer):\n'
        gate = "     if reg['binding']['packetId']=='b7-native-execution-r34-c71fd2cc':self.r34_pre_intent_checkpoint(op,p)\n"
        added = "     if reg['binding']['packetId']=='b7-native-execution-r35-c71fd2cc':self.r35_pre_intent_checkpoint(op,p)\n"
        if previous.count(anchor) != 1 or previous.count(gate) != 1:
            return False
        expected = previous.replace(anchor, added_method+anchor, 1).replace(gate, gate+added, 1)
        return (execution == expected and dig(execution.encode()) == R35_CONTEXT['execution_sha256']
                and oldcodec.count('b7-native-execution-r34-c71fd2cc') == 2
                and codec == oldcodec.replace('b7-native-execution-r34-c71fd2cc', 'b7-native-execution-r35-c71fd2cc')
                and dig(codec.encode()) == R35_CONTEXT['codec_sha256'])
    except (ValueError, TypeError, KeyError, SyntaxError):
        return False

def r35_pair_previous(raw, preimage, methods, original_source, new_source):
    """Undo only the one ASCII source seal and two exact derived policy rows."""
    try:
        text = raw.decode('utf-8')
        calls = [n for n in ast.walk(ast.parse(text)) if isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id == 'compile' and n.args and isinstance(n.args[0], ast.Constant) and n.args[0].value == new_source]
        if len(calls) != 1 or ast.get_source_segment(text, calls[0].args[0]) != ascii(new_source):
            return None
        literal = ascii(new_source)
        # Replace the exact AST-selected span, never an earlier nested string.
        n = calls[0].args[0]
        if n.lineno != n.end_lineno:
            return None
        lines = text.splitlines(keepends=True)
        line = lines[n.lineno-1]
        if line[n.col_offset:n.end_col_offset] != literal:
            return None
        lines[n.lineno-1] = line[:n.col_offset]+ascii(original_source)+line[n.end_col_offset:]
        text = ''.join(lines)
        changes, seen = [], set()
        key, oldkey = 'b7-native-execution-r35-c71fd2cc', 'b7-native-execution-r34-c71fd2cc'
        for node in ast.walk(ast.parse(text)):
            if not (isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr in methods):
                continue
            for arg in node.args:
                if not isinstance(arg, ast.Dict):
                    continue
                value = ast.literal_eval(arg)
                if key not in value.get('packets', {}):
                    continue
                method = node.func.attr
                if method in seen or oldkey not in value['packets'] or arg.lineno != arg.end_lineno:
                    return None
                seen.add(method)
                expected = copy.deepcopy(value['packets'][oldkey])
                expected['manifestSha256'] = M12
                expected['reason'] = 'B7_COHERENT_CANDIDATE_R35_ORIGINAL_GUARDS_REQUIRED'
                if method == 'install_execution_hooks':
                    expected.update(files=copy.deepcopy(packet['files']), manifestPath='/private/var/db/agent-deploy-system/inputs/b7-install-r35/packet/PACKET.json', snapshotRoot=packet['snapshotRoot'], stageArgv=['/usr/bin/python3', packet['snapshotRoot']+'/stage-seed-once.py'])
                    expected['terminalBinding']['toolSha256'] = 'db45db7230ec25015321081f8c9c1357355c61df517d8f6392924fd7ce06f55f'
                else:
                    expected['sourceSha256'] = facts['WORKER']
                if value['packets'][key] != expected:
                    return None
                before = ast.get_source_segment(text, arg)
                if before != repr(value):
                    return None
                del value['packets'][key]
                changes.append((arg.lineno, arg.col_offset, arg.end_col_offset, before, repr(value)))
        if seen != set(methods) or len(changes) != 2:
            return None
        lines = text.splitlines(keepends=True)
        for lineno, start, end, before, after in sorted(changes, reverse=True):
            if lines[lineno-1][start:end] != before:
                return None
            lines[lineno-1] = lines[lineno-1][:start]+after+lines[lineno-1][end:]
        inverse = ''.join(lines).encode()
        return inverse if inverse == preimage else None
    except (ValueError, TypeError, KeyError, SyntaxError, UnicodeError):
        return None

def r35_executor_previous(raw):
    if raw.count(b'b7-install-r35') != 15:
        return None
    original = raw.replace(b'b7-install-r35', b'b7-install-r34')
    return original if dig(original) == '74110415b30bd81572d50e6c53d2e1129052521700a8ef951adfc1d557b4b903' else None
# END FIXED R35 SUCCESSOR EXACT INVERSES
'''
SETUP=r'''
old_codec = sealed_modules((PREIMAGE/'ds_client.py').read_bytes()).get('<sealed-b7_ds_execution_client.py>', '')
r35_codec = sealed_modules(cli).get('<sealed-b7_ds_execution_client.py>', '')
r35_source_ok = r35_source_proofs(execution, previous_execution, r35_codec, old_codec)
r35_server_previous = r35_pair_previous(srv, (PREIMAGE/'deployment_system.py').read_bytes(), ('install_hooks','install_execution_hooks'), previous_execution, execution) if r35_source_ok else None
r35_client_previous = r35_pair_previous(cli, (PREIMAGE/'ds_client.py').read_bytes(), ('install_client_hooks','install_owner_cli'), old_codec, r35_codec) if r35_source_ok else None
check('fixed R35 subject and source exact inverse', r35_source_ok and M12 == R35_CONTEXT['manifest_sha256'] and facts['WORKER'] == R35_CONTEXT['worker_sha256'] and facts['next_b7_operation'] == R35_CONTEXT['operation'])
check('R35 four policy rows and two ASCII seals whole inverse to actual loaded pair', r35_server_previous is not None and r35_client_previous is not None and dig(r35_server_previous) == '4192c80eb839f3097a3c0b2a8adb9183f51faa033dd7342fc6ad072528c20647' and dig(r35_client_previous) == '9ebd00ed4f9e01d5e6f999e2e0de86f56cea80a70d6633e5ffffef7dfd512c67')
check('R35 completed original retirement and placement joins',
      sha(HERE/'v50_prepare_inputs.py') == '6ccbabfd57ba90f5c436c77cf8159aa5d204ff722e0c5cc75c33c718953dda31'
      and sha(HERE/'e35_finished_for_r35.py') == '473a636287f3b064a0d57a3f10033b307bca1996d0c390f3517e8bba634ed52b'
      and json.loads((HERE/'v50-input-preparation.json').read_bytes()) == dict(source_package='b7-install-r35', input_path='/private/var/db/agent-deploy-system/inputs/b7-install-r35', new_input_tree_sha256=R35_CONTEXT['tree_sha256'], fixed_e35_successor=R35_CONTEXT['finished_binding']))
check('R35 independent cohort review required', re.fullmatch('[a-f0-9]{64}', str(authority.get('review_receipts',{}).get('r35_cohort'))) is not None)
'''
def build_verifier(base,context):
 need(sha(base)==BASE_SHA,'exact b530 verifier preimage required')
 keys={'operation','manifest_sha256','worker_sha256','execution_sha256','codec_sha256','tree_sha256','finished_binding'}
 need(type(context) is dict and set(context)==keys,'actual verifier context required')
 need(all(type(context[k]) is str and re.fullmatch('[a-f0-9]{64}',context[k]) for k in keys-{'operation','finished_binding'}),'actual verifier hashes required')
 need(type(context['operation']) is str and re.fullmatch('b7-packet-r35-'+context['manifest_sha256'][:16]+'-e[0-9]+',context['operation']),'Root actual operation binding required')
 need(type(context['finished_binding']) is dict and context['finished_binding'].get('kind')=='B7_FIXED_E35_FINISHED_FOR_R35_V1','actual FINISHED binding required')
 text=base.decode();changes=[]
 def replace(old,new):
  nonlocal text
  need(text.count(old)==1,'unique exact verifier span: '+old[:70]);offset=text.index(old);text=text[:offset]+new+text[offset+len(old):];changes.append((offset,old,new))
 replace("R30 = (HERE / 'b7-install-r34') if (HERE / 'b7-install-r34').exists() else (P.parent / 'b7-install-r34')", "R30 = (HERE / 'b7-install-r35') if (HERE / 'b7-install-r35').exists() else (P.parent / 'b7-install-r35')")
 replace("PACKET_ID = 'b7-native-execution-r34-c71fd2cc'", "PACKET_ID = 'b7-native-execution-r35-c71fd2cc'")
 replace("check('exec manifestPath==r34', row['manifestPath'] == '/private/var/db/agent-deploy-system/inputs/b7-install-r34/packet/PACKET.json')", "check('exec manifestPath==r35', row['manifestPath'] == '/private/var/db/agent-deploy-system/inputs/b7-install-r35/packet/PACKET.json')")
 # Define finite inverse helpers before the unchanged source-family checks.
 anchor="seal_srv = sealed_modules(srv)\n"
 replace(anchor,INVERSE_HELPERS.replace('__CONTEXT__',repr(context))+'\n'+anchor)
 # Existing preservation check normalizes only the reviewed execution addition.
 replace("if name not in ('<sealed-b7_e35_recovery.py>', '<sealed-b7_e35_publication.py>')", "if name not in ('<sealed-b7_e35_recovery.py>', '<sealed-b7_e35_publication.py>', '<sealed-b7_ds_execution.py>')")
 anchor="previous_execution = seal_pre.get('<sealed-b7_ds_execution.py>', '')\n"
 replace(anchor,anchor+SETUP)
 replace("and dig((PREIMAGE / 'deployment_system.py').read_bytes()) == 'f93609e70db39ef87ca6013c6ccb944b11a568a772848b65f84d3c095b7224de'", "and dig((PREIMAGE / 'deployment_system.py').read_bytes()) == '4192c80eb839f3097a3c0b2a8adb9183f51faa033dd7342fc6ad072528c20647'")
 replace("dig(execution.encode()) == R34_EXECUTION_SHA\n      and (HERE / 'v53_r34_execution_source.py').read_text() == execution", "dig(previous_execution.encode()) == R34_EXECUTION_SHA and r35_source_ok\n      and (HERE / 'v53_r34_execution_source.py').read_text() == execution")
 replace("check('original R34 execution byte unchanged',execution==previous_execution)", "check('original R34 execution byte unchanged after exact R35 inverse',r35_source_ok)")
 replace("srv.count(extension)==1 and srv.count(new_fallback)==1 and old_fallback not in srv\n      and srv.replace(extension,previous_extension,1)==(PREIMAGE/'deployment_system.py').read_bytes()", "r35_server_previous is not None and r35_server_previous.count(extension)==1 and r35_server_previous.count(new_fallback)==1 and old_fallback not in r35_server_previous\n      and r35_server_previous.replace(extension,previous_extension,1)==(PREIMAGE/'deployment_system.py').read_bytes()")
 replace("cli==(PREIMAGE/'ds_client.py').read_bytes() and dig(cli)=='9ebd00ed4f9e01d5e6f999e2e0de86f56cea80a70d6633e5ffffef7dfd512c67'", "r35_client_previous==(PREIMAGE/'ds_client.py').read_bytes() and r35_client_previous is not None and dig(r35_client_previous)=='9ebd00ed4f9e01d5e6f999e2e0de86f56cea80a70d6633e5ffffef7dfd512c67'")
 anchor="executor_raw=(HERE/'b7-release-executor.sh').read_bytes()\n"
 replace(anchor,anchor+"r35_executor_preimage = r35_executor_previous(executor_raw)\ncheck('R35 executor only fixed package coordinates inverse to actual e35-retire executor', r35_executor_preimage is not None)\nexecutor_raw = r35_executor_preimage if r35_executor_preimage is not None else b''\n")
 replace("retire_cp_base_raw=(STAGE/'checkpoint-inputs.json').read_bytes();retire_cp_base=json.loads(retire_cp_base_raw)", "retire_cp_base_raw=(HERE/'e35-retirement-checkpoint-preimage.json').read_bytes();retire_cp_base=json.loads(retire_cp_base_raw)")
 replace("facts['next_b7_operation'].endswith('-e35')", "facts['next_b7_operation'] == R35_CONTEXT['operation']")
 result=text.encode();compile(result,'verify-chain-v50.py','exec')
 inverse=text
 for offset,old,new in reversed(changes):
  need(inverse[offset:offset+len(new)]==new,'exact inverse span');inverse=inverse[:offset]+old+inverse[offset+len(new):]
 need(inverse.encode()==base,'verifier whole-byte inverse b530')
 return result,changes
