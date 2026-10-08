#!/usr/bin/env python3
"""Minimal generic recipient resolution over the Router BindingStore.

Fixes the incident class from 2026-10-08: binding-store full-text proximity
matching grabbed a chatId near the agent's name and routed to the WRONG agent
(oc_eb72309a → agt_family-doctor-2-agent instead of the intended reviewer).
This helper uses STRUCTURE ONLY: every binding entry is matched by its
authoritative `activeAgentId` field, and the caller must assert the mapping
before sending. No runtime/binding/role changes; read-only over bindings.json.

Usage:
  resolve-recipient.py <bindings.json> <canonicalAgentId>
  → prints one JSON line: {"agentId":…, "matches":[{chatId,sessionId,…}], "unique":bool}

Exit codes: 0 = exactly one match (safe to send), 3 = zero matches,
4 = multiple matches (disambiguate first). Never guess.
"""

import json
import sys


def load_bindings(path):
    """Return the iterable of binding entries from the store's JSON structure.

    Known shapes: {"bindings": [ ... ]} (list) and
    {"bindings": { <bindingKey>: {entry,…} }} (mapping, the production
    layout). Both are handled STRUCTURALLY — no whole-document text scan.
    """
    data = json.load(open(path))
    if isinstance(data, dict):
        b = data.get('bindings')
        if isinstance(b, list):
            return b
        if isinstance(b, dict):
            return list(b.values())
        raise SystemExit(f'{path}: no bindings found in JSON structure')
    if isinstance(data, list):
        return data
    raise SystemExit(f'{path}: unrecognized bindings JSON structure')


def entry_agent_id(entry):
    """The authoritative agent id of a binding entry, or None."""
    if not isinstance(entry, dict):
        return None
    for key in ('activeAgentId', 'agentId'):
        v = entry.get(key)
        if isinstance(v, str) and v:
            return v
    return None


def entry_chat_id(entry):
    """The bound channel conversation id of a binding entry, or None."""
    if not isinstance(entry, dict):
        return None
    cc = entry.get('channelConversationId')
    if isinstance(cc, str) and cc:
        return cc
    # some stores nest it
    for key in ('channel', 'conversation'):
        nested = entry.get(key)
        if isinstance(nested, dict):
            cc = nested.get('channelConversationId') or nested.get('chatId')
            if isinstance(cc, str) and cc:
                return cc
    return None


def main():
    if len(sys.argv) != 3:
        print(__doc__, file=sys.stderr)
        raise SystemExit(2)
    path, agent_id = sys.argv[1], sys.argv[2]
    entries = load_bindings(path)
    matches = []
    for entry in entries:
        if entry_agent_id(entry) == agent_id:
            chat = entry_chat_id(entry)
            if chat:
                matches.append({
                    'chatId': chat,
                    'sessionId': entry.get('activeSessionId') or entry.get('sessionId'),
                    'channel': entry.get('channel') or entry.get('channelNamespace'),
                    'updatedAt': entry.get('updatedAt'),
                })
    # dedupe by chatId (multiple session rows may share one conversation)
    unique_chats = sorted({m['chatId'] for m in matches})
    result = {
        'agentId': agent_id,
        'matches': matches,
        'uniqueChatIds': unique_chats,
        'unique': len(unique_chats) == 1,
    }
    print(json.dumps(result, ensure_ascii=False))
    if len(unique_chats) == 0:
        raise SystemExit(3)
    if len(unique_chats) > 1:
        raise SystemExit(4)
    raise SystemExit(0)


if __name__ == '__main__':
    main()
