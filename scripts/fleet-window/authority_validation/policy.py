"""Exact effect, standard-class, and evidence consumers (observations are external)."""
from .reader import canonical, require, seal

EXCLUSIONS = (
    'pauseAfterBootstrap', 'newSemantics', 'dangerousMigration', 'privilegeExpansion',
    'crossDomain', 'firstRuntimeOrTarget', 'controllerOrProfileOrTrustRootOrSetuid',
    'runtimeIdentityOrAuthentication', 'nodeArchitecture', 'unsafeRollback', 'majorRisk',
)
EFFECT_KEYS = {'repo', 'host', 'runtime', 'domain', 'label', 'operation', 'target', 'parameters'}


def effects(rows):
    require(isinstance(rows, list), '越界: effects list missing')
    for row in rows:
        require(isinstance(row, dict) and set(row) == EFFECT_KEYS, '越界: unclassified effect')
        require(all(isinstance(row[k], str) and row[k] and '*' not in row[k]
                    for k in EFFECT_KEYS - {'parameters'}), '越界: wildcard/unknown effect coordinate')
        require(isinstance(row['parameters'], (dict, list)), '越界: effect parameters missing')
        canonical(row)
    return {canonical(row) for row in rows}


def evidence(observation, ref, subject):
    require(isinstance(ref, str) and ref, '缺门: evidence reference missing')
    item = observation['evidence'].get(ref)
    require(isinstance(item, dict) and item.get('state') == 'VERIFIED' and
            item.get('subject') == subject and isinstance(item.get('source'), str) and
            bool(item['source']) and isinstance(item.get('revision'), str) and bool(item['revision']),
            '缺门: current attributable evidence unavailable')
    return item


def standard(a, observation, stage):
    require(a.get('releaseClass') == 'STANDARD_RECOVERABLE', '越界: release class')
    criteria = a.get('standardCriteria')
    require(isinstance(criteria, list) and len(criteria) == 5, '缺门: five criteria required')
    for index, criterion in enumerate(criteria, 1):
        require(isinstance(criterion, dict) and criterion.get('id') == index and
                criterion.get('state') == 'VERIFIED', '缺门: standard criterion not verified')
        item = evidence(observation, criterion.get('evidenceRef'), a['candidateRef'])
        require(item.get('criterion') == index and item.get('value') is True,
                '缺门: standard criterion unsupported')
    exclusions = a.get('exclusions')
    require(isinstance(exclusions, dict) and set(exclusions) == set(EXCLUSIONS),
            '越界: exclusions incomplete')
    for name in EXCLUSIONS:
        item = exclusions[name]
        require(isinstance(item, dict) and item.get('value') is False, '越界: excluded/UNKNOWN release')
        proof = evidence(observation, item.get('evidenceRef'), a['candidateRef'])
        require(proof.get('exclusion') == name and proof.get('value') is False,
                '越界: exclusion unverified')
    future = a.get('stageRequirements')
    require(isinstance(future, dict) and 'runtime.bootstrap' in future and
            'installer.execute' in future, '缺门: enforceable future-stage recipe missing')
    for boundary, item in future.items():
        require(isinstance(item, dict) and item.get('state') == 'REQUIRED_AT_STAGE' and
                item.get('failureExit') == 'STOP', '缺门: future fact must not be prefilled PASS')
        evidence(observation, item.get('recipeRef'), a['candidateRef'])
        if boundary == stage:
            evidence(observation, item.get('actualRef'), a['candidateRef'])


def scope(a, appointment, observation, requested):
    declared = effects(a.get('requestedEffects'))
    permitted = effects(appointment.get('scope'))
    mandate = effects(observation['mandate']['scope'])
    profile = observation['profile']
    require(profile.get('state') == 'ADMITTED' and profile.get('version') == a.get('profileRef'),
            '越界: profile not admitted/version drift')
    admitted = effects(profile.get('effects'))
    require(declared and declared <= permitted & mandate & admitted, '越界: effect outside intersection')
    if requested is not None:
        require(effects([requested]) <= declared & permitted & mandate & admitted,
                '越界: actual operation/arguments drift')


def participants(a, observation, caller):
    roles = a.get('participants')
    require(isinstance(roles, dict) and set(roles) == {'A', 'W', 'V', 'C'} and
            isinstance(roles['A'], list) and roles['A'], '未任命: complete A/W/V/C required')
    normalized = {}
    for role in ('A', 'W', 'V', 'C'):
        rows = roles[role] if role == 'A' else [roles[role]]
        actors = []
        for row in rows:
            require(isinstance(row, dict) and all(isinstance(row.get(k), str) and row[k]
                    for k in ('principal', 'session', 'roleRef')), '未任命: participant identity')
            proof = observation['actors'].get(row['roleRef'])
            require(isinstance(proof, dict) and proof.get('principal') == row['principal'] and
                    proof.get('session') == row['session'] and role in proof.get('roles', []) and
                    isinstance(proof.get('actor'), str) and proof['actor'], '未任命: role provenance UNKNOWN')
            actors.extend(('actor:'+proof['actor'], 'principal:'+row['principal']))
        normalized[role] = actors
    require(roles == observation['mandate'].get('participants'), '未任命: omitted substantive author')
    policy = observation['rolePolicy']
    mandatory = {'C-A', 'C-W', 'C-V', 'W-V', 'A-V'}
    require(isinstance(policy, dict) and mandatory <= set(policy) and 'A-W' in policy,
            '未任命: independence policy UNKNOWN')
    require(a.get('conflictMatrix') == policy, '未任命: conflict matrix mismatch')
    for pair, forbidden in policy.items():
        require(pair in mandatory | {'A-W'} and type(forbidden) is bool,
                '未任命: independence policy UNKNOWN')
        if pair in mandatory:
            require(forbidden, '未任命: required independence missing')
        left, right = pair.split('-')
        if forbidden:
            require(not set(normalized[left]) & set(normalized[right]), '未任命: actor role conflict')
    writer = roles['W']
    require(caller['principal'] == writer['principal'], '未任命: caller is not writer')
