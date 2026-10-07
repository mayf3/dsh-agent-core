#!/bin/bash
# c2-rerootcause-probe-matrix.sh — NON_PRODUCTION dummy-label reproduction of the
# launchctl-bootstrap exit-5 re-load gate that failed agent-control#550 (r373) and
# agent-control#560 (r377). Companion of 14_XIAOMUSIC_C2_REROOTCAUSE_R380.md.
#
# WHAT IT PROVES (7 probes, all on disposable labels, fully synthetic programs):
#   t01  first-load acceptance is form-agnostic                (expect 0)
#   t02  dormant re-load accepts ANY arg0 incl. scripts        (expect 0)
#   t03  no exec-preflight at submission (nonexistent path)    (expect 0)
#   t04  RE-LOAD GATE: bootout of a job whose executed instance
#        was an interpreted script + changed bytes -> exit 5   (expect 5 = ROOT CAUSE)
#   t05  same label, UNCHANGED bytes after settle -> exit 0    (expect 0 = rollback viability)
#   t06  Mach-O arg0 history (C1 irbridge shape) + changed
#        bytes -> exit 0                                       (expect 0 = why C1 never hit this)
#   t07  label-keying: fresh label + the same changed bytes    (expect 0)
#
# SAFETY: no real service touched (com.xiaomusic.secure is never bootstrapped/booted-out;
# the real xiaomusic code is never executed; programs are synthetic sh scripts and
# /bin/sleep,/bin/echo only; RunAtLoad jobs live ~1s; every label is booted out and
# every file removed; probe dir under /tmp).
#
# NOTE: expects mismatch exit 3. Labels carry a per-run token; re-runnable.
set -u
RUN="r380-$(date -u +%H%M%S)-$$"
DIR=$(mktemp -d "/tmp/xr380-matrix-${RUN}-XXXXXX")
U=$(id -u)
PASS=0; FAIL=0
log(){ echo "[$(date -u +%H:%M:%SZ)] $*"; }
fin(){ [ "$1" = 0 ] && PASS=$((PASS+1)) && log "PASS $2" || { FAIL=$((FAIL+1)); log "FAIL $2 (rc=$1)"; }; }
inpedit(){ /usr/bin/python3 - "$1" "$2" "$3" <<'PY'
import sys
p,old,new=sys.argv[1],sys.argv[2],sys.argv[3]
d=open(p,"rb").read(); assert d.count(old.encode())==1
open(p,"r+b").write(d.replace(old.encode(),new.encode(),1))
PY
}
mkip(){ /usr/bin/python3 - "$1" "$2" "$3" <<'PY'
import sys
path,label,arg0=sys.argv[1],sys.argv[2],sys.argv[3]
open(path,"w").write(f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
        <key>Label</key>
        <string>{label}</string>
        <key>ProgramArguments</key>
        <array>
                <string>{arg0}</string>
        </array>
</dict>
</plist>
""")
PY
chmod 0644 "$1"; }
mkload(){ # mkip + RunAtLoad
/usr/bin/python3 - "$1" "$2" "$3" <<'PY'
import sys
path,label,arg0=sys.argv[1],sys.argv[2],sys.argv[3]
open(path,"w").write(f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
        <key>Label</key>
        <string>{label}</string>
        <key>ProgramArguments</key>
        <array>
                <string>{arg0}</string>
        </array>
        <key>RunAtLoad</key>
        <true/>
</dict>
</plist>
""")
PY
chmod 0644 "$1"; }
bs(){ launchctl bootstrap "gui/$U" "$1" 2>"$1.err"; echo $?; }
bout(){ launchctl bootout "gui/$U/$1" >/dev/null 2>&1; echo $?; }
trap 'for l in t01 t02 t03 t04 t05 t06 t07; do launchctl bootout "gui/$U/com.probe.disposable.${RUN}.$l" >/dev/null 2>&1; done' EXIT

printf '#!/bin/sh\ntrap "" TERM\nsleep 15\n' > "$DIR/slowdie.sh";  chmod 0755 "$DIR/slowdie.sh"
printf '#!/bin/sh\nwhile :; do sleep 1; done\n' > "$DIR/loop.sh"; chmod 0755 "$DIR/loop.sh"
PRE="com.probe.disposable.${RUN}"

# t01 first-load, space-form minimal plist, script arg0
L="${PRE}.t01"; P="$DIR/t01.plist"; mkip "$P" "$L" "$DIR/slowdie.sh"
[ "$(bs "$P")" = 0 ]; fin $? "t01 first-load any-form"; bout "$L" >/dev/null

# t02 dormant re-load with script arg0 changed to another script
L="${PRE}.t02"; P="$DIR/t02.plist"; mkip "$P" "$L" "$DIR/slowdie.sh"
bs "$P" >/dev/null; bout "$L" >/dev/null
inpedit "$P" "$DIR/slowdie.sh" "$DIR/loop.sh"
[ "$(bs "$P")" = 0 ]; fin $? "t02 dormant re-load script->script"; bout "$L" >/dev/null

# t03 nonexistent arg0 at first load
L="${PRE}.t03"; P="$DIR/t03.plist"; mkip "$P" "$L" "$DIR/nonexistent-binary"
[ "$(bs "$P")" = 0 ]; fin $? "t03 nonexistent arg0 dormant"; bout "$L" >/dev/null

# t04 ROOT CAUSE: script instance ran 1s -> bootout -> same-inode changed bytes -> EIO 5
L="${PRE}.t04"; P="$DIR/t04.plist"; mkload "$P" "$L" "$DIR/slowdie.sh"
bs "$P" >/dev/null; sleep 1; bout "$L" >/dev/null
inpedit "$P" "$DIR/slowdie.sh" "$DIR/loop.sh"
[ "$(bs "$P")" = 5 ]; fin $? "t04 re-load gate exit-5 reproduction"; launchctl bootout "gui/$U/$L" >/dev/null 2>&1

# t05 same class, UNCHANGED bytes after 8s settle -> accepted (rollback viability)
L="${PRE}.t05"; P="$DIR/t05.plist"; mkload "$P" "$L" "$DIR/slowdie.sh"
bs "$P" >/dev/null; sleep 1; bout "$L" >/dev/null; sleep 8
[ "$(bs "$P")" = 0 ]; fin $? "t05 unchanged-bytes reload after settle"; bout "$L" >/dev/null

# t06 Mach-O arg0 history (C1 shape: interpreter binary) + changed bytes -> clean
L="${PRE}.t06"; P="$DIR/t06.plist"; mkload "$P" "$L" /bin/sleep
/usr/bin/python3 - "$P" <<'PY'
import sys
p=sys.argv[1]
d=open(p).read().replace("<string>/bin/sleep</string>","<string>/bin/sleep</string>\n                <string>30</string>",1)
open(p,"w").write(d)
PY
bs "$P" >/dev/null; sleep 1; bout "$L" >/dev/null
inpedit "$P" "<string>30</string>" "<string>5</string>"
[ "$(bs "$P")" = 0 ]; fin $? "t06 Mach-O arg0 history clean re-load"; bout "$L" >/dev/null

# t07 label-keying: fresh label accepts the very bytes t04 rejected
L="${PRE}.t07"; P="$DIR/t07.plist"; mkip "$P" "$L" "$DIR/loop.sh"
[ "$(bs "$P")" = 0 ]; fin $? "t07 fresh label same bytes clean"; bout "$L" >/dev/null

log "=== matrix done: PASS=$PASS FAIL=$FAIL dir=$DIR"
rm -rf "$DIR"
[ "$FAIL" = 0 ]
