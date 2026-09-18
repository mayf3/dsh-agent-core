# Fixed readable location for the lifecycle-domain denial probe

REUSE, same first-live controlled operation and accepted CTR-DCP-018. No Spec change, new target or operation permission. This narrow design delta supersedes only the earlier probe-plist pathname in first-live-lifecycle-operator-design.md.

The earlier path under /private/var/db/agent-deployd is inside the correctly0700 protected state root. UID502 cannot traverse it. An input-read failure cannot prove that launchd rejected the caller's domain authority. Do not relax state, key or auth directory permissions and do not count that I/O failure as successful denial.

Freeze the one inert probe plist at /usr/local/libexec/agent-deployd/lifecycle-denial-probe.plist, newly created root:wheel0644 under the existing root:wheel0755 protected executable directory. Its full ancestry, no ACL/flags/link alias and exact bytes/hash are bound and read back; it is readable by the tested caller. This additional public file and its exact recovery/disposition are explicit in the final Owner operation manifest. The operation intent/result records remain under the0700 state namespace.

Content remains exactly Label=ai.agent-deployd.lifecycle-denial-probe, ProgramArguments=[/usr/bin/true], UserName=authsvc, GroupName=authsvc, RunAtLoad=false, KeepAlive=false, with no schedule/socket/business work. The fixed caller command is /bin/launchctl bootstrap system /usr/local/libexec/agent-deployd/lifecycle-denial-probe.plist. The expected result remains explicit domain authorization denial and probe label absent before/after; no generic nonzero, invalid input or read failure counts. If the label unexpectedly loads, record FAILED, stop further probes and use only the exact reviewed Owner-grant-bound bootout of that known inert label. Recovery cannot convert the failed privilege proof into PASS.

No service is registered or invoked during nonproduction preparation. Source and package review must check the fixed path/content, readability and expected-denial classification together. This is a finite correction to the existing probe input, not a general readable control-plane state surface.
