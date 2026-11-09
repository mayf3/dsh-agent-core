"""Isolated external observation fixture. This provider is never a runtime adapter."""
from copy import deepcopy
import json
import os
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(HERE))
from authority_validation.reader import DEFAULT_REGISTRY, seal
from authority_validation.policy import EXCLUSIONS
from authority_validation.checks import stamp

BASE = '417cc8ee6e7ef9a5e840e900a11c30fe58d648da'
AUTHOR_BASE = '5f3133dd08dc6529279ab8adf6ba7aacac1e2fd7'
AUTHOR_HEAD = 'f3e8340af50ae74b34612704fa1c970a31980ad0'
SPEC = 'docs/specs/AGENT_CORE_FLEET_WINDOW_AUTHORITY_VALIDATION_V1.md'
WHEN = '2026-11-09T12:00:00Z'
CURRENT = stamp(WHEN)
SOURCE = str(DEFAULT_REGISTRY)


def effect(operation='fixture.write', target='/tmp/fwav-fixture/item', parameters=None):
    return {'repo': 'mayf3/dsh-agent-core', 'host': os.uname().nodename,
            'runtime': '/usr/local/libexec/agent-core', 'domain': 'system',
            'label': 'ai.agent-core.runtime', 'operation': operation, 'target': str(target),
            'parameters': {} if parameters is None else parameters}


