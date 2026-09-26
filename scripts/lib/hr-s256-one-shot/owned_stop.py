"""Private fixed-handler capability connection, not continuous host proof."""
import fcntl
import os
import stat


class Rejected(Exception):
    pass


def require(ok, code):
    if not ok:
        raise Rejected(code)


def guard():
    if globals().get('TEST_MODE', False):
        require(os.path.realpath(STATE_ROOT) != '/private/var/db/agent-deploy-system',
                'PROFILE_NOT_BOOTSTRAPPED')
    else:
        adapter = globals().get('HR_REAL_OS')
        require(adapter is not None, 'PROFILE_NOT_BOOTSTRAPPED')
        adapter.require_activation()


def identity(fd):
    meta = os.fstat(fd)
    require(stat.S_ISREG(meta.st_mode), 'OWNED_FD_INVALID')
    return [meta.st_dev, meta.st_ino]


class _Owner:
    def __init__(self, canonical_fd, window_fd):
        guard()  # Before protected path/intent reads or descriptor inspection.
        self.canonical = canonical_fd
        self.window = window_fd
        self.canonical_dup = None
        self.window_dup = None
        self.unknown = False
        self.closed = False
        self.intent, self.intent_digest = HR_JOURNAL.readback('intent')
        self.paths = (state_path('mutation.lock'), os.path.join(state_path(HR_JOURNAL.DIRECTORY), 'window.lock'))
        try:
            self.canonical_identity = identity(canonical_fd)
            self.window_identity = identity(window_fd)
            self.canonical_dup = os.dup(canonical_fd)
            self.window_dup = os.dup(window_fd)
            self.check()
        except BaseException:
            self.close()
            raise

    def check(self):
        guard()
        require(not self.closed and not self.unknown, 'OWNED_CUSTODY_UNKNOWN')
        try:
            current, digest = HR_JOURNAL.readback('intent')
            require(current == self.intent and digest == self.intent_digest, 'OWNED_INTENT_CHANGED')
            for original, duplicate, expected, path in (
                    (self.canonical, self.canonical_dup, self.canonical_identity, self.paths[0]),
                    (self.window, self.window_dup, self.window_identity, self.paths[1])):
                require(identity(original) == expected and identity(duplicate) == expected
                        and HR_HANDOFF.same_open_file_description(duplicate, original, expected),
                        'OWNED_FD_CHANGED')
                probe = os.open(path, os.O_RDWR | os.O_NOFOLLOW)
                try:
                    meta = os.fstat(probe)
                    require(identity(probe) == expected and meta.st_uid == os.geteuid()
                            and not (meta.st_mode & 0o022), 'OWNED_PATH_CHANGED')
                    try:
                        fcntl.flock(probe, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    except BlockingIOError:
                        continue
                    else:
                        fcntl.flock(probe, fcntl.LOCK_UN)
                        raise Rejected('OWNED_LOCK_RELEASED')
                finally:
                    os.close(probe)
        except BaseException:
            self.unknown = True
            raise
        # Local retained FD/lock checks do not prove LE1/source continuity.

    def fixed_stop(self):
        self.check()
        return HR_FINITE_STOP.FixedStop(_owner=self)

    def close(self):
        # No LOCK_UN: close only private duplicates; original handler IO retains locks.
        self.closed = True
        for name in ('canonical_dup', 'window_dup'):
            fd = getattr(self, name)
            if fd is not None:
                os.close(fd)
                setattr(self, name, None)


def capture_from_handler(canonical_fd, window_fd):
    """Internal call immediately after this handler seals intent and owns window."""
    return _Owner(canonical_fd, window_fd)
