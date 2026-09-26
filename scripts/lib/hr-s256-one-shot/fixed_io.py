"""Conditional fixed IO; installed activation/live LE1 remain unresolved."""
import fcntl
import hashlib
import json
import os
import subprocess
import threading
import time


class FixedIO:
    def __init__(self):
        self._package = HR_REAL_OS.require_activation()  # Before any protected IO.
        self._window = None
        self._owner = None
        self._intent = None
        self._stop = None
        self._inventory = None
        self._old_pids = None
        self._nonce = None
        self._receipts = {}
        self._child = None
        self._child_identity = None
        self._launched = False
        self._challenge_digest = None
        self._challenge_thread = None
        self._challenge_stop = threading.Event()
        self._startup_done = threading.Event()
        self._consumption = None
        self._startup_deadline = None
        self._unknown = False

    def _active(self):
        HR_PROFILE.require(not self._unknown, 'FIXED_IO_UNKNOWN')
        HR_PROFILE.require(HR_REAL_OS.require_activation() == self._package,
                           'ACTIVATION_PACKAGE_CHANGED')

    def wall_ms(self):
        return int(time.time() * 1000)

    def bind_intent_nonce(self, nonce):
        self._active()
        intent, _ = HR_JOURNAL.readback('intent')
        HR_PROFILE.require(self._nonce is None and type(nonce) is str
            and hashlib.sha256(nonce.encode()).hexdigest() == intent['nonceSha256'],
            'PRIVATE_NONCE_UNBOUND')
        self._nonce = nonce

    def _seal_cut(self, name, value):
        HR_PROFILE.require(name in ('exclusive-window', 'launch-sources-inhibited',
                                    'old-tree-quiesced'), 'FIXED_RECEIPT_NAME')
        raw = json.dumps(value, sort_keys=True, separators=(',', ':')).encode()
        root, directory = HR_JOURNAL.opened_custody(False)
        descriptor = None
        try:
            descriptor = os.open(name + '.json', os.O_WRONLY | os.O_CREAT | os.O_EXCL |
                                 os.O_NOFOLLOW, 0o600, dir_fd=directory)
            remaining = raw
            while remaining:
                count = os.write(descriptor, remaining)
                HR_PROFILE.require(count > 0, 'CUT_RECEIPT_WRITE_UNKNOWN')
                remaining = remaining[count:]
            os.fsync(descriptor)
            os.close(descriptor)
            descriptor = None
            os.fsync(directory)
            observed = HR_REAL_OS.protected_bytes(
                HR_REAL_OS.Path(STATE_ROOT) / HR_JOURNAL.DIRECTORY / (name + '.json'))
            HR_PROFILE.require(observed == raw, 'CUT_RECEIPT_READBACK_UNKNOWN')
            self._receipts[name] = hashlib.sha256(raw).hexdigest()
            return self._receipts[name]
        except BaseException:
            self._unknown = True
            raise
        finally:
            if descriptor is not None:
                os.close(descriptor)
            HR_JOURNAL.close_custody(root, directory)

    def preflight(self, projection):
        self._active()
        HR_ONE_SHOT.normalized_subject(projection)
        HR_REAL_OS.deployed_prerequisites(self._package, self.wall_ms())
        inventory = HR_INVENTORY.fixed_installed_inventory()
        HR_PROFILE.require(inventory['subjectPreimageSha256'] ==
                           projection['subjectPreimageSha256'], 'PREFLIGHT_SUBJECT_CHANGED')
        HR_PROFILE.require(inventory['unresolvedSources'] == [], 'SOURCE_CLOSURE_UNKNOWN')
        paths = inventory['holderPaths']
        HR_PROFILE.require(type(paths) is list and 1 <= len(paths) <= 16,
                           'HOLDER_SCOPE_UNKNOWN')
        old_pids = HR_REAL_OS.old_runtime_membership()
        self._inventory = inventory
        self._old_pids = old_pids
        return {'hostId': self._package['hostId'],
                'binarySha256': self._package['consumingBinarySha256'],
                'oldPids': old_pids, 'holderPaths': paths}

    def open_fixed_window(self):
        self._active()
        HR_PROFILE.require(self._window is None and self._intent is None,
                           'WINDOW_NO_REPLAY')
        intent, digest = HR_JOURNAL.readback('intent')
        opened_at = self.wall_ms()
        HR_PROFILE.require(opened_at > intent['atWallMs'], 'WINDOW_TIME_UNKNOWN')
        root, directory = HR_JOURNAL.opened_custody(False)
        try:
            fd = os.open('window.lock', os.O_RDWR | os.O_CREAT | os.O_EXCL |
                         os.O_NOFOLLOW, 0o600, dir_fd=directory)
            # Retain this exact capability before any fallible post-create step.
            self._window = fd
            self._intent = digest
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            os.fsync(fd)
            os.fsync(directory)
            self._active()
            HR_PROFILE.require(HR_JOURNAL.readback('intent')[1] == digest,
                               'INTENT_CHANGED')
            if self._nonce is not None:
                self._seal_cut('exclusive-window', {'operationId': HR_PROFILE.OPERATION_ID,
                    'hostId': self._package['hostId'], 'startupNonce': self._nonce,
                    'windowLockPath': str(HR_REAL_OS.Path(STATE_ROOT) / HR_JOURNAL.DIRECTORY / 'window.lock'),
                    'windowOpenedAtWallMs': opened_at})
            return fd, opened_at
        except Exception:
            self._unknown = True
            raise
        finally:
            HR_JOURNAL.close_custody(root, directory)

    def attach_owned_stop(self, owner):
        self._active()
        HR_PROFILE.require(self._owner is None and type(owner) is HR_OWNED_STOP._Owner,
                           'PRIVATE_OWNER_REQUIRED')
        owner.check()
        HR_PROFILE.require(owner.window_identity == HR_HANDOFF.window_identity(self._window)
                           and HR_JOURNAL.readback('intent')[1] == self._intent,
                           'PRIVATE_WINDOW_INTENT_CHANGED')
        self._owner = owner

    def inhibit_fixed_sources(self):
        self._active()
        HR_PROFILE.require(self._owner is not None and self._stop is None,
                           'PRIVATE_STOP_NO_REPLAY')
        try:
            self._owner.check()
            if self._inventory is not None:
                # Eligible scope is the independently qualified root bootstrap
                # manifest, plus fresh installed descriptor identities. It is
                # not inferred from MF1 entries or a UID-zero point sample.
                current = HR_INVENTORY.fixed_installed_inventory()
                HR_PROFILE.require(current == self._inventory and self._nonce is not None,
                                   'INSTALLED_SOURCE_CHANGED')
                inhibited = self.wall_ms()
                HR_PROFILE.require(inhibited > self._owner.opened_at, 'INHIBITION_TIME_UNKNOWN')
                self._seal_cut('launch-sources-inhibited', {
                    'operationId': HR_PROFILE.OPERATION_ID, 'hostId': self._package['hostId'],
                    'startupNonce': self._nonce, 'atWallMs': inhibited, 'complete': True})
            self._stop = self._owner.fixed_stop()
            receipt = self._stop.stop()  # Existing fixed routes, budgets and V7 seal.
            self._owner.check()
            # Route absence is only this method's observation. It cannot become
            # a complete source/window receipt or an old-child-exit assertion.
            return inhibited if self._inventory is not None else receipt['atWallMs']
        except Exception:
            self._unknown = True
            raise

    def quiesce_fixed_tree(self):
        self._active()
        HR_PROFILE.require(self._stop is not None, 'PRIVATE_STOP_REQUIRED')
        self._owner.check()
        if self._inventory is None or self._old_pids is None:
            self._unknown = True
            raise HR_PROFILE.Rejected('OLD_TREE_QUIESCENCE_NOT_CONNECTED')
        try:
            self._stop.observe()
            HR_REAL_OS.observe_no_runtime_uid_before_launch()
            census = HR_COLLECTOR.collect_whole_host(self._old_pids, self._inventory['holderPaths'])
            HR_PROFILE.require(census['runtimeTreeProcessCount'] == 0, 'OLD_TREE_PRESENT')
            self._owner.check()
            stopped, _ = HR_STOP_RECEIPT.readback()
            quiesced = self.wall_ms()
            HR_PROFILE.require(quiesced > stopped['atWallMs'], 'QUIESCENCE_TIME_UNKNOWN')
            self._seal_cut('old-tree-quiesced', {'operationId': HR_PROFILE.OPERATION_ID,
                'hostId': self._package['hostId'], 'startupNonce': self._nonce,
                'atWallMs': quiesced, 'complete': True})
            return quiesced
        except BaseException:
            self._unknown = True
            raise

    def observed_entry_closure(self):
        self._active()
        scope = HR_REAL_OS.qualified_source_scope()
        self._owner.check()
        return scope['entryManifest'], [value for value in scope['sources']
                                         if value != 'fixed-DS-owner']

    def final_bundle_bytes(self, authorization, launch_digest, archive, opened, quiesced):
        self._active()
        self._owner.check()
        HR_PROFILE.require(HR_JOURNAL.readback('launch-authorization')[1] == launch_digest
            and authorization['startupNonce'] == self._nonce
            and opened == self._owner.opened_at, 'FINAL_AUTHORIZATION_UNBOUND')
        stopped, stop_digest = HR_STOP_RECEIPT.readback()
        observed_archive = HR_ARCHIVE.readback()
        HR_PROFILE.require(observed_archive['archiveSha256'] == archive['archiveSha256']
            and observed_archive['archive']['hostId'] == self._package['hostId'],
            'FINAL_ARCHIVE_CHANGED')
        source_root, source_dir = HR_ARCHIVE.opened_directory(False)
        root, directory = HR_JOURNAL.opened_custody(False)
        try:
            for name in HR_ARCHIVE.FILES:
                raw = HR_ARCHIVE.read_file(source_dir, name)
                descriptor = os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL |
                                     os.O_NOFOLLOW, 0o600, dir_fd=directory)
                try:
                    view = memoryview(raw)
                    while view:
                        count = os.write(descriptor, view)
                        HR_PROFILE.require(count > 0, 'FINAL_ARCHIVE_WRITE_UNKNOWN')
                        view = view[count:]
                    os.fsync(descriptor)
                finally:
                    os.close(descriptor)
                HR_PROFILE.require(HR_REAL_OS.protected_bytes(HR_REAL_OS.Path(STATE_ROOT) /
                    HR_JOURNAL.DIRECTORY / name) == raw, 'FINAL_ARCHIVE_READBACK_UNKNOWN')
            os.fsync(directory)
            self._owner.check()
        except BaseException:
            self._unknown = True
            raise
        finally:
            HR_JOURNAL.close_custody(root, directory)
            HR_ARCHIVE.os.close(source_dir)
            HR_ARCHIVE.os.close(source_root)
        bundle = {'bundleSchemaVersion': 2, 'subject': authorization['subject'],
            'epochRetirement': {'retiredEpoch': authorization['subject']['runtimeEpoch']},
            'recoveryCutover': {'operationId': HR_PROFILE.OPERATION_ID,
                'hostId': self._package['hostId'], 'startupNonce': self._nonce,
                'subjectPreimageSha256': authorization['subjectPreimageSha256'],
                'exclusiveWindowReceiptSha256': self._receipts['exclusive-window'],
                'launchSourcesInhibitedReceiptSha256': self._receipts['launch-sources-inhibited'],
                'oldTreeQuiescedReceiptSha256': self._receipts['old-tree-quiesced'],
                'launchAuthorizationReceiptSha256': launch_digest,
                'windowOpenedAtWallMs': opened, 'oldTreeQuiescedAtWallMs': quiesced,
                'authorizedStartupAtWallMs': authorization['authorizedStartupAtWallMs'],
                'consumingBinarySha256': authorization['consumingBinarySha256']},
            'deploymentProof': {key: self._package[key] for key in
                ('floorProvenReceiptSha256', 'validatorInstalledReceiptSha256')},
            'hostCensus': archive['hostCensus'], 'holderCheck': archive['holderCheck'],
            'custody': {'executedAs': 'root',
                'producedBy': 'trusted_cp_recovery_evidence_collector_v1',
                'evidenceDir': str(HR_REAL_OS.Path(STATE_ROOT) / HR_JOURNAL.DIRECTORY)},
            'controlledStop': {'method': stopped['method'],
                'receiptSha256': stop_digest, 'atWallMs': stopped['atWallMs']}}
        bundle['deploymentProof']['deployedBinarySha256'] = authorization['consumingBinarySha256']
        return json.dumps(bundle, sort_keys=True, separators=(',', ':')).encode()

    def observe_custody(self, lock_fd, window, child):
        self._active()
        try:
            HR_PROFILE.require(self._owner is not None and lock_fd == self._owner.canonical
                and window == self._window and child is self._child, 'PRIVATE_CUSTODY_UNBOUND')
            self._owner.check()
            HR_PROFILE.require(HR_INVENTORY.fixed_source_identities() == self._inventory['sources'],
                               'INSTALLED_SOURCE_CHANGED')
            self._stop.observe()
            if child is None:
                HR_REAL_OS.observe_no_runtime_uid_before_launch()
            else:
                HR_PROFILE.require(child.poll() is None and self._child_identity is not None,
                                   'OWNED_STARTUP_LOST')
                HR_REAL_OS.observe_owned_runtime_residents(child)
            HR_PROFILE.require('launch-sources-inhibited' in self._receipts,
                               'INHIBITION_RECEIPT_UNKNOWN')
            return {'ownedChild': self._child_identity,
                'windowIdentity': self._owner.window_identity,
                'canonicalLockIdentity': self._owner.canonical_identity,
                # This existing immutable intent is bound to these capabilities
                # by the private handler owner, never a serialized PID assertion.
                'canonicalLockOwnershipReceiptSha256': self._owner.intent_digest,
                'launchSourcesInhibitedReceiptSha256': self._receipts['launch-sources-inhibited'],
                'windowHeld': True, 'canonicalLockHeld': True, 'sourcesInhibited': True}
        except BaseException:
            self._unknown = True
            raise

    def _spawn_child(self, argv, descriptors):
        return subprocess.Popen(argv, pass_fds=tuple(descriptors),
            stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            user=505, group=601, extra_groups=[], env={'PATH': '/usr/bin:/bin'})

    def _single_bundle(self, directory):
        entries = os.listdir(directory)
        HR_PROFILE.require(len(entries) <= 64 and not any(name != 'bundle.json'
            and name.endswith('.bundle.json') for name in entries), 'EVIDENCE_BATCH_POLLUTED')

    def launch_fixed(self, challenge_fd, window_fd, receipt):
        self._active()
        self._owner.check()
        HR_PROFILE.require(not self._launched and self._child is None
            and HR_JOURNAL.readback('launch-authorization')[1] == receipt
            and HR_HANDOFF.same_open_file_description(self._window, window_fd,
                                                     self._owner.window_identity),
            'PRIVATE_LAUNCH_UNBOUND')
        self._launched = True  # Before any fallible FD open or process effect.
        self._startup_deadline = time.monotonic() + 120
        claim = HR_JOURNAL.readback('launch-claimed')[1]
        names = ('intent.json', 'launch-authorization.json', 'bundle-commitment.json',
            'live-handle-index.json', 'phase-sealed.json', 'phase-launch-attempt.json',
            'launch-claimed.json', 'bundle.json', 'exclusive-window.json',
            'launch-sources-inhibited.json', 'old-tree-quiesced.json', 'controlled-stop.json',
            'census-ps.txt', 'census-lsof.txt', 'census-archive.json', 'phase-unknown.json',
            'phase-abandoned.json', 'phase-closed.json', 'key-tombstone.json')
        descriptors = []
        try:
            directory = os.open(HR_REAL_OS.Path(STATE_ROOT) / HR_JOURNAL.DIRECTORY,
                                os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
            descriptors.append(directory)
            self._single_bundle(directory)
            deployment = os.open(HR_REAL_OS.DEPLOYMENT_DIR,
                                 os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
            descriptors.append(deployment)
            for index, name in enumerate(names):
                try:
                    fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=directory)
                except FileNotFoundError:
                    HR_PROFILE.require(index >= 15, 'STARTUP_RECEIPT_MISSING')
                    fd = -1
                else:
                    HR_PROFILE.require(index < 15, 'OPERATION_ALREADY_TERMINAL')
                descriptors.append(fd)
            for name in ('floor-proven.json', 'validator-installed.json'):
                descriptors.append(os.open(name, os.O_RDONLY | os.O_NOFOLLOW, dir_fd=deployment))
            argv = [HR_REAL_OS.NODE, str(HR_REAL_OS.APP_ROOT /
                'packages/production-runtime/src/native-arm64/hr-s256-r2-gated-runtime.mjs'),
                '--hr-r2-receipt-sha256', receipt, '--hr-r2-challenge-fd', str(challenge_fd),
                '--hr-r2-window-fd', str(window_fd), '--hr-r2-receipt-fds', json.dumps(descriptors),
                '--root', str(HR_REAL_OS.PRODUCTION_ROOT)]
            self._child = self._spawn_child(argv,
                [challenge_fd, window_fd] + [fd for fd in descriptors if fd >= 0])
            self._child_identity = {'pid': self._child.pid, 'identitySha256':
                hashlib.sha256(json.dumps([claim, receipt, self._nonce, self._child.pid],
                    separators=(',', ':')).encode()).hexdigest()}
            return self._child
        except BaseException:
            self._unknown = True
            raise
        finally:
            for descriptor in descriptors:
                if descriptor >= 0:
                    os.close(descriptor)

    def attach_authenticated_handoff(self, handoff, digest):
        self._active()
        HR_PROFILE.require(type(handoff) is HR_HANDOFF.OneLaunchHandoff
            and handoff.used and HR_PROFILE.valid_hash(digest)
            and self._challenge_digest is None, 'AUTHENTICATED_HANDOFF_UNBOUND')
        self._challenge_digest = digest
        deadline = self._startup_deadline

        def serve():
            try:
                while not self._challenge_stop.is_set():
                    HR_PROFILE.require(time.monotonic() < deadline, 'STARTUP_DEADLINE')
                    handoff.root.settimeout(min(0.25, max(0, deadline - time.monotonic())))
                    raw = bytearray()
                    try:
                        first = handoff.root.recv(1)
                    except TimeoutError:
                        continue
                    HR_PROFILE.require(bool(first), 'LIVE_CHALLENGE_CLOSED')
                    raw.extend(first)
                    request_deadline = time.monotonic() + 0.75
                    while not raw.endswith(b'\n'):
                        remaining = request_deadline - time.monotonic()
                        HR_PROFILE.require(remaining > 0 and len(raw) < 4096, 'LIVE_CHALLENGE_BOUND')
                        handoff.root.settimeout(remaining)
                        part = handoff.root.recv(1)
                        HR_PROFILE.require(bool(part), 'LIVE_CHALLENGE_CLOSED')
                        raw.extend(part)
                    query = json.loads(raw)
                    HR_PROFILE.require(type(query) is dict and set(query) == {
                        'operationId', 'hostId', 'startupNonce', 'challenge'}
                        and query['operationId'] == HR_PROFILE.OPERATION_ID
                        and query['hostId'] == self._package['hostId']
                        and query['startupNonce'] == self._nonce
                        and type(query['challenge']) is str and (len(query['challenge']) == 32
                            or query['challenge'] == 'startup-consumption-finished'),
                        'LIVE_CHALLENGE_BINDING')
                    self._active()
                    self._owner.check()
                    root, directory = HR_JOURNAL.opened_custody(False)
                    try:
                        self._single_bundle(directory)
                    finally:
                        HR_JOURNAL.close_custody(root, directory)
                    HR_PROFILE.require(HR_INVENTORY.fixed_source_identities() == self._inventory['sources']
                        and self._child.poll() is None, 'LIVE_SOURCE_UNKNOWN')
                    if query['challenge'] == 'startup-consumption-finished':
                        HR_PROFILE.require(not self._startup_done.is_set(), 'STARTUP_NOTICE_NO_REPLAY')
                        self._startup_done.set()  # Notice is not settlement proof.
                        continue
                    remaining = request_deadline - time.monotonic()
                    HR_PROFILE.require(remaining > 0, 'LIVE_CHALLENGE_BOUND')
                    handoff.root.settimeout(remaining)
                    handoff.root.sendall(json.dumps({**query, 'exclusiveWindowHeld': True,
                        'launchSourcesStillInhibited': True, 'windowClosed': False},
                        separators=(',', ':')).encode() + b'\n')
            except BaseException:
                if not self._challenge_stop.is_set():
                    self._unknown = True
        self._challenge_thread = threading.Thread(target=serve, daemon=True)
        self._challenge_thread.start()

    def startup_observation(self, child, receipt):
        self._active()
        HR_PROFILE.require(child is self._child and child.poll() is None
            and HR_PROFILE.valid_hash(self._challenge_digest), 'STARTUP_UNAVAILABLE')
        return {'launchAuthorizationReceiptSha256': receipt,
            'consumingBinarySha256': self._package['consumingBinarySha256'],
            'challengeReceiptSha256': self._challenge_digest}

    def exact_consumption_readback(self, child):
        self._active()
        HR_PROFILE.require(child is self._child and self._consumption is None,
                           'READBACK_NO_REPLAY')
        deadline = self._startup_deadline
        while not self._startup_done.wait(timeout=0.1):
            self._active()
            self._owner.check()
            HR_PROFILE.require(time.monotonic() < deadline and child.poll() is None,
                               'CONSUMPTION_STARTUP_UNAVAILABLE')
        self._active()
        self._owner.check()
        try:
            # No caller notice, challenge answer or child exit substitutes for
            # the actual pinned validator/current durable store readback.
            self._consumption = HR_REAL_OS.fixed_settlement_readback()
            return dict(self._consumption)
        except BaseException:
            self._unknown = True
            raise

    def verified_disposition(self, child):
        self._active()
        HR_PROFILE.require(child is self._child and child.poll() is None
            and self._consumption is not None, 'RELEASE_CONDITION_UNKNOWN')
        self.observe_custody(self._owner.canonical, self._window, child)
        phase, receipt = HR_LIFECYCLE.readback('phase-consumption')
        HR_PROFILE.require(phase['observation']['settlement'] == self._consumption['settlement']
            and phase['observation']['storeReadbackReceiptSha256'] ==
                self._consumption['storeReadbackReceiptSha256'], 'RELEASE_READBACK_UNBOUND')
        current = HR_REAL_OS.installed_settlement_projection(HR_PROJECTION,
            HR_READBACK_HELPER_SOURCE, HR_READBACK_HELPER_SHA256)
        HR_PROFILE.require(current['settlement'] == self._consumption['settlement'],
                           'RELEASE_SETTLEMENT_CHANGED')
        # These refs qualify the existing composite consumption receipt as the
        # verified release CONDITION (owned child, sources, both held FDs and
        # actual target settlement). They do not claim physical unlock occurred.
        return {'ownedChildDispositionReceiptSha256': receipt,
            'launchSourceDispositionReceiptSha256': receipt,
            'windowReleaseReceiptSha256': receipt,
            'canonicalLockDispositionReceiptSha256': receipt,
            'businessOutcome': 'outcome_unknown'}

    def release_verified(self, window, lock):
        self._active()
        HR_PROFILE.require(window == self._window and lock == self._owner.canonical
            and HR_LIFECYCLE.snapshot()['disposition'] == 'CLOSED', 'RELEASE_NOT_CLOSED')
        self._owner.check()
        self._challenge_stop.set()
        if self._challenge_thread is not None:
            self._challenge_thread.join(timeout=0.75)
            HR_PROFILE.require(not self._challenge_thread.is_alive(), 'CHALLENGE_OWNER_NOT_STOPPED')
        # The fixed DS remains parent of the exact created, continuing Runtime.
        # No process ownership is recreated from a serialized PID.
        HR_FIXED_IO._completed_child = self._child
        fcntl.flock(window, fcntl.LOCK_UN)
        fcntl.flock(lock, fcntl.LOCK_UN)
        os.close(window)
        self._window = None

    def retain_unknown(self, window, child):
        # Custody stays in the existing fixed handler; no release, retry or
        # serialized assertion of process ownership is introduced here.
        self._unknown = True
