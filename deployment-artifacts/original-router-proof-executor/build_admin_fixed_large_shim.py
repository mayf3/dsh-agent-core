"""Offline, default-inert exact-large-DS adapter for the fixed shim install action.

All other shim actions retain the original 16 MiB artifact bound. This file
does not install or call the shim. A later reviewed package must compile the
one operation ID and both exact old/new daemon byte identities.
"""
import hashlib
from pathlib import Path


BASE = Path('/Users/yanfenma/workspace/artifacts/DEPLOYMENT_BACKLOG/'
    'p0-travel-terminal-readback-20260928-v14/shim-artdir/deploy_shim.py')
BASE_SHA256 = '5661fbd0c7fde5139b10cb1adf9546a1ce507e413d89177b821ddd683146d7f8'
PUBLISHER = Path(__file__).resolve().parent / 'admin_fixed_shim_publisher.py'
HOST_OBSERVER = Path(__file__).resolve().parent / 'admin_host_identity.py'
HOST_OBSERVER_SHA256 = 'd01e60e8176e1ea7cb52c40b9cb51ef3bec56f2b1a2f1850c5a8402773afa035'
PUBLISHER_SHA256 = 'd7f84bcce6febe47ac271e9847b967138bb00264b28449cb6c90a553207ea3e3'


def _once(source, old, new):
    if source.count(old) != 1:
        raise ValueError('ADMIN_FIXED_SHIM_ANCHOR_CHANGED')
    return source.replace(old, new, 1)


