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
    def __init__(self, *, _owner=None):
        self._owner = _owner
        self._attempted = False
        self._stopped = False
        self._unknown = False
        self._completion = None

    def stop(self, *, child=None):
        activation()  # Must precede inventory reads, process inspection and effects.
        require(child is None, 'OWNED_CHILD_UNSUPPORTED')
        require(self._owner is not None or globals().get('TEST_MODE', False), 'OWNED_CUSTODY_UNKNOWN')
        if self._owner is not None:
            self._owner.check()
        require(not self._attempted, 'STOP_NO_REPLAY')
        self._attempted = True
        try:
            if self._owner is not None:
                self._owner.claim_stop(self)
            inventory = globals().get('HR_INVENTORY')
            require(inventory is not None, 'SOURCE_CLOSURE_UNKNOWN')
            observed = inventory.fixed_installed_inventory()
            require(observed.get('unresolvedSources') == [], 'SOURCE_CLOSURE_UNKNOWN')
            # Current real inventory always reports LE1, so this path stays ineligible.
            # Only disposable method tests supply an explicit surrogate inventory.
            custody = globals().get('HR_JOURNAL')
            require(custody is not None, 'INTENT_UNKNOWN')
            intent, _ = custody.readback('intent')
            require(intent.get('phase') == 'INTENT', 'INTENT_UNKNOWN')
            if self._owner is not None:
                package = HR_REAL_OS.require_activation()
                HR_REAL_OS.deployed_prerequisites(package, self._owner.opened_at)
                host = package.get('hostId')
                require(type(host) is str and 0 < len(host) <= 128, 'STOP_HOST_UNKNOWN')
                HR_STOP_RECEIPT.require_absent()
            deadline = time.monotonic() + 30
            for route in ROUTES:
                if self._owner is not None:
                    self._owner.check()
                check(deadline)
                require(command(route, 'bootout', deadline) in (0, 113), 'STOP_UNKNOWN')
                require(command(route, 'print', deadline) == 113, 'SOURCE_RESUMED')
            if self._owner is not None:
                check(deadline)
                self._owner.check()
                completed_at = int(time.time() * 1000)
                require(self._owner.opened_at < completed_at <= (1 << 53) - 1,
                        'STOP_COMPLETION_TIME_UNKNOWN')
                self._completion = (host, completed_at)
                receipt = HR_STOP_RECEIPT.seal_completed(self)
            else:
                receipt = None  # Standalone TEST_MODE method fixture only.
            self._stopped = True
            return receipt
        except BaseException:
            self._unknown = True
            raise

    def observe(self):
        activation()
        require(self._stopped and not self._unknown, 'STOP_UNKNOWN')
        deadline = time.monotonic() + 10
        try:
            for route in ROUTES:
                if self._owner is not None:
                    self._owner.check()
                require(command(route, 'print', deadline) == 113, 'SOURCE_RESUMED')
        except BaseException:
            self._unknown = True
            raise
        # A route observation is NOT continuous source closure/window proof.
        return None
