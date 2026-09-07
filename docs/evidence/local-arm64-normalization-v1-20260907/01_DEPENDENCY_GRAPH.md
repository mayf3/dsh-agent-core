# 01_DEPENDENCY_GRAPH — LOCAL_NATIVE_ARM64_PLATFORM_NORMALIZATION_V1

Mechanically grounded from census 2026-09-07 (raw/02, 04, 05, 07, 08, 12, 13, 18, 19, 29).
Only active infrastructure processes/services with x86_64 relevance + ARM-native healthy
references are listed. DEPENDENTS = observed consumers.

## D1. Agent Core production runtime (authsvc domain)

| FIELD | VALUE |
|---|---|
| SERVICE_OR_PROCESS | agent-core production runtime (pid 51361, user `authsvc`, + harness children 80170/80218) |
| EXECUTABLE | /usr/local/libexec/agent-core/node-runtime/bin/node |
| RESOLVED_REALPATH | same (frozen v1 runtime tree under /usr/local/libexec/agent-core) |
| ARCH / ROSETTA | x86_64 / YES (translated) |
| PACKAGE_OWNER | agent-core deployment closure (not Homebrew) |
| INSTALL_ROOT | standalone (/usr/local/libexec/agent-core) |
| LAUNCH_OWNER | launchd system domain /Library/LaunchDaemons/ai.agent-core.runtime.plist |
| CONFIG_PATHS | /Users/authsvc/.agent-core/** |
| DATA_PATHS | /Users/authsvc/.agent-core/** |
| PORTS | 8787 (unified backend, with D2/D3) |
| DEPENDENTS | whole DSH fleet (child Agents, broker, auth, scheduler, forum, workflow) |
| ARM_EQUIVALENT_AVAILABLE | N/A — owned by DSH Goal |
| MIGRATION_STATEFUL | YES |
| ROLLBACK_MECHANISM | DSH Goal's own (plist .bak lineage exists) |
| OWNER_GOAL | **F — DSH_NATIVE_ARM64_RUNTIME_MIGRATION_V1. DO NOT MUTATE.** Evidence recorded as DSH_ARM_DEPENDENCY_EVIDENCE: production Node runtime is x86_64/Rosetta at frozen path /usr/local/libexec/agent-core/node-runtime. |

## D2. Agent Core scheduler runtime (yanfenma domain)

| FIELD | VALUE |
|---|---|
| SERVICE_OR_PROCESS | scheduler-v2 runtime (pid 60339) |
| EXECUTABLE | /usr/local/libexec/agent-core/node-runtime/bin/node production-runtime.mjs --root ~/.agent-core-scheduler- |
| ARCH / ROSETTA | x86_64 / YES |
| PACKAGE_OWNER / INSTALL_ROOT | agent-core closure / standalone |
| LAUNCH_OWNER | launchd ~/Library/LaunchAgents/ai.agent-core.scheduler-v2.plist |
| PORTS | 8795 |
| OWNER_GOAL | **F — DSH Goal family. DO NOT MUTATE.** |

## D3. GLM/Luna production harness (luna-production-rc8 worktree)

| FIELD | VALUE |
|---|---|
| SERVICE_OR_PROCESS | harness cli (pid 70388, parent 70038 = ai.agent-core.runtime), port 8787/8791 |
| EXECUTABLE | /usr/local/Cellar/node/25.6.1_1/bin/node + deepseek-harness worktree bin.js --profile agent-core-prod |
| ARCH / ROSETTA | x86_64 / YES |
| OWNER_GOAL | **F — GLM_LUNA_FALLBACK_PRODUCTION_V1 / DSH runtime. DO NOT MUTATE.** (Parent launchd ai.agent-core.runtime loaded, pid 70038.) |

## D4. PostgreSQL 16 (main, Intel)

| FIELD | VALUE |
|---|---|
| SERVICE_OR_PROCESS | postgresql@16 main cluster (pid 60358 + workers) |
| EXECUTABLE | /usr/local/opt/postgresql@16/bin/postgres → Cellar 16.14 |
| ARCH / ROSETTA | x86_64 / YES |
| PACKAGE_OWNER | Intel Homebrew formula postgresql@16 |
| INSTALL_ROOT | /usr/local |
| LAUNCH_OWNER | brew-services (intel) → ~/Library/LaunchAgents/homebrew.mxcl.postgresql@16.plist, loaded pid 60358 |
| CONFIG_PATHS | /usr/local/var/postgresql@16 (PG_VERSION=16, data+config same root) |
| DATA_PATHS | /usr/local/var/postgresql@16; log /usr/local/var/log/postgresql@16.log (422 KB) |
| PORTS | 5432 (::1 + 127.0.0.1) |
| DEPENDENTS | svc-workflow (observed: svc_wf @ svc_workflow_dogfood_clean, ::1 idle); likely further DBs — MUST census databases before any migration (dispatch POSTGRESQL SPECIAL RULE) |
| ARM_EQUIVALENT_AVAILABLE | YES (arm64 postgresql@16 formula exists) |
| MIGRATION_STATEFUL | YES — same-major arch-only migration 16→16 planned; cutover HOLD for production slot |
| ROLLBACK_MECHANISM | pre-migration: pg_dumpall + keep Intel Cellar + keep data dir copy; rollback = relaunch intel binary on restored dir |
| OWNER_GOAL | this Goal (D class) |

## D5. PostgreSQL temp diagnostics cluster (leftover)

| FIELD | VALUE |
|---|---|
| SERVICE_OR_PROCESS | postgres -D /tmp/svc-diagnostics-pg-20260906 -p 55449 (pid 22868, started 2026-09-06 18:28) |
| EXECUTABLE | /usr/local/Cellar/postgresql@16/16.14/bin/postgres |
| ARCH / ROSETTA | x86_64 / YES |
| DATA_PATHS | /tmp/svc-diagnostics-pg-20260906 (temp dir — survives only until reboot) |
| PORTS | 55449 |
| DEPENDENTS | none observed since 2026-09-06 (candidate: svc-diagnostics session leftover) |
| OWNER_GOAL | this Goal — class A residue candidate; confirm-then-stop in a later bounded action (not during census phase) |

## D6. Syncthing (Intel)

| FIELD | VALUE |
|---|---|
| SERVICE_OR_PROCESS | syncthing (pid 60360 + child 60436) |
| EXECUTABLE | /usr/local/opt/syncthing/bin/syncthing 2.0.14 |
| ARCH / ROSETTA | x86_64 / YES |
| PACKAGE_OWNER | Intel Homebrew formula syncthing |
| LAUNCH_OWNER | brew-services (intel) → homebrew.mxcl.syncthing.plist, loaded |
| CONFIG_PATHS | ~/Library/Application Support/Syncthing/config.xml (sha256 c7393791…43c6e, frozen hash recorded) |
| DATA_PATHS | same dir incl. index-v2, cert.pem/key.pem (device identity) |
| PORTS | 22000 (sync), 8384 (GUI) |
| DEPENDENTS | user sync folders (owner-level personal infra) |
| ARM_EQUIVALENT_AVAILABLE | YES (arm64 syncthing formula) |
| MIGRATION_STATEFUL | YES — device identity/config/folders must be preserved byte-identical (SYNCTHING SPECIAL RULE) |
| ROLLBACK_MECHANISM | config.xml+cert/key backup → relaunch Intel formula |
| OWNER_GOAL | this Goal (D class) |

## D7. tailscaled (system domain, Intel) + failing user-domain brew service

| FIELD | VALUE |
|---|---|
| SERVICE_OR_PROCESS | tailscaled (pid 836, root, since 2026-08-30) — RUNNING; plus homebrew.mxcl.tailscale (user domain, loaded, lastexit=1 FAILING) |
| EXECUTABLE | /usr/local/bin/tailscaled 1.94.2 |
| ARCH / ROSETTA | x86_64 / YES |
| PACKAGE_OWNER | Intel Homebrew formula tailscale |
| LAUNCH_OWNER | launchd system domain /Library/LaunchDaemons/com.tailscale.tailscaled.plist (--socket=/var/run/tailscaled.sock) + user brew-services (conflict) |
| CONFIG_PATHS | system plist args only; state dir NOT found at ~/Library/Tailscale, /var/run/tailscaled.socket, /usr/local/var/run/tailscale (needs one supplementary read-only locate pass) |
| PORTS | tailscaled internal (not in user-scope lsof) |
| DEPENDENTS | host VPN users (interactive tailscale CLI) |
| ARM_EQUIVALENT_AVAILABLE | YES (arm64 tailscale formula) |
| MIGRATION_STATEFUL | YES (node identity/state preservation; TAILSCALE SPECIAL RULE) |
| ROLLBACK_MECHANISM | keep Intel formula; restore single-launch-owner config |
| OWNER_GOAL | this Goal (E class) — **user-domain failure is a config/launch-owner conflict symptom; arch migration not claimed as the fix**; if unavoidable reauth → TRUE OWNER GATE |

## D8. svc-workflow (local workflow platform backend)

| FIELD | VALUE |
|---|---|
| SERVICE_OR_PROCESS | svc-workflow (pid 60331) |
| EXECUTABLE | /Users/yanfenma/.local/services/svc-workflow/svc-workflow |
| ARCH / ROSETTA | x86_64 / YES (compiled binary) |
| PACKAGE_OWNER | repository build artifact (~/.local/services deployment) |
| LAUNCH_OWNER | launchd com.svc-workflow.plist (+ com.svc-workflow-monitor zsh check) |
| CONFIG_PATHS | deployment dir + monitor script |
| DATA_PATHS | DB: postgresql@16 (svc_wf @ svc_workflow_dogfood_clean observed) |
| PORTS | 8989 |
| DEPENDENTS | broker/workflow production family (svc-workflow is the workflow platform; P0 goals touch its data) |
| ARM_EQUIVALENT_AVAILABLE | TBD — requires arm64 rebuild of the binary (source tree to be located) |
| MIGRATION_STATEFUL | YES (service restart; DB untouched by arch change) |
| ROLLBACK_MECHANISM | keep x86_64 binary; swap symlink/restart |
| OWNER_GOAL | this Goal (C/D) — bounded per-service migration, prepared then slot-gated (P0 adjacency) |

## D9. article-review-canary workspace runtime

| FIELD | VALUE |
|---|---|
| SERVICE_OR_PROCESS | node+tsx canary (pid 60435, esbuild service child 60498) |
| EXECUTABLE | /usr/local/Cellar/node/25.6.1_1/bin/node; esbuild @esbuild/darwin-x64 |
| ARCH / ROSETTA | x86_64 / YES (closure-consistent x64 node_modules) |
| PACKAGE_OWNER | project node_modules (~/workspace/deploy/article-review-canary) |
| LAUNCH_OWNER | launchd com.article-review-canary.plist, port 17231 |
| DEPENDENTS | canary experiment only (user-level) |
| ARM_EQUIVALENT_AVAILABLE | YES — rm -rf node_modules + ARM node reinstall (arch-aware validation) |
| MIGRATION_STATEFUL | NO (stateless workspace) |
| OWNER_GOAL | this Goal (C class, low risk, after Phase-3 node mapping) |

## D10. Intel Python services: irbridge (8091), videobridge (8092)

| FIELD | VALUE |
|---|---|
| SERVICE_OR_PROCESS | com.irbridge pid 60359; com.videobridge pid 60355 |
| EXECUTABLE | /usr/local/bin/python3 (Intel 3.14.5) |
| ARCH / ROSETTA | x86_64 / YES |
| LAUNCH_OWNER | launchd user plists |
| DEPENDENTS | personal automation bridges (8091/8092 listeners live) |
| ARM_EQUIVALENT_AVAILABLE | YES — verify each script's pip deps under ARM python@3.14 before cutover (C class) |
| OWNER_GOAL | this Goal (C class) |

## D11. Docker Desktop privileged helper

| FIELD | VALUE |
|---|---|
| SERVICE_OR_PROCESS | com.docker.vmnetd (root daemon) |
| EXECUTABLE | /Library/PrivilegedHelperTools/com.docker.vmnetd — x86_64-ONLY |
| ARCH / ROSETTA | x86_64 / YES |
| LAUNCH_OWNER | /Library/LaunchDaemons/com.docker.vmnetd.plist |
| DEPENDENTS | Docker Desktop (itself arm64, running arm64 backend) |
| ARM_EQUIVALENT_AVAILABLE | YES — replaced by Docker Desktop's own updater (reinstall/repair inside Docker.app) |
| OWNER_GOAL | this Goal (G/E informational; needs sudo → native-auth gate when scheduled; low priority — Docker functions today) |

## ARM-native healthy references (no action)

ollama (ARM brew service, 11434), com.deepseek-harness.mobile-proxy (/opt/homebrew/bin/node,
3082), opencode (arm64), Brave CDP (arm64), docker CLI/backend (arm64).

## Hard-coded /usr/local reference census (dispatch item 8)

- launchd plists: 37 files reference /usr/local or arch -x86_64 (raw/26) — classified in 02.
- Shell profiles: .zshrc line 124 DYLD_LIBRARY_PATH (Intel xz/zlib/libxml2), lines 125/126
  Intel openjdk PATH prepend ×2; .zprofile/.zshenv no Intel paths; /etc/paths lists
  /usr/local/bin first (system file, sudo-gated edit).
- Repository scripts: 565 rg hits across ~/workspace/project — overwhelmingly worktree
  copies of dsh-agent-core/scripts/trusted-cp-deploy-install.sh + production-integration
  verify + auth-service grant-supply test fixtures (these reference /usr/local/bin/node —
  DSH-owned consumer, OWNED_BY_OTHER_GOAL). ZERO references to uv/wget/tmux/starship/
  cmake/deno/gpg absolute Intel paths.
- IDE settings: none found (raw/26).
