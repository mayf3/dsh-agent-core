"""Guarded fixed IO connection. Installed activation and LE1 remain unresolved.

This connects private intent/window/stop capabilities, not a complete launcher.
No request field can provide prerequisites, a path, a PID, or an observation.
"""
import fcntl
import os
import time


class FixedIO:
    def __init__(self):
        self._package = HR_REAL_OS.require_activation()  # Before any protected IO.
        self._window = None
        self._owner = None
        self._intent = None
        self._stop = None
        self._unknown = False

    def _active(self):
        HR_PROFILE.require(not self._unknown, 'FIXED_IO_UNKNOWN')
        HR_PROFILE.require(HR_REAL_OS.require_activation() == self._package,
                           'ACTIVATION_PACKAGE_CHANGED')

    def wall_ms(self):
        return int(time.time() * 1000)

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
        # The installed inventory deliberately retains LE1. Even after that is
        # supplied, exact old-tree observation is still an absent connection;
        # never fabricate membership from a PID or a fixture success assertion.
        raise HR_PROFILE.Rejected('OLD_TREE_OBSERVATION_NOT_CONNECTED')

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
            self._stop = self._owner.fixed_stop()
            receipt = self._stop.stop()  # Existing fixed routes, budgets and V7 seal.
            self._owner.check()
            # Route absence is only this method's observation. It cannot become
            # a complete source/window receipt or an old-child-exit assertion.
            return receipt['atWallMs']
        except Exception:
            self._unknown = True
            raise

    def quiesce_fixed_tree(self):
        self._active()
        HR_PROFILE.require(self._stop is not None, 'PRIVATE_STOP_REQUIRED')
        self._owner.check()
        self._unknown = True
        raise HR_PROFILE.Rejected('OLD_TREE_QUIESCENCE_NOT_CONNECTED')

    def retain_unknown(self, window, child):
        # Custody stays in the existing fixed handler; no release, retry or
        # serialized assertion of process ownership is introduced here.
        self._unknown = True
