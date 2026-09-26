"""Test-only filesystem boundary; no protected-path fallback, no product API."""
import os
from pathlib import Path


class FilesystemDenied(RuntimeError):
    pass


class SandboxOpen:
    """Descriptor-aware open allowlist. Injected backend is never called on denial.

    Writable paths must be inside the one disposable sandbox. Read paths must
    be explicitly named inputs. Ancestors permit directory traversal only, not
    file reads. Descriptor-relative paths require a descriptor opened here.
    """
    def __init__(self, sandbox, readonly, backend):
        self.sandbox = os.path.normpath(str(sandbox))
        self.readonly = tuple(os.path.normpath(str(p)) for p in readonly)
        self.backend = backend
        self.descriptors = {}
        self.denied = []

    def _path(self, path, dir_fd):
        if not isinstance(path, (str, bytes, os.PathLike)):
            raise FilesystemDenied('SYNTHETIC_UNTRACKED_PATH')
        path = os.fsdecode(path)
        if os.path.isabs(path):
            if dir_fd is not None:
                raise FilesystemDenied('SYNTHETIC_AMBIGUOUS_DIRFD')
            return os.path.normpath(path)
        if dir_fd not in self.descriptors:
            raise FilesystemDenied('SYNTHETIC_UNTRACKED_DIRFD')
        return os.path.normpath(os.path.join(self.descriptors[dir_fd], path))

    @staticmethod
    def within(path, root):
        return path == root or path.startswith(root + os.sep)

    def check(self, path, flags, dir_fd=None):
        try:
            resolved = self._path(path, dir_fd)
            writes = flags & (os.O_WRONLY | os.O_RDWR | os.O_CREAT | os.O_TRUNC | os.O_APPEND)
            if writes:
                permitted = self.within(resolved, self.sandbox)
            else:
                permitted = any(self.within(resolved, root) for root in (self.sandbox, *self.readonly))
                if flags & os.O_DIRECTORY:
                    permitted = permitted or any(root.startswith(resolved.rstrip('/') + '/')
                        for root in (self.sandbox, *self.readonly))
            if not permitted:
                raise FilesystemDenied('SYNTHETIC_OUTSIDE_SANDBOX_IO')
            return resolved
        except FilesystemDenied:
            self.denied.append((os.fsdecode(path) if isinstance(path, (str, bytes, os.PathLike)) else '<untracked>', dir_fd))
            raise

    def __call__(self, path, flags, mode=0o777, *, dir_fd=None):
        resolved = self.check(path, flags, dir_fd)
        # No-follow is compulsory at the actual boundary, including absolute opens.
        fd = self.backend(path, flags | os.O_NOFOLLOW, mode, dir_fd=dir_fd)
        self.descriptors[fd] = resolved
        return fd

    def forget(self, fd):
        self.descriptors.pop(fd, None)


def confined_filesystem():
    """Test-only context: set boundary before target imports; cleanup inside it."""
    from contextlib import contextmanager, ExitStack
    import builtins
    import io
    import sys
    import tempfile
    from unittest.mock import patch
    @contextmanager
    def active():
        # Allocate only the explicitly disposable root before importing target code.
        directory = tempfile.TemporaryDirectory()
        root = str(Path(directory.name).resolve())
        repo = Path(__file__).resolve().parents[2]
        inputs = [repo, Path(sys.base_prefix), Path(sys.prefix),
            Path('/Users/yanfenma/workspace/artifacts/DEPLOYMENT_BACKLOG/coherent-v5-ds-update-prep-20260926-v1/artdir/deployment_system.py'),
            Path('/Users/yanfenma/workspace/artifacts/AGENT_CORE_DEPLOYMENT_SYSTEM_V1/ds-fixed-target-restart-successor-20260924-v5/ds-update-artifacts/deployment_system.py')]
        original_open, original_close = os.open, os.close
        guard = SandboxOpen(root, inputs, original_open)
        originals = {name: getattr(os, name) for name in ('mkdir', 'unlink', 'rmdir', 'rename', 'replace')}
        file_open, io_open = builtins.open, io.open
        def file_wrapper(original):
            def checked(file, mode='r', *args, **kwargs):
                if 'opener' in kwargs:
                    raise FilesystemDenied('SYNTHETIC_CALLER_OPENER_DENIED')
                if isinstance(file, int):
                    if file not in guard.descriptors:
                        raise FilesystemDenied('SYNTHETIC_UNTRACKED_FD')
                    return original(file, mode, *args, **kwargs)
                def opener(path, flags): return guard(path, flags, 0o600)
                return original(file, mode, *args, opener=opener, **kwargs)
            return checked
        def close(fd):
            guard.forget(fd)
            return original_close(fd)
        def mutate(name):
            def checked(path, *args, **kwargs):
                if name in ('rename', 'replace'):
                    guard.check(path, os.O_WRONLY, kwargs.get('src_dir_fd'))
                    guard.check(args[0], os.O_WRONLY, kwargs.get('dst_dir_fd'))
                else:
                    guard.check(path, os.O_WRONLY, kwargs.get('dir_fd'))
                return originals[name](path, *args, **kwargs)
            return checked
        with ExitStack() as stack:
            stack.enter_context(patch.object(tempfile, 'tempdir', root))
            stack.enter_context(patch.object(os, 'open', side_effect=guard))
            stack.enter_context(patch.object(os, 'close', side_effect=close))
            stack.enter_context(patch.object(builtins, 'open', side_effect=file_wrapper(file_open)))
            stack.enter_context(patch.object(io, 'open', side_effect=file_wrapper(io_open)))
            for name in originals: stack.enter_context(patch.object(os, name, side_effect=mutate(name)))
            try:
                yield guard
            finally:
                directory.cleanup()  # All teardown including removal remains guarded.
    return active()
