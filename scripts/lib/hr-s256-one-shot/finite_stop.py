"""Fixed route stop primitives; not a complete source closure or launch owner.

Production remains inactive. Incomplete installed inventory prevents effects.
No caller can select routes, paths, PIDs, signals, or retry an attempted stop.
"""
import selectors
import subprocess
import time

ROUTES = ('gui/505/ai.agent-core.runtime', 'system/ai.agent-core.runtime')
CAP = 65536


class Rejected(Exception):
    pass


def require(ok, code):
    if not ok:
        raise Rejected(code)


def activation():
    adapter = globals().get('HR_REAL_OS')
    require(adapter is not None, 'PROFILE_NOT_BOOTSTRAPPED')
    adapter.require_activation()


def check(deadline):
    require(time.monotonic() < deadline, 'STOP_DEADLINE')


def command(route, verb, deadline):
    """Fixed absolute launchctl only, bounded streams, no private output archive."""
    activation()
    require(route in ROUTES and verb in ('bootout', 'print'), 'STOP_ROUTE_UNKNOWN')
    check(deadline)
    child = subprocess.Popen(['/bin/launchctl', verb, route], stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, env={'PATH': '/usr/bin:/bin', 'LANG': 'C'})
    total = 0
    try:
        with selectors.DefaultSelector() as selector:
            selector.register(child.stdout, selectors.EVENT_READ)
            selector.register(child.stderr, selectors.EVENT_READ)
            while selector.get_map():
                check(deadline)
                for key, _ in selector.select(max(0, deadline - time.monotonic())):
                    block = key.fileobj.read1(4096)
                    if not block:
                        selector.unregister(key.fileobj)
                    else:
                        total += len(block)
                        require(total <= CAP, 'STOP_OUTPUT_UNKNOWN')
            check(deadline)
            return child.wait(timeout=max(0, deadline - time.monotonic()))
    finally:
        # Only this exact owned command child; never a Runtime PID lookup/kill.
        if child.poll() is None:
            child.kill()
            child.wait(timeout=1)
        child.stdout.close()
        child.stderr.close()


class FixedStop:
    """One private attempt; failures permanently poison continuity for this owner."""
    def __init__(self):
        self._attempted = False
        self._stopped = False
        self._unknown = False

    def stop(self, *, child=None):
        activation()  # Must precede inventory reads, process inspection and effects.
        require(child is None, 'OWNED_CHILD_UNSUPPORTED')
        require(not self._attempted, 'STOP_NO_REPLAY')
        inventory = globals().get('HR_INVENTORY')
        require(inventory is not None, 'SOURCE_CLOSURE_UNKNOWN')
        observed = inventory.fixed_installed_inventory()
        require(observed.get('unresolvedSources') == [], 'SOURCE_CLOSURE_UNKNOWN')
        # Current real inventory always reports LE1, so this path stays ineligible.
        # Only disposable method tests supply an explicit surrogate inventory.
        self._attempted = True
        deadline = time.monotonic() + 30
        try:
            for route in ROUTES:
                check(deadline)
                require(command(route, 'bootout', deadline) in (0, 113), 'STOP_UNKNOWN')
                require(command(route, 'print', deadline) == 113, 'SOURCE_RESUMED')
            self._stopped = True
        except BaseException:
            self._unknown = True
            raise

    def observe(self):
        activation()
        require(self._stopped and not self._unknown, 'STOP_UNKNOWN')
        deadline = time.monotonic() + 10
        try:
            for route in ROUTES:
                require(command(route, 'print', deadline) == 113, 'SOURCE_RESUMED')
        except BaseException:
            self._unknown = True
            raise
        # A route observation is NOT continuous source closure/window proof.
        return None