def build_bytes():
    raw = BASE.read_bytes()
    if hashlib.sha256(raw).hexdigest() != BASE_SHA256:
        raise ValueError('ADMIN_FIXED_SHIM_BASE_CHANGED')
    source = raw.decode('utf8', 'strict')
    source = _once(source, 'ARTIFACT_MAX = 16 * 1024 * 1024\n',
        'ARTIFACT_MAX = 16 * 1024 * 1024\n'
        'DS_FIXED_LARGE_INSTALL_OPERATION_ID = None\n'
        'DS_FIXED_LARGE_INSTALL_SHA256 = None\n'
        'DS_FIXED_LARGE_INSTALL_SIZE = None\n'
        'DS_FIXED_LARGE_ROLLBACK_SHA256 = None\n'
        'DS_FIXED_LARGE_ROLLBACK_SIZE = None\n'
        'DS_FIXED_ROLLBACK_ARTIFACTS = None\n')
    source = _once(source, 'def read_verified(path):\n',
                   'def read_verified(path, exact_large=None):\n')
    source = _once(source,
        '        require(meta.st_size <= ARTIFACT_MAX, "ARTIFACT_TOO_LARGE:" + path)\n'
        '        chunks = []\n',
        '        if exact_large is not None:\n'
        '            require(isinstance(exact_large, tuple) and len(exact_large) == 2\n'
        '                    and isinstance(exact_large[0], str)\n'
        '                    and len(exact_large[0]) == 64\n'
        '                    and type(exact_large[1]) is int\n'
        '                    and ARTIFACT_MAX < exact_large[1] <= 128 * 1024 * 1024,\n'
        '                    "DS_FIXED_LARGE_PIN_INVALID")\n'
        '        max_size = exact_large[1] if exact_large is not None else ARTIFACT_MAX\n'
        '        require(meta.st_size <= max_size, "ARTIFACT_TOO_LARGE:" + path)\n'
        '        chunks = []\n'
        '        length = 0\n')
    source = _once(source,
        '            chunks.append(block)\n'
        '        raw = b"".join(chunks)\n',
        '            length += len(block)\n'
        '            require(length <= max_size, "ARTIFACT_TOO_LARGE:" + path)\n'
        '            chunks.append(block)\n'
        '        raw = b"".join(chunks)\n'
        '        require(length == meta.st_size, "ARTIFACT_CHANGED:" + path)\n'
        '        if exact_large is not None:\n'
        '            require(length == exact_large[1] and\n'
        '                    hashlib.sha256(raw).hexdigest() == exact_large[0],\n'
        '                    "DS_FIXED_LARGE_CHANGED:" + path)\n')
    source = _once(source,
        '    started = time.time()\n    steps = []\n    try:\n        verified = {}\n',
        '    started = time.time()\n    steps = []\n    fixed_large = False\n'
        '    intent_written = False\n    fixed_lock = None\n'
        '    old_verified = {}\n    try:\n'
        '        fixed_large = operation_id == DS_FIXED_LARGE_INSTALL_OPERATION_ID\n'
        '        large_install = large_rollback = None\n'
        '        if fixed_large:\n'
        '            require(admin_fixed_compiled() and\n'
        '                    ADMIN_FIXED_INSTALL_ID == operation_id,\n'
        '                    "ADMIN_FIXED_PACKAGE_UNBOUND")\n'
        '            require(all(type(value) is str for value in\n'
        '                    (DS_FIXED_LARGE_INSTALL_SHA256,\n'
        '                     DS_FIXED_LARGE_ROLLBACK_SHA256)) and\n'
        '                    all(type(value) is int for value in\n'
        '                    (DS_FIXED_LARGE_INSTALL_SIZE,\n'
        '                     DS_FIXED_LARGE_ROLLBACK_SIZE)) and\n'
        '                    artifacts["deployment_system.py"] ==\n'
        '                    DS_FIXED_LARGE_INSTALL_SHA256,\n'
        '                    "DS_FIXED_LARGE_BINDING_UNKNOWN")\n'
        '            require(os.path.exists(DS_PLIST_PATH),\n'
        '                    "ADMIN_FIXED_CURRENT_DS_MISSING")\n'
        '            fixed_lock = fixed_ds_mutation_lock()\n'
        '            large_install = (DS_FIXED_LARGE_INSTALL_SHA256,\n'
        '                             DS_FIXED_LARGE_INSTALL_SIZE)\n'
        '            large_rollback = (DS_FIXED_LARGE_ROLLBACK_SHA256,\n'
        '                              DS_FIXED_LARGE_ROLLBACK_SIZE)\n'
        '        verified = {}\n')
    source = _once(source, '            raw, digest = read_verified(staged)\n',
        '            raw, digest = read_verified(staged, exact_large=large_install\n'
        '                if name == "deployment_system.py" else None)\n')
    source = _once(source, '                raw, digest = read_verified(live)\n',
        '                if fixed_large:\n'
        '                    raw = old_verified[name]\n'
        '                else:\n'
        '                    raw, digest = read_verified(live)\n')
    host_raw = HOST_OBSERVER.read_bytes()
    publisher_raw = PUBLISHER.read_bytes()
    if hashlib.sha256(host_raw).hexdigest() != HOST_OBSERVER_SHA256:
        raise ValueError('ADMIN_FIXED_HOST_OBSERVER_CHANGED')
    if hashlib.sha256(publisher_raw).hexdigest() != PUBLISHER_SHA256:
        raise ValueError('ADMIN_FIXED_PUBLISHER_CHANGED')
    publisher = (host_raw.decode('utf8', 'strict') + '\n\n'
                 + publisher_raw.decode('utf8', 'strict') + '\n\n'
        'def fixed_ds_mutation_lock():\n'
        '    """Hold the canonical DS flock for one fixed installation."""\n'
        '    parent = os.open(DS_STATE_DIR, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)\n'
        '    try:\n'
        '        meta = os.fstat(parent)\n'
        '        require(stat.S_ISDIR(meta.st_mode) and meta.st_uid == 0\n'
        '                and meta.st_gid == 80 and stat.S_IMODE(meta.st_mode) == 0o770,\n'
        '                "ADMIN_FIXED_DS_PARENT_UNKNOWN")\n'
        '        fd = os.open("mutation.lock", os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW,\n'
        '                     0o644, dir_fd=parent)\n'
        '        try:\n'
        '            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)\n'
        '            named = os.stat("mutation.lock", dir_fd=parent, follow_symlinks=False)\n'
        '            held = os.fstat(fd)\n'
        '            require(stat.S_ISREG(held.st_mode) and held.st_uid == 0\n'
        '                    and (held.st_dev, held.st_ino) == (named.st_dev, named.st_ino),\n'
        '                    "ADMIN_FIXED_LOCK_CHANGED")\n'
        '            return fd\n'
        '        except BaseException:\n'
        '            os.close(fd)\n'
        '            raise\n'
        '    finally:\n'
        '        os.close(parent)\n')
    source = _once(source, 'def install_deployment_system(request):\n',
        publisher + '\n\ndef install_deployment_system(request):\n')
    source = _once(source,
        '        update_mode = os.path.exists(DS_PLIST_PATH)\n',
        '        if fixed_large:\n'
        '            require(ADMIN_FIXED_INSTALL_ID == operation_id,\n'
        '                    "ADMIN_FIXED_OPERATION_UNBOUND")\n'
        '            require(validate_admin_fixed_package(operation_id,\n'
        '                    artifacts, verified) is not None,\n'
        '                    "ADMIN_FIXED_PACKAGE_UNBOUND")\n'
        '            pins = DS_FIXED_ROLLBACK_ARTIFACTS\n'
        '            require(type(pins) is dict and set(pins) == set(DS_ARTIFACTS)\n'
        '                    and all(type(pin) is tuple and len(pin) == 2\n'
        '                    and type(pin[0]) is str and len(pin[0]) == 64\n'
        '                    and type(pin[1]) is int and pin[1] > 0\n'
        '                    for pin in pins.values())\n'
        '                    and pins["deployment_system.py"] == large_rollback,\n'
        '                    "ADMIN_FIXED_ROLLBACK_UNBOUND")\n'
        '            for name in DS_ARTIFACTS:\n'
        '                live = (DS_PLIST_PATH if name == "plist" else\n'
        '                    (os.path.join(DS_CONFIG_DIR, name)\n'
        '                     if name == "deployment-registry.json" else\n'
        '                     os.path.join(DS_INSTALL_DIR, name)))\n'
        '                old_raw, old_digest = read_verified(live,\n'
        '                    exact_large=large_rollback if name ==\n'
        '                    "deployment_system.py" else None)\n'
        '                require((old_digest, len(old_raw)) == pins[name],\n'
        '                        "ADMIN_FIXED_ROLLBACK_CHANGED:" + name)\n'
        '                old_verified[name] = old_raw\n'
        '            intent = {"operation_id": operation_id,\n'
        '                "action": "INSTALL_DEPLOYMENT_SYSTEM", "state": "UNKNOWN",\n'
        '                "replayAllowed": False, "artifacts": artifacts,\n'
        '                "started": started, "version": VERSION}\n'
        '            atomic_write(receipt_path(operation_id), canonical(intent))\n'
        '            with open(receipt_path(operation_id), "rb") as fh:\n'
        '                require(fh.read() == canonical(intent),\n'
        '                        "ADMIN_FIXED_INTENT_READBACK")\n'
        '            intent_written = True\n'
        '        update_mode = os.path.exists(DS_PLIST_PATH)\n')
    source = _once(source,
        '        status = _ds_wait_socket_and_status()\n'
        '        steps.append({"step": "ds-status-readback", "result": "PASS"})\n',
        '        status = _ds_wait_socket_and_status()\n'
        '        steps.append({"step": "ds-status-readback", "result": "PASS"})\n'
        '        qualification_package_sha = publish_admin_fixed_package(\n'
        '            operation_id, artifacts, verified)\n')
    source = _once(source,
        '        atomic_write(receipt_path(operation_id), canonical(record))\n',
        '        if qualification_package_sha is not None:\n'
        '            record["qualificationPackageSha256"] = qualification_package_sha\n'
        '            record["committedAt"] = time.time()\n'
        '        atomic_write(receipt_path(operation_id), canonical(record))\n'
        '        if fixed_large:\n'
        '            with open(receipt_path(operation_id), "rb") as fh:\n'
        '                require(fh.read() == canonical(record),\n'
        '                        "ADMIN_FIXED_COMMIT_READBACK")\n')
    source = _once(source,
        '    except Failure as exc:\n'
        '        atomic_write(receipt_path(operation_id), canonical({\n'
        '            "operation_id": operation_id,\n'
        '            "action": "INSTALL_DEPLOYMENT_SYSTEM", "state": "FAILED",\n',
        '    except Failure as exc:\n'
        '        if fixed_large and intent_written:\n'
        '            return {"ok": False, "operation_id": operation_id,\n'
        '                    "state": "UNKNOWN", "error": str(exc)}\n'
        '        atomic_write(receipt_path(operation_id), canonical({\n'
        '            "operation_id": operation_id,\n'
        '            "action": "INSTALL_DEPLOYMENT_SYSTEM", "state": "FAILED",\n')
    source = _once(source, '\n\ndef handle(raw):\n',
        '    except Exception as exc:\n'
        '        if fixed_large and intent_written:\n'
        '            return {"ok": False, "operation_id": operation_id,\n'
        '                    "state": "UNKNOWN", "error": type(exc).__name__}\n'
        '        raise\n'
        '    finally:\n'
        '        if fixed_lock is not None:\n'
        '            fcntl.flock(fixed_lock, fcntl.LOCK_UN)\n'
        '            os.close(fixed_lock)\n\n\ndef handle(raw):\n')
    return source.encode('utf8')
