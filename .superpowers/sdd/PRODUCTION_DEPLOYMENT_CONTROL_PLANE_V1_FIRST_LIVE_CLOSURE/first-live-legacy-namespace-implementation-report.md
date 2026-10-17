# Legacy fixed-parent namespace join

Author dcp_census_repair_review; same accepted DCP V1 authority and parent explicit narrow mandate. Source before this delta: 32767f0. No production calls or actual /private/var/run changes.

The actual retained 0:1:0775 OS tuple conflicts with three generic checks in legacy lock acquisition/verification. A private SocketNamespace now carries the existing reviewed SocketAncestorPlan/socket group/exact caller+service identity set from the packet. Only parent index0 uses its fixed open_preflight and retained descriptor join. Acquire, repeated verify and release all retain the same original guard. The other three parents, permanent file (including nlink/mode/flags), ephemeral protocols and holders are unchanged and strict; shared Dir mode rules are unchanged.

The new helper delegates retained metadata/ACL/membership checking to the already existing physical socket validator. No synthetic denial receipt, arbitrary path, new serialized waiver, stale lock cleanup, permanent inode replacement, or protocol change. The only alternative namespace path is cfg(test) private fixture construction and cannot exist in the production binary; it uses the same physical descriptor checks with a synthetic nonroot tuple which the real policy explicitly rejects.

Executed RED: real private group-writable first-parent acquisition reached UNSAFE_MODE, after compile wiring (compile mismatch is not counted as RED). GREEN: all18 legacy-lock tests passed, including exact production tuple shape/excluded group checks, retained-parent mode drift, and unchanged refusal of another775 parent before any journal. Strict all-target cargo clippy -D warnings passed. Existing crash/foreign-lock/release tests remain passing. Current protected ACL/groups still require future exact authorized preflight; these fixtures are not current host proof.

## Logs

- `dcp-legacy-namespace-clippy.log` `cc9a5748dd2c51c61968b03af18153be893c1c44e988dd1a1c1498d8f0c39765`
- `dcp-legacy-namespace-final.log` `cc1ea285b0fb2ad7499536d85f817c14e22528a4d80a32ba7915bd4f44d0fd00`
- `dcp-legacy-namespace-green.log` `0ab146510f4fea40eb60c089db44823ed3942ff1eb5d33073d46135dc5c13abe`
- `dcp-legacy-namespace-red.log` `1591b7e4c5555b3984f9ff8550b85b099f6929a611262326c3f3ee98873b564a`
