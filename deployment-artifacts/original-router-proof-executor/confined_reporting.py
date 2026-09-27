"""Test-only traceback lines: memory only, never filesystem fallback."""
import linecache
from unittest.mock import patch


def memory_reporter(sources):
    # Copies of exact source bytes loaded by the test harness before target
    # import. This table does not grant permission to open or stat any path.
    lines = {name:text.splitlines(keepends=True) for name,text in sources.items()}
    return (patch.object(linecache,'getlines',lambda name,*args:lines.get(name,[])),
            patch.object(linecache,'checkcache',lambda *args:None))
