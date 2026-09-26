"""Synthetic test boundary: every process dispatch is denied, with no fallback."""
from contextlib import contextmanager
from unittest.mock import patch


class ProcessDispatchDenied(RuntimeError):
    pass


class DenyProcessDispatch:
    def __init__(self):
        self.calls = []

    def __call__(self, argv, *args, **kwargs):
        # Record only command identity, never environment values/private stdin.
        self.calls.append(tuple(argv) if isinstance(argv, (list, tuple)) else argv)
        raise ProcessDispatchDenied('SYNTHETIC_PROCESS_DISPATCH_DENIED')


@contextmanager
def confine_processes(scoped_subprocess):
    recorder = DenyProcessDispatch()
    with patch.object(scoped_subprocess, 'Popen', side_effect=recorder):
        yield recorder
