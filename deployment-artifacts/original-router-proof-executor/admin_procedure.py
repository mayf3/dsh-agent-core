"""Original sealed executor's fixed admin qualification branch.

Loaded only from the same authenticated root entry. The original procedure's
closed `_checked_turn` and `_seal_owned` functions are supplied by that entry;
this file never accepts an event list, receipt, prompt or Owner identity.
"""


def _run_admin_owned(owner):
    require(type(owner) is FixedOriginalDriver and not owner._unknown,
            'ADMIN_ORIGINAL_CUSTODY_UNKNOWN')
    try:
        owner._procedure_turns = []
        owner._observed_runtimes = set()
        owner._verify_installed = lambda: _checked_installation(owner)
        owner._deploy_original()
        for index, phase in enumerate(('deployment_start', 'restart_a', 'restart_b')):
            if index:
                owner._stop_owned_child()
                owner._launch_phase(phase)
            # The original owner requests one private native turn over its
            # authenticated same-child socket and independently rereads the
            # durable store descriptor. A child frame alone cannot qualify.
            value, runtime = owner._admin_canary_and_store_readback()
            owner._health_original()
            require(runtime not in owner._observed_runtimes, 'ADMIN_RUNTIME_REUSED')
            owner._observed_runtimes.add(runtime)
            previous = owner._procedure_turns[-1] if owner._procedure_turns else None
            owner._procedure_turns.append(_checked_turn(value, previous, owner))
        owner._stop_owned_child()
        owner._continuity()
        return _seal_owned(owner)
    except BaseException:
        owner._unknown = True
        raise
