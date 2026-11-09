"""One validator for admission and every actual boundary; no stored authority fallback."""
import datetime as dt
import math
from .reader import DEFAULT_REGISTRY, require, seal, select, strict_json
from .policy import evidence, participants, scope, standard


def stamp(value):
    require(isinstance(value, str), '过期: UTC missing')
    try:
        parsed = dt.datetime.fromisoformat(value.replace('Z', '+00:00'))
        require(parsed.tzinfo is not None and parsed.utcoffset() == dt.timedelta(0), '过期: non-UTC')
        result = parsed.timestamp()
    except (ValueError, OverflowError, OSError):
        raise RuntimeError('过期: invalid UTC') from None
    require(math.isfinite(result), '过期: nonfinite UTC')
    return result


def equal_ref(declared, actual, keys, category):
    require(isinstance(declared, dict) and isinstance(actual, dict) and
            set(declared) == set(keys) and all(type(declared[k]) is type(actual.get(k)) and
            declared[k] == actual.get(k) for k in keys), category)


def validate(a, observation, current, requested=None, stage='admission', previous=None):
    require(isinstance(observation, dict), '未任命: trusted observation unavailable')
    require(type(current) in (int, float) and math.isfinite(current), '过期: clock UNKNOWN')
    query = observation['query']
    require(type(query.get('epoch')) is int and query['epoch'] >= 0 and
            isinstance(query.get('revision'), str) and query['revision'] and
            query.get('complete') is True and query.get('pagesRead') == query.get('pagesTotal') and
            type(query.get('pagesRead')) is int and query['pagesRead'] > 0,
            '撤销: lifecycle freshness/completeness UNKNOWN')
    at = stamp(query.get('at'))
    lease = stamp(query.get('leaseUntil'))
    require(at <= current < lease <= at + 300, '撤销: stale/currentness UNKNOWN')
    if previous is not None:
        require(query['epoch'] >= previous['epoch'] and at >= previous['at'] and
                current >= previous['current'], '撤销: epoch/clock rollback')
        require(query['epoch'] != previous['epoch'] or query['revision'] == previous['revision'],
                '撤销: revision changed without generation')
    require(observation.get('source') == str(DEFAULT_REGISTRY), '未任命: registry source not admitted')
    registry = strict_json(observation['registryBytes'])
    sra = observation['sra']
    equal_ref(a.get('sraRef'), sra, ('specId', 'acceptedCommit', 'path', 'blob', 'sha256', 'effectivenessRef'),
              '候选漂移: SRA revision/receipt binding')
    require(sra['specId'] == 'AGENT_CORE_STANDING_RELEASE_AUTHORIZATION_V1' and
            sra.get('acceptedInMain') is True and sra.get('applicable') is True,
            '未任命: accepted SRA/main proof missing')
    evidence(observation, sra['effectivenessRef'], sra['acceptedCommit'])
    issuer = observation['issuer']
    equal_ref(a.get('issuerRef'), issuer,
              ('principal', 'session', 'authoritySource', 'selector', 'canonicalSha256'),
              '未任命: issuer provenance')
    require(issuer.get('authorized') is True and issuer['authoritySource'] == str(DEFAULT_REGISTRY),
            '未任命: issuer not authorized')
    require(seal(select(registry, issuer['selector'])) == issuer['canonicalSha256'], '未任命: issuer hash')
    ref = a.get('appointmentRef')
    require(isinstance(ref, dict) and ref.get('source') == str(DEFAULT_REGISTRY), '未任命: appointment source')
    record = select(registry, ref.get('selector', ''))
    require(seal(record) == ref.get('canonicalSha256'), '未任命: appointment canonical hash')
    equal_ref(ref, dict(record, source=str(DEFAULT_REGISTRY), selector=ref['selector'],
                        canonicalSha256=seal(record), appointmentId=record.get('id')),
              ('source', 'selector', 'canonicalSha256', 'appointmentId', 'lifecycleState', 'revision', 'lifecycleRef'),
              '未任命: appointment identity/schema/lifecycle binding')
    require(all(isinstance(record.get(key), str) and record[key] for key in
                ('id', 'principal', 'session', 'issuer', 'lifecycleState', 'lifecycleRef')) and
            stamp(record.get('validFrom')) < stamp(record.get('validUntil')), '未任命: appointment schema')
    grantor = observation['appointmentIssuer']
    require(type(record.get('revision')) is int and isinstance(record.get('principal'), str) and
            isinstance(record.get('session'), str) and grantor.get('authorized') is True and
            record.get('issuer') == grantor.get('principal') != record['principal'],
            '未任命: appointment schema/original grantor chain')
    require(grantor.get('source') == str(DEFAULT_REGISTRY) and
            seal(select(registry, grantor.get('selector', ''))) == grantor.get('canonicalSha256'),
            '未任命: original appointment issuer proof')
    require(record['principal'] == issuer['principal'], '未任命: signer not appointed Captain')
    life = observation['lifecycle']
    require(life.get('appointmentId') == record['id'] and life.get('complete') is True and
            type(life.get('revision')) is int and life['revision'] >= record['revision'] and
            life.get('authorizedBy') == grantor['principal'] and stamp(life.get('effectiveAt')) <= current,
            '撤销: current authorized lifecycle missing')
    if previous is not None:
        require(life['revision'] >= previous['appointmentRevision'], '撤销: lifecycle revision rollback')
        require(life['revision'] != previous['appointmentRevision'] or
                seal(life) == previous['lifecycleSha256'], '撤销: lifecycle changed without revision')
    require(record['lifecycleState'] == 'ACTIVE' and life.get('state') == 'ACTIVE',
            '撤销: appointment not effective/revoked/replaced')
    # Current narrowing/renewal is external lifecycle evidence, not the historic hash.
    appointment = dict(record, scope=life['scope'], validFrom=life['validFrom'], validUntil=life['validUntil'])
    start = max(stamp(a.get('valid_from')), stamp(appointment.get('validFrom')))
    end = min(stamp(a.get('valid_until')), stamp(appointment.get('validUntil')))
    require(start < end and start <= current < end, '过期: outside window/appointment UTC intersection')
    caller = observation['caller']
    equal_ref(a.get('callerRef'), caller, ('principal', 'session', 'uid', 'continuityRef'), '未任命: caller mismatch')
    require(caller.get('relation') == 'PROCESS_EXTERNAL' and type(caller.get('uid')) is int and
            caller['uid'] == a['writer_uid'] != 0, '未任命: real caller relation UNKNOWN')
    original_caller = observation['mandate']['callerRef']
    require(caller['principal'] == original_caller.get('principal') and
            a.get('attempt') == observation['mandate'].get('attempt'), '未任命: caller/attempt binding')
    if caller['session'] != original_caller.get('session'):
        proof = evidence(observation, caller['continuityRef'], a['window_id'])
        require(proof.get('from') == original_caller['session'] and proof.get('to') == caller['session'] and
                proof.get('principal') == caller['principal'] and proof.get('attempt') == a['attempt'],
                '未任命: cross-session continuity UNKNOWN')
    captain = a['participants']['C']
    require(captain.get('principal') == record['principal'] and captain.get('session') == issuer['session'],
            '未任命: Captain appointment/signer identity')
    if captain.get('session') != record['session']:
        proof = evidence(observation, observation.get('captainContinuityRef'), record['id'])
        require(proof.get('from') == record['session'] and proof.get('to') == captain.get('session') and
                proof.get('principal') == record['principal'], '未任命: Captain continuity UNKNOWN')
    require(observation['mandate'].get('sha256') == seal(a), '未任命: Mandate not authenticated')
    require(observation['candidateRef'] == a.get('candidateRef') and
            observation['controlVersion'] == a.get('controlVersion'), '候选漂移: candidate/control version')
    participants(a, observation, caller)
    scope(a, appointment, observation, requested)
    standard(a, observation, stage)
    if stage in ('mutex.release', 'mutex.holder.unlink', 'mutex.rmdir'):
        terminal = evidence(observation, observation.get('safeTerminalRef'), a['window_id'])
        require(terminal.get('ownedEffectsTerminal') is True and terminal.get('unknownChildren') == [],
                '缺门: owned child/effects termination UNKNOWN')
    return {'epoch': query['epoch'], 'revision': query['revision'], 'at': at, 'current': current,
            'selector': ref['selector'], 'canonicalSha256': seal(record), 'stage': stage,
            'appointmentRevision': life['revision'], 'lifecycleSha256': seal(life),
            'source': observation['source']}
