"""coherent-v5 TDD fixtures — synthetic durable V3 store files (DATA ONLY).

Emits turn-recovery-v3.json-shaped files that are schema-valid under the
accepted-head validator (packages/agent-router/src/reconciliation/durable-file.js
@ ce8165a6) and carry the spec-conformant five-leaf `ingressCorrelation`
(COHERENT_DURABLE_INGRESS_RECEIPT_ATTRIBUTION_V1 §2/§3) plus a controllable
native `messageId` receipt. Pure test input construction — this module
implements no validation of its own.

Durable-form notes (serializer/writeDurableRecoveryStore): `state` carries the
RECOVERY state ('reserved'), `queryState` the query state ('pending'),
`fenceState` 'armed' — exactly a fresh C-010 reservation.
"""

import json
import os

FIXED_AGENT = 'agt_efficiency-agent'
OTHER_AGENT = 'agt_other-agent'
EPOCH = 'fx-ds-epoch'

FIVE_LEAF_TEMPLATE = {
    'channelNamespace': 'feishu',
    'channelConversationId': 'feishu:oc_fx_chat',
    'feishuConversationId': 'oc_fx_chat',
    'feishuMessageId': 'om_fx_message_1',
    'feishuSenderOpenId': 'ou_fx_owner',
}


def five_leaf(message_id='om_fx_message_1', sender='ou_fx_owner',
              conversation='oc_fx_chat'):
    return {
        'channelNamespace': 'feishu',
        'channelConversationId': f'feishu:{conversation}',
        'feishuConversationId': conversation,
        'feishuMessageId': message_id,
        'feishuSenderOpenId': sender,
    }


def v3_record(disc, agent_id, gen, seq, *, correlation=None,
              message_id=None, session_id='sess-fx'):
    """One fresh-reservation durable record (spec §3: correlation written once
    with the C-010 reservation; record.messageId is the native receipt)."""
    handle = f'turn:{EPOCH}:a{disc}:g{gen}:s{seq}'
    now = 1790000000000 + seq
    record = {
        'reconciliationHandle': handle,
        'handle': handle,
        'turnExecutionId': handle,
        'runtimeEpoch': EPOCH,
        'agentId': agent_id,
        'processGeneration': gen,
        'turnSeq': seq,
        'sessionId': session_id,
        'callerCorrelation': None,
        'createdAtWallMs': now,
        'createdAt': now,
        'updatedAt': now,
        'admitted': message_id is not None,
        'promptWriteAttempted': message_id is not None,
        'eventWatermarkSeq': None,
        'promptRequestId': None,
        'messageId': message_id,
        'deadlineAtWallMs': None,
        'initialOutcome': None,
        'initialSource': None,
        'outcome': None,
        'state': 'pending',
        'queryState': 'pending',
        'lateOutcome': None,
        'outcomeEvidence': None,
        'terminationEvidence': None,
        'settledAtWallMs': None,
        'cancelRequested': False,
        'cancelRequestedAtWallMs': None,
        'finalAssistantOutput': None,
        'finalAssistantOutputEvidence': None,
        'audit': [],
        'hardDeadlineAt': None,
        'recoveryState': 'reserved',
        'missingEvidence': [],
        'reapClaim': None,
        'attemptedActions': [],
        'shutdownRequestedAt': None,
        'exitObservedAt': None,
        'settlementResult': None,
        'failureReason': None,
        'nextSafeAction': 'none',
        'fenceState': 'armed',
        'reservedMandatoryBytes': 4096,
        'bytes': 0,
    }
    # state (durable form) is the RECOVERY state; the query state rides
    # queryState. Drop the in-memory duplicates the serializer would not emit.
    record['state'] = 'reserved'
    if correlation is not None:
        record['ingressCorrelation'] = correlation
    return record


def v3_store(records):
    """Assemble a complete durable store around the given records, deriving a
    consistent issuance table (one generation per agent, contiguous seqs)."""
    by_agent = {}
    for index, record in enumerate(records, start=1):
        record.setdefault('turnSeq', index)
        by_agent.setdefault(record['agentId'], []).append(record)
    issuance = []
    disc = 0
    for agent_id, agent_records in by_agent.items():
        disc += 1
        seqs = [record['turnSeq'] for record in agent_records]
        gen = agent_records[0]['processGeneration']
        issuance.append({
            'agentId': agent_id,
            'discriminator': disc,
            'maxIssuedTurnSeq': max(seqs),
            'evictedThroughTurnSeq': 0,
            'evictedSparseSeqs': [],
            'evictedThroughGeneration': 0,
            'evictedGenerations': [],
            'generations': [[gen, {'minSeq': min(seqs), 'maxSeq': max(seqs)}]],
        })
        for record in agent_records:
            record['runtimeEpoch'] = EPOCH
            handle = f'turn:{EPOCH}:a{disc}:g{gen}:s{record["turnSeq"]}'
            record['reconciliationHandle'] = handle
            record['handle'] = handle
            record['turnExecutionId'] = handle
    return {
        'version': 3,
        'runtimeEpoch': EPOCH,
        'runtimeEpochs': [EPOCH],
        'discriminatorSeq': disc,
        'records': records,
        'issuance': issuance,
        'correlationIndex': [],
    }


def write_store(path, store):
    with open(path, 'w', encoding='utf-8') as handle:
        handle.write(json.dumps(store, separators=(',', ':')) + '\n')
    os.chmod(path, 0o600)
