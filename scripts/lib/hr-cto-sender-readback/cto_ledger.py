class HrCtoLedger:
    """Only the fixed CTO receipt names, held directories, and existing DS lock."""
    def __init__(self):
        self.fds = []
        self.trace = []
        self.lock = None
        self.locked = False
        self.claimed = False
        self.uid = os.getuid() if TEST_MODE else 0
        self.name = 'hr-cto-owner-sender-readback'
        self.receipt = HR_CTO_READ_ID + '.json'

    @staticmethod
    def identity(meta):
        return (meta.st_dev, meta.st_ino, meta.st_uid, meta.st_gid, meta.st_mode,
                meta.st_nlink if stat.S_ISREG(meta.st_mode) else None)

    def directory(self, name, parent=None, private=False):
        before = os.stat(name, dir_fd=parent, follow_symlinks=False)
        fd = os.open(name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC,
                     dir_fd=parent)
        self.fds.append(fd)
        meta = os.fstat(fd)
        require(self.identity(before) == self.identity(meta) and meta.st_uid == self.uid,
                'HR_CTO_CUSTODY_CHANGED')
        if parent is not None:
            require(not meta.st_mode & 0o022, 'HR_CTO_CUSTODY_CHANGED')
        if private:
            require(stat.S_IMODE(meta.st_mode) == 0o700, 'HR_CTO_CUSTODY_CHANGED')
        self.trace.append((name, parent, fd, self.identity(meta)))
        return fd

    def check(self):
        for name, parent, fd, identity in self.trace:
            current = os.stat(name, dir_fd=parent, follow_symlinks=False)
            require(self.identity(current) == self.identity(os.fstat(fd)) == identity,
                    'HR_CTO_CUSTODY_CHANGED')
        if self.lock is not None:
            current = os.stat('mutation.lock', dir_fd=self.state, follow_symlinks=False)
            require(self.identity(current) == self.identity(os.fstat(self.lock)) == self.lock_identity,
                    'HR_CTO_CUSTODY_CHANGED')

    def __enter__(self):
        try:
            self.state = self.directory(STATE_ROOT)
            before = os.stat('mutation.lock', dir_fd=self.state, follow_symlinks=False)
            # Existing shared lock only: no CREATE, replace, unlink or symlink follow.
            self.lock = os.open('mutation.lock', os.O_RDWR | os.O_NOFOLLOW | os.O_CLOEXEC,
                                dir_fd=self.state)
            self.fds.append(self.lock)
            meta = os.fstat(self.lock)
            self.lock_identity = self.identity(meta)
            require(self.identity(before) == self.lock_identity and stat.S_ISREG(meta.st_mode)
                    and meta.st_uid == self.uid and meta.st_nlink == 1
                    and not meta.st_mode & 0o022, 'HR_CTO_LOCK_CUSTODY')
            try:
                fcntl.flock(self.lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                raise Failure('MUTATION_ALREADY_RUNNING')
            self.locked = True
            self.receipts = self.directory('receipts', self.state)
            self.check()
            for name, parent in ((self.name, self.state), (self.receipt, self.receipts)):
                try:
                    os.stat(name, dir_fd=parent, follow_symlinks=False)
                except FileNotFoundError:
                    continue
                raise Failure('HR_CTO_OPERATION_CONSUMED')
            os.mkdir(self.name, 0o700, dir_fd=self.state)
            self.claimed = True
            os.fsync(self.state)
            self.private = self.directory(self.name, self.state, private=True)
            self.check()
            return self
        except BaseException:
            self.close()
            raise

    def _write(self, parent, name, record):
        self.check()
        raw = canonical(record)
        require(len(raw) <= 1024, 'HR_CTO_RESPONSE_BOUND')
        # Only fixed internal names are used; the syscall never re-resolves a parent path.
        temp = '.hr-cto-' + str(os.getpid()) + '-' + record['state'] + '.tmp'
        fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW | os.O_CLOEXEC,
                     0o600, dir_fd=parent)
        try:
            offset = 0
            while offset < len(raw):
                count = os.write(fd, raw[offset:])
                require(count > 0, 'HR_CTO_WRITE_UNKNOWN')
                offset += count
            os.fsync(fd)
            meta = os.fstat(fd)
            require(stat.S_ISREG(meta.st_mode) and meta.st_uid == self.uid
                    and meta.st_nlink == 1 and stat.S_IMODE(meta.st_mode) == 0o600
                    and meta.st_size == len(raw), 'HR_CTO_CUSTODY_CHANGED')
            require(self.identity(os.stat(temp,dir_fd=parent,follow_symlinks=False))
                    == self.identity(meta), 'HR_CTO_CUSTODY_CHANGED')
            self.check()
            os.replace(temp, name, src_dir_fd=parent, dst_dir_fd=parent)
            os.fsync(parent)
            require(self.identity(os.stat(name,dir_fd=parent,follow_symlinks=False))
                    == self.identity(meta), 'HR_CTO_CUSTODY_CHANGED')
            self.check()
        finally:
            os.close(fd)
        # On failure retain any owned temp plus INTENT/claim; never clean or retry.

    def intent(self, record):
        self._write(self.private, 'intent.json', record)
        self._write(self.receipts, self.receipt, record)

    def terminal(self, record):
        self._write(self.receipts, self.receipt, record)

    def close(self):
        if self.locked:
            fcntl.flock(self.lock, fcntl.LOCK_UN)
            self.locked = False
        for fd in reversed(self.fds):
            os.close(fd)
        self.fds.clear()

    def __exit__(self, *_):
        self.close()
