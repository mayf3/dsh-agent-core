# Embedded inside the existing DS; no imports from user-controlled paths.
HR_CTO_ACTION = 'HR_CTO_OWNER_SENDER_HASH_READBACK_V1'
HR_CTO_READ_ID = 'hr-cto-owner-read-20260928-54b0945f'
# Future reviewed one-off packet must bind the genuine native-ID request.
# Not an environment variable, caller digest, link token, or default identity.
HR_CTO_REQUEST_SHA256 = None


def hr_cto_hash_readback(request, peer, raw):
    """One fixed Owner read. Every outbound error is a bounded static code."""
    ledger = None
    try:
        require(peer == AUTHORIZED_OWNER_UID == 502, 'PEER_UNAUTHORIZED')

        def unique_pairs(items):
            parsed = {}
            for key, value in items:
                require(key not in parsed, 'HR_CTO_DUPLICATE_REQUEST_FIELD')
                parsed[key] = value
            return parsed

        parsed = json.loads(raw.decode('utf-8'), object_pairs_hook=unique_pairs)
        require(parsed == request and set(parsed) ==
                {'action', 'operation_id', 'feishu_message_id'}, 'REQUEST_FIELDS_INVALID')
        require(request['operation_id'] == HR_CTO_READ_ID, 'HR_CTO_FIXED_OPERATION_REQUIRED')
        message = request['feishu_message_id']
        require(type(message) is str and message, 'BAD_FEISHU_MESSAGE_ID')
        message_bytes = message.encode('utf-8')
        require(len(message_bytes) <= 128, 'BAD_FEISHU_MESSAGE_ID')
        require(HR_CTO_REQUEST_SHA256 is not None, 'HR_CTO_BINDING_UNBOUND')
        request_sha = sha_bytes(canonical(request))
        require(request_sha == HR_CTO_REQUEST_SHA256, 'HR_CTO_EXACT_REQUEST_REQUIRED')
        ledger = HrCtoLedger()
        ledger.__enter__()
        intent = {'action':HR_CTO_ACTION, 'agentId':'agt_cto-agent',
                  'operation_id':HR_CTO_READ_ID, 'state':'INTENT',
                  'request_sha256':request_sha}
        ledger.intent(intent)
        try:
            ledger.check()
            selected = hr_cto_verified_select(message)
            ledger.check()
            require(type(selected) is dict and set(selected) == {'projection', 'store_sha256'},
                    'HR_CTO_RESULT_INVALID')
            projection = selected['projection']
            fields = {'sender_openid_sha256', 'feishu_message_id_sha256', 'native_receipt_sha256'}
            require(type(projection) is dict and set(projection) == fields
                    and all(type(projection[k]) is str and
                            re.fullmatch('[0-9a-f]{64}', projection[k]) for k in fields)
                    and projection['feishu_message_id_sha256'] == sha_bytes(message_bytes),
                    'HR_CTO_RESULT_INVALID')
            # Store digest is used inside the protected traversal only, not published.
            terminal = {**intent, 'state':'COMPLETE', 'projection':projection}
            response = {'ok':True, 'state':'COMPLETE', 'operation_id':HR_CTO_READ_ID,
                        'projection':projection, 'replayAllowed':False}
            require(len(canonical(terminal)) <= 1024 and len(canonical(response)) <= 768,
                    'HR_CTO_RESPONSE_BOUND')
            ledger.terminal(terminal)
            ledger.check()
            return response
        except Exception as exc:
            ledger.check()
            known = {'ROUTER_INGRESS_NONE', 'ROUTER_INGRESS_MULTIPLE',
                     'ROUTER_INGRESS_WRONG_AGENT', 'ROUTER_INGRESS_RECEIPT_ABSENT',
                     'ROUTER_STORE_INVALID', 'HR_CTO_RESULT_INVALID', 'HR_CTO_RESPONSE_BOUND'}
            reason = str(exc) if isinstance(exc, Failure) and str(exc) in known else 'HR_CTO_READ_UNKNOWN'
            state = 'FAIL' if reason in known else 'UNKNOWN'
            terminal = {**intent, 'state':state, 'reason':reason}
            ledger.terminal(terminal)
            return {'ok':False, 'state':state, 'error':reason,
                    'operation_id':HR_CTO_READ_ID, 'replayAllowed':False}
    except Exception as exc:
        known = {'PEER_UNAUTHORIZED', 'HR_CTO_DUPLICATE_REQUEST_FIELD', 'REQUEST_FIELDS_INVALID',
                 'HR_CTO_FIXED_OPERATION_REQUIRED', 'BAD_FEISHU_MESSAGE_ID', 'HR_CTO_BINDING_UNBOUND',
                 'HR_CTO_EXACT_REQUEST_REQUIRED', 'HR_CTO_OPERATION_CONSUMED',
                 'HR_CTO_LOCK_CUSTODY', 'HR_CTO_STATE_CUSTODY', 'MUTATION_ALREADY_RUNNING'}
        reason = str(exc) if isinstance(exc, Failure) and str(exc) in known else 'HR_CTO_READ_UNKNOWN'
        return {'ok':False, 'state':'UNKNOWN' if ledger is not None and ledger.claimed else 'REJECTED',
                'error':reason, 'replayAllowed':False}
    finally:
        if ledger is not None:
            ledger.close()