def fixture(effect_rows=None):
    requested = deepcopy(effect_rows or [effect()])
    roles = {'A': [{'principal': 'author', 'session': 'sa', 'roleRef': 'role:A'}],
             'W': {'principal': 'writer', 'session': 'sw', 'roleRef': 'role:W'},
             'V': {'principal': 'verifier', 'session': 'sv', 'roleRef': 'role:V'},
             'C': {'principal': 'captain', 'session': 'sc', 'roleRef': 'role:C'}}
    policy = {'C-A': True, 'C-W': True, 'C-V': True, 'W-V': True, 'A-V': True, 'A-W': False}
    sra = {'specId': 'AGENT_CORE_STANDING_RELEASE_AUTHORIZATION_V1', 'acceptedCommit': 'a' * 40,
           'path': 'docs/specs/AGENT_CORE_STANDING_RELEASE_AUTHORIZATION_V1.md',
           'blob': 'b' * 40, 'sha256': 'c' * 64, 'effectivenessRef': 'EVD:effective',
           'acceptedInMain': True, 'applicable': True}
    issuer_record = {'id': 'captain-signing', 'principal': 'captain', 'session': 'sc', 'role': 'Captain'}
    grantor_record = {'id': 'owner-grant', 'principal': 'owner', 'role': 'Owner'}
    record = {'id': 'appointment-1', 'principal': 'captain', 'session': 'sc', 'issuer': 'owner',
              'lifecycleState': 'ACTIVE', 'revision': 1, 'lifecycleRef': 'lifecycle:1',
              'validFrom': '2026-11-09T11:00:00Z', 'validUntil': '2026-11-09T13:00:00Z',
              'scope': deepcopy(requested)}
    issuer = {'principal': 'captain', 'session': 'sc', 'authoritySource': SOURCE,
              'selector': '$.rulings[id=captain-signing]', 'canonicalSha256': seal(issuer_record),
              'authorized': True}
    grantor = {'source': SOURCE, 'principal': 'owner', 'session': 'owner-session', 'authoritySource': SOURCE,
               'selector': '$.rulings[id=owner-grant]', 'canonicalSha256': seal(grantor_record),
               'authorized': True}
    caller = {'principal': 'writer', 'session': 'sw', 'uid': os.getuid() or 502,
              'continuityRef': 'EVD:writer-continuity', 'relation': 'PROCESS_EXTERNAL'}
    evidence = {}
    def ev(ref, subject, **values):
        evidence[ref] = {'state': 'VERIFIED', 'subject': subject, 'source': 'fixture:original-chain',
                         'revision': 'fixture-r1', **values}
    ev('EVD:effective', sra['acceptedCommit'], at='2026-11-09T10:00:00Z')
    ev('EVD:writer-continuity', record['id'], **{'from': 'sw', 'to': 'sw', 'principal': 'writer', 'attempt': 1})
    ev('EVD:captain-continuity', record['id'], **{'from': 'sc', 'to': 'sc', 'principal': 'captain', 'attempt': 1})
    for index in range(1, 6):
        ev('EVD:criterion:' + str(index), 'candidate:one', criterion=index, value=True)
    for name in EXCLUSIONS:
        ev('EVD:exclusion:' + name, 'candidate:one', exclusion=name, value=False)
    for name in ('runtime.bootstrap', 'installer.execute'):
        ev('EVD:recipe:' + name, 'candidate:one', gate=name, enforced=True)
        ev('EVD:actual:' + name, 'candidate:one', gate=name, current=True)
    ev('EVD:terminal', 'fixture-window', ownedEffectsTerminal=True, unknownChildren=[])
    a = {'window_id': 'fixture-window', 'writer': 'writer', 'writer_uid': caller['uid'],
         'valid_from': '2026-11-09T11:30:00Z', 'valid_until': '2026-11-09T12:30:00Z',
         'expected_old_pid': 1, 'expected_old_identity': 'ISOLATED_NOT_A_PROCESS',
         'expected_old_sha': '23fb91a690b0a7182ae3ae4bc388c4e3679d4cc9',
         'expected_plist_sha256': '0' * 64, 'expected_harness_stamp': 'fixture-harness',
         'expected_bindings_sha256': '1' * 64, 'expected_runtime_uid': caller['uid'],
         'expected_runtime_gid': os.getgid(), 'scopes': ['source_lockfile_cleanup', 'production_mutex',
             'bootout', 'full_preimage', 'install', 'plist_deployed_sha_only', 'bootstrap', 'verify', 'hr_observe'],
         'attempt': 1, 'sraRef': {k: sra[k] for k in ('specId', 'acceptedCommit', 'path', 'blob', 'sha256', 'effectivenessRef')},
         'issuerRef': {k: issuer[k] for k in ('principal', 'session', 'authoritySource', 'selector', 'canonicalSha256')},
         'appointmentRef': {'source': SOURCE, 'selector': '$.appointments[id=appointment-1]',
             'canonicalSha256': seal(record), 'appointmentId': record['id'],
             'lifecycleState': record['lifecycleState'], 'revision': record['revision'], 'lifecycleRef': record['lifecycleRef']},
         'callerRef': {k: caller[k] for k in ('principal', 'session', 'uid', 'continuityRef')},
         'participants': roles, 'conflictMatrix': policy, 'requestedEffects': deepcopy(requested),
         'candidateRef': 'candidate:one', 'controlVersion': 'control:one', 'profileRef': 'profile:one',
         'releaseClass': 'STANDARD_RECOVERABLE', 'standardCriteria': [
             {'id': index, 'state': 'VERIFIED', 'evidenceRef': 'EVD:criterion:' + str(index)} for index in range(1, 6)],
         'exclusions': {name: {'value': False, 'evidenceRef': 'EVD:exclusion:' + name} for name in EXCLUSIONS},
         'stageRequirements': {name: {'state': 'REQUIRED_AT_STAGE', 'failureExit': 'STOP',
             'recipeRef': 'EVD:recipe:' + name, 'actualRef': 'EVD:actual:' + name}
             for name in ('runtime.bootstrap', 'installer.execute')}}
    obs = {'source': SOURCE, 'registryBytes': json.dumps({'rulings': [issuer_record, grantor_record],
                'appointments': [record]}),
           'query': {'epoch': 1, 'revision': 'registry-r1', 'at': '2026-11-09T11:59:59Z',
                'leaseUntil': '2026-11-09T12:04:59Z', 'complete': True, 'pagesRead': 2, 'pagesTotal': 2},
           'sra': sra, 'issuer': issuer, 'appointmentIssuer': grantor,
           'lifecycle': {'appointmentId': record['id'], 'revision': 1, 'state': 'ACTIVE',
                'complete': True, 'authorizedBy': 'owner', 'effectiveAt': '2026-11-09T11:00:00Z',
                'scope': deepcopy(requested), 'validFrom': record['validFrom'], 'validUntil': record['validUntil']},
           'caller': caller, 'callerBaseline': deepcopy(caller),
           'mandate': {'sha256': seal(a), 'scope': deepcopy(requested), 'participants': deepcopy(roles),
                'callerRef': deepcopy(a['callerRef']), 'attempt': 1},
           'candidateRef': a['candidateRef'], 'controlVersion': a['controlVersion'],
           'profile': {'state': 'ADMITTED', 'version': a['profileRef'], 'effects': deepcopy(requested)},
           'actors': {row['roleRef']: {'principal': row['principal'], 'session': row['session'],
                'actor': row['principal'], 'roles': [role]} for role in roles
                for row in (roles[role] if role == 'A' else [roles[role]])},
           'rolePolicy': deepcopy(policy), 'evidence': evidence, 'safeTerminalRef': 'EVD:terminal'}
    return a, obs


def authenticate(a, observation):
    """External fixture authority issued this exact input, for semantic negative cases."""
    observation['mandate']['sha256'] = seal(a)
    return a, observation


class FixtureReader:
    def __init__(self, observation):
        self.observation = observation
        self.calls = 0
        self.before_read = None

    def observe(self):
        self.calls += 1
        if self.before_read:
            self.before_read(self.calls, self.observation)
        return deepcopy(self.observation)
