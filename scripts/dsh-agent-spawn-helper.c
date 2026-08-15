/*
 * dsh-agent-spawn-helper — one-way privileged spawn helper for the frozen
 * TRUSTED_CREDENTIAL_BROKER contract (Router parent uid 505 -> DSH Agent
 * child uid 502). Compile + one-time root install:
 *
 *   clang -O2 -Wall -o /tmp/dsh-agent-spawn-helper scripts/dsh-agent-spawn-helper.c
 *   sudo install -o root -g wheel -m 4755 /tmp/dsh-agent-spawn-helper \
 *        /usr/local/libexec/dsh-agent-spawn-helper
 *
 * Frozen contract (packages/agent-router/src/process.js childSpawnConfig):
 *   dsh-agent-spawn-helper <uid> <gid> <program> [args...]
 *
 * Guarantees:
 *   - ONLY the frozen child identity uid 502 / gid 20 (yanfenma primary
 *     group) is accepted; any other uid/gid is refused.
 *   - supplemental groups are CLEARED before setgid/setuid.
 *   - the target program is exec'd DIRECTLY (execv of the given argv) —
 *     no shell, no command strings, no arbitrary uid selection.
 *   - installed root:wheel 4755 (setuid-root, not writable by others);
 *     refuses to run if the setuid bit was stripped.
 */

#include <unistd.h>
#include <string.h>
#include <stdio.h>
#include <errno.h>

#define FROZEN_CHILD_UID 502
#define FROZEN_CHILD_GID 20

static int fail(const char *what)
{
    fprintf(stderr, "dsh-agent-spawn-helper: %s (%s)\n", what, strerror(errno));
    return 2;
}

int main(int argc, char **argv)
{
    if (argc < 5) {
        fprintf(stderr, "dsh-agent-spawn-helper: usage: <helper> <uid> <gid> <program> [args...]\n");
        return 2;
    }
    if (strcmp(argv[1], "502") != 0 || strcmp(argv[2], "20") != 0) {
        fprintf(stderr, "dsh-agent-spawn-helper: refusing non-frozen child identity uid=%s gid=%s (frozen: 502/20)\n",
                argv[1], argv[2]);
        return 2;
    }
    if (geteuid() != 0) {
        fprintf(stderr, "dsh-agent-spawn-helper: not setuid-root (euid=%d)\n", geteuid());
        return 2;
    }

    if (setgroups(0, NULL) != 0) return fail("setgroups(clear)");
    if (setgid(FROZEN_CHILD_GID) != 0) return fail("setgid(20)");
    if (setuid(FROZEN_CHILD_UID) != 0) return fail("setuid(502)");
    if (getuid() != FROZEN_CHILD_UID || geteuid() != FROZEN_CHILD_UID ||
        getgid() != FROZEN_CHILD_GID || getegid() != FROZEN_CHILD_GID) {
        fprintf(stderr, "dsh-agent-spawn-helper: identity verification failed after drop\n");
        return 2;
    }

    execv(argv[3], &argv[3]);
    return fail("execv");
}
