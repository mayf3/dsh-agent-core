"""Read the existing V7 fixed controlled-stop receipt; never infer a stop."""
import hashlib
import json
import os
import stat


class Rejected(Exception):
    pass


def require(ok, code):
    if not ok:
        raise Rejected(code)


def journal():
    result = globals().get('HR_JOURNAL')
    require(result is not None, 'STOP_CUSTODY_UNKNOWN')
    return result


def valid(record):
    j = journal()
    return (j.exact(record, {'operationId', 'hostId', 'method', 'atWallMs'})
        and record['operationId'] == j.OPERATION_ID
        and type(record['hostId']) is str and 0 < len(record['hostId']) <= 128
        and record['method'] == 'trusted_cp_controlled_stop_v1'
        and type(record['atWallMs']) is int and 0 <= record['atWallMs'] <= (1 << 53) - 1)


def readback():
    j = journal()
    root, directory = j.opened_custody(False)
    fd = None
    try:
        fd = os.open('controlled-stop.json', os.O_RDONLY | os.O_NOFOLLOW, dir_fd=directory)
        before = os.fstat(fd)
        require(stat.S_ISREG(before.st_mode) and before.st_uid == os.fstat(directory).st_uid
                and stat.S_IMODE(before.st_mode) == 0o600 and 0 < before.st_size <= 1024,
                'STOP_RECEIPT_CUSTODY')
        raw = os.read(fd, 1025)
        require(len(raw) == before.st_size and os.fstat(fd) == before
                and os.stat('controlled-stop.json', dir_fd=directory,
                    follow_symlinks=False) == before, 'STOP_RECEIPT_CHANGED')
        record = json.loads(raw, object_pairs_hook=j.unique_pairs)
        require(valid(record), 'STOP_RECEIPT_SHAPE')
        return record, hashlib.sha256(raw).hexdigest()
    except (OSError, ValueError) as exc:
        raise Rejected('STOP_RECEIPT_UNKNOWN') from exc
    finally:
        if fd is not None:
            os.close(fd)
        j.close_custody(root, directory)


def validate(bundle):
    j = journal()
    stop = bundle['controlledStop']
    if stop is None:
        return
    require(j.exact(stop, {'method', 'receiptSha256', 'atWallMs'})
            and stop['method'] == 'trusted_cp_controlled_stop_v1'
            and j.valid_hash(stop['receiptSha256']) and type(stop['atWallMs']) is int,
            'STOP_BUNDLE_SHAPE')
    root, directory = j.opened_custody(False)
    named = None
    try:
        named = os.open(bundle['custody']['evidenceDir'],
                        os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        left, right = os.fstat(named), os.fstat(directory)
        require((left.st_dev, left.st_ino) == (right.st_dev, right.st_ino),
                'STOP_RECEIPT_DIRECTORY')
    except OSError as exc:
        raise Rejected('STOP_RECEIPT_DIRECTORY') from exc
    finally:
        if named is not None:
            os.close(named)
        j.close_custody(root, directory)
    record, digest = readback()
    cut = bundle['recoveryCutover']
    require(digest == stop['receiptSha256'] and record['hostId'] == cut['hostId']
            and record['atWallMs'] == stop['atWallMs']
            and cut['windowOpenedAtWallMs'] < stop['atWallMs'] < cut['oldTreeQuiescedAtWallMs'],
            'STOP_RECEIPT_BINDING')
    # Consumer V7 still independently checks floor/validator/inhibition and live plan.


def require_absent():
    j = journal()
    root, directory = j.opened_custody(False)
    try:
        try:
            os.stat('controlled-stop.json', dir_fd=directory, follow_symlinks=False)
        except FileNotFoundError:
            return
        raise Rejected('STOP_RECEIPT_EXISTS')
    finally:
        j.close_custody(root, directory)


def seal_completed(stopper):
    """Only a completed exact owned method can consume this private continuation."""
    require(isinstance(stopper, HR_FINITE_STOP.FixedStop)
            and isinstance(stopper._owner, HR_OWNED_STOP._Owner)
            and stopper._owner._stop_claim is stopper and not stopper._unknown
            and stopper._completion is not None, 'STOP_COMPLETION_UNKNOWN')
    stopper._owner.check()
    host, at = stopper._completion
    stopper._completion = None  # Consume before create; crash/write failure never retries.
    j = journal()
    record = {'operationId': j.OPERATION_ID, 'hostId': host,
              'method': 'trusted_cp_controlled_stop_v1', 'atWallMs': at}
    require(valid(record), 'STOP_RECEIPT_SHAPE')
    raw = j.canonical(record)
    root, directory = j.opened_custody(False)
    fd = None
    try:
        fd = os.open('controlled-stop.json', os.O_WRONLY | os.O_CREAT | os.O_EXCL |
                     os.O_NOFOLLOW, 0o600, dir_fd=directory)
        view = memoryview(raw)
        while view:
            count = os.write(fd, view)
            require(count > 0, 'STOP_RECEIPT_WRITE_UNKNOWN')
            view = view[count:]
        os.fsync(fd)
        os.close(fd)
        fd = None
        os.fsync(directory)
    except OSError as exc:
        raise Rejected('STOP_RECEIPT_CREATE_UNKNOWN') from exc
    finally:
        if fd is not None:
            os.close(fd)
        j.close_custody(root, directory)
    stopper._owner.check()
    observed, digest = readback()
    require(observed == record and digest == hashlib.sha256(raw).hexdigest(),
            'STOP_RECEIPT_READBACK_UNKNOWN')
    return {'method': record['method'], 'receiptSha256': digest, 'atWallMs': at}
