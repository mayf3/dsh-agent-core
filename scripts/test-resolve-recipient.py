#!/usr/bin/env python3
"""Isolated tests for resolve-recipient.py — structure-only binding resolution.

Regression: the 2026-10-08 misroute (full-text proximity matching grabbed a
chatId near the agent's name → oc_eb72309a went to agt_family-doctor-2-agent).
These tests pin: exact activeAgentId matching, zero-match and multi-match
fail-closed behavior, and NO fallback to text scanning.
"""

import json
import subprocess
import sys
import tempfile
import os

HERE = os.path.dirname(os.path.abspath(__file__))
HELPER = os.path.join(HERE, 'resolve-recipient.py')

BINDINGS = {
    'bindings': [
        {'activeAgentId': 'agt_reviewer', 'channelConversationId': 'oc_reviewerchat000000000001',
         'activeSessionId': 'main', 'updatedAt': '2026-10-01T00:00:00Z',
         'note': 'oc_ prefix here must NOT leak to other agents via text scan'},
        {'activeAgentId': 'agt_family-doctor-2-agent', 'channelConversationId': 'oc_reviewerchat000000000001',
         'activeSessionId': 'main', 'updatedAt': '2026-10-02T00:00:00Z'},
        {'activeAgentId': 'agt_writer', 'channelConversationId': 'oc_writerchat00000000000001',
         'activeSessionId': 'main', 'updatedAt': '2026-10-03T00:00:00Z'},
        {'activeAgentId': 'agt_writer', 'channelConversationId': 'oc_writerchat00000000000002',
         'activeSessionId': 'main', 'updatedAt': '2026-10-04T00:00:00Z'},
    ]
}


def run(agent_id):
    with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False) as f:
        json.dump(BINDINGS, f)
        path = f.name
    try:
        p = subprocess.run([sys.executable, HELPER, path, agent_id],
                           capture_output=True, text=True)
        return p.returncode, p.stdout.strip(), p.stderr.strip()
    finally:
        os.unlink(path)


def main():
    failures = []

    # 1. exact match: reviewer resolves to its OWN chat, and the decoy row
    #    (family-doctor bound to the SAME chatId) does not confuse it.
    rc, out, _ = run('agt_reviewer')
    ok = rc == 0
    data = json.loads(out) if out else {}
    ok = ok and data.get('unique') is True and data.get('uniqueChatIds') == ['oc_reviewerchat000000000001']
    print('PASS' if ok else 'FAIL', 'exact-match single chat')
    if not ok: failures.append('exact-match')

    # 2. zero matches fail closed with exit 3
    rc, out, _ = run('agt_nonexistent')
    print('PASS' if rc == 3 else 'FAIL', 'zero-match exit 3')
    if rc != 3: failures.append('zero-match')

    # 3. multi-match fails closed with exit 4 (writer bound to two chats)
    rc, out, _ = run('agt_writer')
    ok = rc == 4
    data = json.loads(out) if out else {}
    ok = ok and len(data.get('uniqueChatIds', [])) == 2
    print('PASS' if ok else 'FAIL', 'multi-match exit 4 (disambiguate first)')
    if rc != 4: failures.append('multi-match')

    # 4. negative control for the incident: a substring/proximity name never matches
    rc, out, _ = run('agt_writ')
    print('PASS' if rc == 3 else 'FAIL', 'no substring fallback')
    if rc != 3: failures.append('substring-fallback')

    total = 4
    print(f'{total - len(failures)}/{total} tests pass')
    raise SystemExit(1 if failures else 0)


if __name__ == '__main__':
    main()
