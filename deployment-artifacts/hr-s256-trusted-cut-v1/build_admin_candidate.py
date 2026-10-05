"""Compile the distinct fixed admin cut into a review-only DS candidate.

This is a second *compiled* namespace. It has no caller-selected profile and
retains the existing R2 action and receipt directory byte-for-byte. All
activation/package pins remain unset; this builder performs no host I/O.
"""

import io
import tokenize
from pathlib import Path
from textwrap import indent

from build_candidate import HERE, build_current_bytes, replace_once


ADMIN_ACTION = "HR_S256_ADMIN_EMERGENCY_CUT_V1"
ADMIN_OPERATION = "hr-s256-admin-emergency-cut-20260928-v1"
OLD_OPERATION = "hr-s256-trusted-quiescence-cut-20260925-v1"
OLD_AUTHORITY = "hr-s256-one-shot-authority.json"
OLD_SCOPE = "hr-s256-source-scope.json"
MODULES = {
    "PROFILE": HERE / "profile.py",
    "COLLECTOR": HERE / "collector.py",
    "PROJECTION": HERE / "projection.py",
    "JOURNAL": HERE / "journal.py",
    "HANDOFF": HERE / "handoff.py",
    "ARCHIVE": HERE / "archive.py",
    "LIFECYCLE": HERE / "lifecycle.py",
    "ONE_SHOT": HERE.parents[1] / "scripts/lib/hr-s256-one-shot/orchestration.py",
    "REAL_OS": HERE.parents[1] / "scripts/lib/hr-s256-one-shot/fixed_os.py",
    "INVENTORY": HERE.parents[1] / "scripts/lib/hr-s256-one-shot/installed_inventory.py",
    "STOP_RECEIPT": HERE.parents[1] / "scripts/lib/hr-s256-one-shot/controlled_stop.py",
    "FINITE_STOP": HERE.parents[1] / "scripts/lib/hr-s256-one-shot/finite_stop.py",
    "OWNED_STOP": HERE.parents[1] / "scripts/lib/hr-s256-one-shot/owned_stop.py",
    "FIXED_IO": HERE.parents[1] / "scripts/lib/hr-s256-one-shot/fixed_io.py",
    "BOOTSTRAP": HERE / "bootstrap.py",
    "MAINTENANCE": HERE / "maintenance.py",
}
NAMES = {f"HR_{name}": f"HR_ADMIN_{name}" for name in MODULES}


def _closed_admin_source(name, path):
    body = path.read_text(encoding="utf-8")
    if "if __name__" in body:
        raise ValueError("PROFILE_EXECUTABLE_MAIN_FORBIDDEN")
    # Rewrite NAME tokens, not strings/comments. The source is a fixed compile
    # input; no runtime profile selector or generic module loader is exposed.
    tokens = list(tokenize.generate_tokens(io.StringIO(body).readline))
    body = tokenize.untokenize(token._replace(string=NAMES.get(token.string, token.string))
                                if token.type == tokenize.NAME else token for token in tokens)
    body = body.replace(OLD_OPERATION, ADMIN_OPERATION)
    body = body.replace(OLD_AUTHORITY, "hr-s256-admin-one-shot-authority.json")
    body = body.replace(OLD_SCOPE, "hr-s256-admin-source-scope.json")
    # A few original helpers resolve their fixed sibling by a quoted global
    # name. Bind those names to this namespace too; never borrow R2 custody.
    for original, admin in NAMES.items():
        body = body.replace(f"'{original}'", f"'{admin}'")
        body = body.replace(f'"{original}"', f'"{admin}"')
    if name == "PROFILE":
        body = replace_once(body, 'ACTION = "HR_S256_TRUSTED_QUIESCENCE_CUT_V1"',
                            f'ACTION = "{ADMIN_ACTION}"')
    elif name == "ARCHIVE":
        body = replace_once(body, 'DIRECTORY = "hr-s256-quiescence-evidence"',
                            'DIRECTORY = "hr-s256-admin-quiescence-evidence"')
    elif name == "BOOTSTRAP":
        body = replace_once(body, "INSTALLATION_ID = 'hr-s256-profile-bootstrap-20260926-v1'",
                            "INSTALLATION_ID = 'hr-s256-admin-profile-bootstrap-20260928-v1'")
    return (f"def _make_HR_ADMIN_{name}():\n" + indent(body, "    ")
            + "\n    return types.SimpleNamespace(**locals())\n"
            + f"HR_ADMIN_{name} = _make_HR_ADMIN_{name}()\n\n")


def build_admin_current_bytes():
    source = build_current_bytes().decode("utf-8", "strict")
    source = replace_once(source,
        '            "HR_S256_TRUSTED_QUIESCENCE_CUT_V1": {"action", "operation_id"},',
        '            "HR_S256_TRUSTED_QUIESCENCE_CUT_V1": {"action", "operation_id"},\n'
        f'            "{ADMIN_ACTION}": {{"action", "operation_id"}},')
    source = replace_once(source,
        '        if action == HR_PROFILE.ACTION:\n            return hr_s256_action(request), None',
        '        if action == HR_PROFILE.ACTION:\n            return hr_s256_action(request), None\n'
        '        if action == HR_ADMIN_PROFILE.ACTION:\n'
        '            return hr_s256_admin_action(request), None')
    modules = "".join(_closed_admin_source(name, path) for name, path in MODULES.items())
    handler = '''def hr_s256_admin_action(request):
    """Distinct fixed operation; uninstalled means zero protected IO."""
    try:
        HR_ADMIN_PROFILE.validate_request(request)
        if not TEST_MODE:
            HR_ADMIN_REAL_OS.require_activation()
    except (HR_ADMIN_PROFILE.Rejected, HR_ADMIN_REAL_OS.Rejected) as exc:
        raise Failure(str(exc)) from exc
    lock_fd = mutation_lock()
    try:
        try:
            HR_ADMIN_OWNED_STOP.enter_handler(lock_fd)
            try:
                return HR_ADMIN_ONE_SHOT.run_fixed(request, lock_fd)
            finally:
                HR_ADMIN_OWNED_STOP.leave_handler()
        except HR_ADMIN_PROFILE.Rejected as exc:
            raise Failure(str(exc)) from exc
    finally:
        if not HR_ADMIN_ONE_SHOT.canonical_fd_owned(lock_fd):
            fcntl.flock(lock_fd, fcntl.LOCK_UN)
            os.close(lock_fd)


'''
    source = replace_once(source, 'def handle(raw):\n', modules + handler + 'def handle(raw):\n')
    source = replace_once(source,
        '    HR_BOOTSTRAP.installation_bootstrap()  # Fixed install-time only; default zero-effect.\n',
        '    HR_BOOTSTRAP.installation_bootstrap()  # Fixed install-time only; default zero-effect.\n'
        '    HR_ADMIN_BOOTSTRAP.installation_bootstrap()  # Distinct admin package; default zero-effect.\n')
    return source.encode()
