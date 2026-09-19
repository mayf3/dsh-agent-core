"""Exact P4R9 pending-only preservation for one reviewed successor."""
if __name__ == "__main__":
    raise SystemExit("imported only by the exact reviewed first-live operator")

from bind_records import _object
from first_live_io import digest, require
import first_live_package as layout


def _directory(io, path, expected):
    value = io.metadata(path)
    require(value['type'] == 'Directory', 'P4R9_DIRECTORY_TYPE')
    for key in ('uid', 'gid', 'mode', 'flags', 'device', 'inode'):
        require(value[key] == expected[key], 'P4R9_DIRECTORY_BINDING:' + key)
    return value


def _protected(io, path, spec):
    before = io.expect(path, spec)
    raw = io.call(['/bin/cat', path], expected_digest=spec['sha256'])
    require(io.metadata(path) == before, 'P4R9_PROTECTED_CHANGED')
    return raw


def reconcile(io, raw):
    record = _object(raw, 4 * 1024 * 1024)
    require(set(record) == {'version','state','operation_id','execution_id','package_sha256',
        'operation_directory','packet_directory','first_live_intent','first_live_pending',
        'packet_names','payload_names','staging_files','installed_files','socket_directory',
        'retry_forbidden','production_target_mutation'},
        'P4R9_RECONCILIATION_SHAPE')
    require(record['version'] == 1 and record['state'] == 'P4R9_PENDING_ONLY_SUPERSEDED'
        and record['operation_id'] == layout.OPERATION
        and record['execution_id'] == 'first-live-dsh-20260918-01-p4-successor'
        and record['package_sha256'] == 'd320d4b27bcda875e459129ae6e449146295c4d6357677874678ef3b83d0090c'
        and record['retry_forbidden'] is True and record['production_target_mutation'] is False,
        'P4R9_RECONCILIATION_BINDING')
    for path in (layout.P4R9_OPERATION_ARCHIVE, layout.P4R9_PACKET_ARCHIVE):
        require(io.metadata(path, absent=True) is None, 'P4R9_ARCHIVE_ALREADY_PRESENT')
    _directory(io, layout.ROOT + '/first-live-operation', record['operation_directory'])
    require(io.call(['/bin/ls', '-1A', layout.ROOT + '/first-live-operation']) ==
            b'first-live-intent.json\n', 'P4R9_OPERATION_SHAPE')
    _protected(io, layout.ROOT + '/first-live-operation/first-live-intent.json',
               record['first_live_intent'])
    _protected(io, layout.ROOT + '/first-live-pending.json', record['first_live_pending'])
    _directory(io, layout.PACKET, record['packet_directory'])
    require(io.call(['/bin/ls', '-1A', layout.PACKET]).decode().splitlines() ==
            record['packet_names'], 'P4R9_PACKET_SHAPE')
    require(io.call(['/bin/ls', '-1A', layout.PACKET + '/payloads']).decode().splitlines() ==
            record['payload_names'], 'P4R9_PAYLOAD_SHAPE')
    for relative, spec in record['staging_files'].items():
        _protected(io, layout.PACKET + '/' + relative, spec)
    require(set(record['installed_files']) == {'agent-deployd','agent-deploy-issuer','agent-deployctl'},
            'P4R9_INSTALLED_SET')
    for name, spec in record['installed_files'].items():
        _protected(io, layout.CODE + '/' + name, spec)
    _directory(io, layout.SOCKET, record['socket_directory'])
    require(io.call(['/bin/ls', '-1A', layout.SOCKET]) == b'', 'P4R9_SOCKET_NOT_EMPTY')
    io.copy(raw, digest(raw), '0400',
            layout.ROOT + '/first-live-operation/successor-reconciliation.json')
    io.call(['/bin/mv', layout.ROOT + '/first-live-pending.json',
             layout.ROOT + '/first-live-operation/p4r9-pending.json'])
    io.call(['/bin/mv', layout.ROOT + '/first-live-operation', layout.P4R9_OPERATION_ARCHIVE])
    io.call(['/bin/mv', layout.PACKET, layout.P4R9_PACKET_ARCHIVE])
    io.call(['/bin/sync'])
    require(io.metadata(layout.ROOT + '/first-live-pending.json', absent=True) is None,
            'P4R9_PENDING_RETAINED_AT_ACTIVE_PATH')
    require(io.metadata(layout.ROOT + '/first-live-operation', absent=True) is None,
            'P4R9_OPERATION_RETAINED_AT_ACTIVE_PATH')
    require(io.metadata(layout.PACKET, absent=True) is None,
            'P4R9_PACKET_RETAINED_AT_ACTIVE_PATH')
    operation = _directory(io, layout.P4R9_OPERATION_ARCHIVE, record['operation_directory'])
    packet = _directory(io, layout.P4R9_PACKET_ARCHIVE, record['packet_directory'])
    require((operation['device'], operation['inode']) ==
            (record['operation_directory']['device'], record['operation_directory']['inode']),
            'P4R9_OPERATION_ARCHIVE_IDENTITY')
    require((packet['device'], packet['inode']) ==
            (record['packet_directory']['device'], record['packet_directory']['inode']),
            'P4R9_PACKET_ARCHIVE_IDENTITY')
    _protected(io, layout.P4R9_OPERATION_ARCHIVE + '/first-live-intent.json',
               record['first_live_intent'])
    _protected(io, layout.P4R9_OPERATION_ARCHIVE + '/p4r9-pending.json',
               record['first_live_pending'])
    _protected(io, layout.P4R9_OPERATION_ARCHIVE + '/successor-reconciliation.json',
               dict(uid=0, gid=0, mode='0400', nlink=1, flags=0, sha256=digest(raw)))
    _protected(io, layout.P4R9_PACKET_ARCHIVE + '/packet.json',
               record['staging_files']['packet.json'])
