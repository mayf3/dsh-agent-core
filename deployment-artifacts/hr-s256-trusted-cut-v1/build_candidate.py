"""Assemble one review-only DS candidate from the exact frozen v5 source.

The returned bytes are never installed or executed by this builder. The
frozen package remains untouched. Only a later, separately authorized DS
update could install independently reviewed bytes.
"""

import hashlib
from pathlib import Path
from textwrap import indent


BASE = Path("/Users/yanfenma/workspace/artifacts/AGENT_CORE_DEPLOYMENT_SYSTEM_V1"
            "/ds-fixed-target-restart-successor-20260924-v5"
            "/ds-update-artifacts/deployment_system.py")
BASE_SHA256 = "b4b65201498c4ec959c391e59e86322931ab3638a475f6c0c0b2fdeddc8eb437"
HERE = Path(__file__).resolve().parent


def replace_once(source, old, new):
    if source.count(old) != 1:
        raise ValueError("DS_BASE_ANCHOR_CHANGED")
    return source.replace(old, new, 1)


def scoped_source(name, path):
    body = path.read_text(encoding="utf-8")
    if "if __name__" in body:
        raise ValueError("PROFILE_EXECUTABLE_MAIN_FORBIDDEN")
    return (f"def _make_{name}():\n" + indent(body, "    ")
            + "\n    return types.SimpleNamespace(**locals())\n"
            + f"{name} = _make_{name}()\n\n")


def build_bytes():
    raw = BASE.read_bytes()
    if hashlib.sha256(raw).hexdigest() != BASE_SHA256:
        raise ValueError("DS_BASE_SHA256_CHANGED")
    source = raw.decode("utf-8", "strict")
    action = '"HR_S256_TRUSTED_QUIESCENCE_CUT_V1": {"action", "operation_id"},'
    source = replace_once(source,
        '            "ROUTER_DURABLE_SUMMARY": {"action"},',
        '            "ROUTER_DURABLE_SUMMARY": {"action"},\n'
        f'            {action}')
    source = replace_once(source,
        '        if action == "ROUTER_DURABLE_SUMMARY":\n'
        '            return router_durable_summary(), None',
        '        if action == "ROUTER_DURABLE_SUMMARY":\n'
        '            return router_durable_summary(), None\n'
        '        if action == HR_PROFILE.ACTION:\n'
        '            return hr_s256_action(request), None')
    projector = (HERE / "project-subject.mjs").read_text(encoding="utf-8")
    integration = ('import types\n\n'
        + f'HR_PROJECTOR_SOURCE = {projector!r}\n\n'
        + scoped_source("HR_PROFILE", HERE / "profile.py")
        + scoped_source("HR_COLLECTOR", HERE / "collector.py")
        + scoped_source("HR_PROJECTION", HERE / "projection.py")
        + scoped_source("HR_JOURNAL", HERE / "journal.py")
        + scoped_source("HR_HANDOFF", HERE / "handoff.py")
        + scoped_source("HR_ARCHIVE", HERE / "archive.py")
        + scoped_source("HR_LIFECYCLE", HERE / "lifecycle.py")
        + scoped_source("HR_ONE_SHOT", HERE.parents[1] /
                        "scripts/lib/hr-s256-one-shot/orchestration.py")
        + '''def hr_s256_action(request):
    """One fixed DS action, serialized by the existing mutation domain."""
    try:
        HR_PROFILE.validate_request(request)
    except HR_PROFILE.Rejected as exc:
        raise Failure(str(exc)) from exc
    lock_fd = mutation_lock()
    try:
        try:
            if TEST_MODE:
                return HR_ONE_SHOT.run_fixed(request, lock_fd)
            return HR_PROFILE.production_entry(request)
        except HR_PROFILE.Rejected as exc:
            raise Failure(str(exc)) from exc
    finally:
        if not HR_ONE_SHOT.canonical_fd_owned(lock_fd):
            fcntl.flock(lock_fd, fcntl.LOCK_UN)
            os.close(lock_fd)


''')
    source = replace_once(source, 'def handle(raw):\n', integration + 'def handle(raw):\n')
    return source.encode("utf-8")
