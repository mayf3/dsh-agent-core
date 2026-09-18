# Fixed readable domain probe and W2 signal component evidence

Domain source: `83e58fef59f524638d849eb82dd7d2bac7a160dd` (two new files); W2 signal correction: `4fc197d62fd17c9259cba869f93f55a6ba77327e` (denial source/test only).

REUSE, same parent Goal and accepted CTR-DCP-018. Governing public-location design SHA256 `467acf819a4fbadb19353c5286e4ecc9be445f568fb6667f40303c14944bc4f3` has independent design PASS. Parent explicitly authorized the fixed Plutil reader and existing native W2 UID0 signal correction. No production/privileged/root/runtime/installed-package operation was performed.

## Fixed domain probe

- The only input is newly and exclusively created root:wheel0644 `/usr/local/libexec/agent-deployd/lifecycle-denial-probe.plist`, under verified protected0755 ancestry. Exact XML has only Label, ProgramArguments=[/usr/bin/true], UserName/GroupName=authsvc, RunAtLoad=false, KeepAlive=false.
- The existing bounded process runner (parent-owned Tool::Plutil commit f601db1) reads/lints that exact file as UID502:20 before bootstrap. Exact success grammar is tested with actual /usr/bin/plutil on private nonroot fixture files. No production pathname was used in executed commands.
- Only explicit recognized bootstrap permission denial plus exact label absence before/after passes. Generic errors, unreadable input, wrong label, absent/unknown exit status, unexpected load or malformed readback never pass.
- Creation, command intent/result, unexpected failure and exact owned cleanup use durable immutable journals. Exact bytes, inode, metadata and protected current parent are read back around the fixed commands. No arbitrary command/path/label reaches the production interface.
- Unknown outcomes retain the file/evidence and do not retry. A positively identified newly loaded inert label (same fixed path/program, no running PID/runs) permits only exact reviewed bootout and absence readback; the failed permission proof remains FAILED. Foreign/replaced files are retained. Successful prior attempts cannot bootstrap again.

## Existing running W2 correction

- Native W2 may be running as legitimate UID0. The older probe precheck only allowed UID505, so it incorrectly blocked the fixed service group before signal0.
- A small identity helper now allows only UID0 or505 and bounded positive PID, before kernel lookup. Production uses the existing exact kernel ProcessIdentity lookup before and after signal0; birth time, uid/gid and executable drift fail. The driver remains responsible for supplying only the authenticated fixed native labels, and idle periodic services are excluded.
- Existing child errno policy is unchanged: only real EPERM proves signal denial; ESRCH is unknown. No root PID or live service was used in these tests.

## Executed checks and limits

- Domain RED:1 pass/7 fail on missing helper; GREEN8/8. Additional missing-exit-code RED:11 pass/1 fail; final domain12/12 PASS. Tests use real temporary files and private plist parsing, with fixture command observations for launchd.
- Signal RED:21 pass/1 fail on UID0 rejection; final denial22/22 PASS. New pure identity fixtures prove UID0/505 acceptance, invalid UID/PID rejection before reads and exact identity drift rejection; preexisting real nonroot signal/ESRCH fixtures remain.
- Owned rustfmt and git diff --check PASS. Source files and dedicated test files satisfy500-line bound.
- Strict all-target clippy checkpoint did NOT pass while other operator integration was in progress (11 errors in other files: unfinished/dead-code/imports/materialize/compose); no domain-probe lint was reported and no suppression was added. No whole-operator full-suite/release or independent source PASS is claimed here.
- Permission observations alone are not complete adoption proof. Parent native driver must join exact protected full poststate/service generation under the same guard and obtains independent source review before any final Owner package.

## Exact source SHA256

| File | SHA256 |
|---|---|
| `src/first_live/native_effects/domain_probe.rs` | `ac7c7f0b8f1593483530780d341635694804281038662209d6cfca021ffcb2ef` |
| `test/first_live/domain_probe.rs` | `ba9b07026e160e9a24e305814d9919061f11b1fb3f1eae8d5fbf37669979e92c` |
| `src/first_live/native_effects/denial.rs` | `d115e32cc42ff730fcb467f598860f1d20e9d56fc2392803d421531999a2ea1c` |
| `test/first_live/denial.rs` | `ee8fee7deacf6f02b804ee1028977ae205807819370fd73f54fdce266c96a640` |

## Retained execution logs

Ignored raw logs are alongside this committed report in the binding worktree.

| Log | SHA256 |
|---|---|
| `dcp-domain-probe-red.log` | `2c7cefb50eb6c2f27e5d367e80c3b41e1fa19bd6452c8bf3ecf8add4b89ee390` |
| `dcp-domain-probe-unknown-red.log` | `f7e6834d6999932583c75604d9fdafebb5f4534d7f6e446251f16714f4465426` |
| `dcp-domain-probe-final.log` | `fe08621f4418295d1c870808172d7b6535d4e1f8acd92f0f91ecfa425d7684b1` |
| `dcp-domain-probe-fmt.log` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `dcp-domain-probe-clippy.log` | `e6001d232daf73a46d2b3c9d2798bdb3f3c072355306f537dc143631a83fcb85` |
| `dcp-signal-uid-red.log` | `e11aa4997c3c81335f35407ca7e5e6c28d274d4c44deac7fef3be8a680d585f4` |
| `dcp-signal-uid-final.log` | `211574f288e5ff55d175be166796a1b3edf162ed96ae47ed4a946d5c413fb35d` |
| `dcp-signal-uid-fmt.log` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

Both new source deltas require independent affected-surface review; no author self-review PASS is asserted. Parent Goal and first actual automatic deployment are not complete.
