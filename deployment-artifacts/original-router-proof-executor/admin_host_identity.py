"""Fixed root-only host observer for the single reviewed s256 host binding.

Neither the old runtime epoch nor a caller-supplied host string is evidence of
host identity. This module is inert until a reviewed root package binds it.
"""
import os
import re
import selectors
import subprocess
import time


EXPECTED_HOST_ID = 'FF99ABD5-79A0-5EE0-9E0B-B62671271560'
HOST_COMMAND = ('/usr/sbin/ioreg', '-rd1', '-c', 'IOPlatformExpertDevice')
UUID_LINE = re.compile(r'^[| ]*"IOPlatformUUID" = "([A-F0-9]{8}(?:-[A-F0-9]{4}){3}-[A-F0-9]{12})"$')


class HostIdentityUnknown(Exception):
    pass


def parse_fixed_host(raw):
    if type(raw) is not bytes or len(raw) > 4096 or b'\x00' in raw:
        raise HostIdentityUnknown('ADMIN_HOST_OUTPUT_INVALID')
    try:
        lines = raw.decode('utf8', 'strict').splitlines()
    except UnicodeDecodeError as exc:
        raise HostIdentityUnknown('ADMIN_HOST_OUTPUT_INVALID') from exc
    found = []
    for line in lines:
        if 'IOPlatformUUID' not in line:
            continue
        match = UUID_LINE.fullmatch(line)
        if match is None:
            raise HostIdentityUnknown('ADMIN_HOST_FORMAT_INVALID')
        found.append(match.group(1))
    if found != [EXPECTED_HOST_ID]:
        raise HostIdentityUnknown('ADMIN_HOST_ID_MISMATCH')
    return EXPECTED_HOST_ID


def observe_fixed_host():
    if os.geteuid() != 0:
        raise HostIdentityUnknown('ADMIN_HOST_ROOT_REQUIRED')
    try:
        child = subprocess.Popen(HOST_COMMAND, stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, close_fds=True,
            env={'PATH': '/usr/bin:/bin', 'LANG': 'C', 'LC_ALL': 'C'})
    except (OSError, subprocess.SubprocessError) as exc:
        raise HostIdentityUnknown('ADMIN_HOST_OBSERVATION_UNKNOWN') from exc
    deadline = time.monotonic() + 2
    data = bytearray()
    selector = selectors.DefaultSelector()
    try:
        selector.register(child.stdout, selectors.EVENT_READ)
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise HostIdentityUnknown('ADMIN_HOST_TIMEOUT')
            if not selector.select(remaining):
                raise HostIdentityUnknown('ADMIN_HOST_TIMEOUT')
            chunk = os.read(child.stdout.fileno(), min(4097 - len(data), 4096))
            if not chunk:
                break
            data.extend(chunk)
            if len(data) > 4096:
                raise HostIdentityUnknown('ADMIN_HOST_OUTPUT_TOO_LARGE')
        if child.wait(timeout=max(0.001, deadline - time.monotonic())) != 0:
            raise HostIdentityUnknown('ADMIN_HOST_COMMAND_FAILED')
        return parse_fixed_host(bytes(data))
    except (OSError, subprocess.SubprocessError) as exc:
        raise HostIdentityUnknown('ADMIN_HOST_OBSERVATION_UNKNOWN') from exc
    finally:
        selector.close()
        if child.poll() is None:
            child.kill()
            child.wait()
        child.stdout.close()
