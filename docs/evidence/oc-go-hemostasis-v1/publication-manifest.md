# OC-Go Hemostasis V1 — Publication Manifest

This manifest records the byte-preserving publication of the original execution report and evidence as audit input. It does not represent ACCEPT, Owner execution, incident resolution, Luna activation, or merge readiness.

```text
SOURCE_REPOSITORY = mayf3/dsh-agent-core
SOURCE_WORKTREE = /private/tmp/wt-zhixue-exec
SOURCE_WORKTREE_CLEAN = YES
SOURCE_COMMIT_FULL = 4a6a8b7f8b674dacf06e3b39a17d0a47a64344f1
SOURCE_COMMIT_PARENT = 9a89b944ad173f2a44e54de50096087a48cc0ad0
SOURCE_EVIDENCE_VERIFIED = YES
SOURCE_COMMIT_DOCS_ONLY = YES

PUBLISHED_BASE_COMMIT = 9bb5b97442c7155da36f06e867d1a655410544ac
PUBLISHED_EVIDENCE_COMMIT = 7e4cef3403ee5b4b12939e786e3d88d99e5523c1
PUBLISHED_BRANCH = records/oc-go-hemostasis-owner-gate-v1

RUNNER_PUBLISHED_PATH = docs/evidence/agent-core-ocgo-hemostasis-20260830/runner.sh
RUNNER_SOURCE_BLOB_SHA = ff41881bb80f5f28d710256506b2abfd70bcd483
RUNNER_SHA256_FULL = 53a10c98bb80f240c09491e5644ceed2687c9672fa962bb528f4f804c92aa0bd
RUNNER_MATCHES_TMP_OWNER_RUNNER = YES
RUNNER_MATCHES_SANDBOXED_ARTIFACT = YES
OWNER_RUNNER_INDEPENDENTLY_AUDITED = NO
READY_FOR_OWNER_EXECUTION = NO
```

## Source changed paths

All 16 source-commit paths are under `docs/`; no `packages/**`, `scripts/**`, production configuration, credential-file copy, or unrelated worktree WIP is present.

## Byte identity

| PATH | SOURCE_BLOB_SHA | PUBLISHED_BLOB_SHA | SHA256 |
|---|---|---|---|
| `docs/evidence/agent-core-ocgo-hemostasis-20260830/01-preflight-plist.txt` | `ad3eb842136be7a8a14a62ea18ee7bf37036fd45` | `ad3eb842136be7a8a14a62ea18ee7bf37036fd45` | `532fac5bf2dbe7a8fb68e919c4cda1f98ca6249a0a48f0982adddb883555924b` |
| `docs/evidence/agent-core-ocgo-hemostasis-20260830/02-preflight-overrides.txt` | `fde03b6a09947fc1748eea8c62eed1aeb14e7cff` | `fde03b6a09947fc1748eea8c62eed1aeb14e7cff` | `ef24ccaf91bb090e0749a96e9b9e37a13cdf70f781f7f85bf9b5d98219dbb01c` |
| `docs/evidence/agent-core-ocgo-hemostasis-20260830/03-preflight-process-matrix.txt` | `5700d73d31743aca2afb237fb672081aba6bc91b` | `5700d73d31743aca2afb237fb672081aba6bc91b` | `6e91a2689b616c9930a86f369efab500b15515a9cd731a58a964729c9de649cb` |
| `docs/evidence/agent-core-ocgo-hemostasis-20260830/04-preflight-credentials-census.txt` | `9e51071c4d494c99dc3240d7a3aaf4d76646865e` | `9e51071c4d494c99dc3240d7a3aaf4d76646865e` | `38dd50335b94833e944424e7afae563606096f8d0ec6059cad3802ac0c01abd9` |
| `docs/evidence/agent-core-ocgo-hemostasis-20260830/05-preflight-code-pins.txt` | `3398cc1ffe170f019a071ce76b912deeca0021ad` | `3398cc1ffe170f019a071ce76b912deeca0021ad` | `0455eb855cb22c4d6b533a2cedd31df67579ed5c430bcae811424cbc33c7ed49` |
| `docs/evidence/agent-core-ocgo-hemostasis-20260830/06-preflight-inventory-probe.txt` | `d9b25444b905dab27330f0427b5029008f8b53a1` | `d9b25444b905dab27330f0427b5029008f8b53a1` | `c9835d4eebddefc3fd0e600d4775216c3f82dd24a578dc7f9317027160fc5e61` |
| `docs/evidence/agent-core-ocgo-hemostasis-20260830/07-preflight-listeners.txt` | `8602355b22290076a45287efb111ad844175918d` | `8602355b22290076a45287efb111ad844175918d` | `2b61cc8f53d1745af9574aac1ce260fa958c1ecd48879efc4563ea3b73ee536b` |
| `docs/evidence/agent-core-ocgo-hemostasis-20260830/08-preflight-git-states.txt` | `7cb0c8cc2dfc1dee0cb0990a6da58e2ee80a8cca` | `7cb0c8cc2dfc1dee0cb0990a6da58e2ee80a8cca` | `c06f0b88a2a728c84b8d7b4e59a2c32a23e58545d81ab5a858f17914991c41c3` |
| `docs/evidence/agent-core-ocgo-hemostasis-20260830/09-canary-transcript.txt` | `048efffaa1425c52e28734aa59455f37172741a4` | `048efffaa1425c52e28734aa59455f37172741a4` | `a74c9e21e1547ac5fa9fb46f20ceacba41af81b8e719372cf1d6ecc33ca0eb5a` |
| `docs/evidence/agent-core-ocgo-hemostasis-20260830/10-rollout-credentials-settings.txt` | `1bfa2e1f5ee547b3a9cb14a05c8f316681a016cb` | `1bfa2e1f5ee547b3a9cb14a05c8f316681a016cb` | `1587ea186b8aac064896dfaf2152dfe24c29de9fedf9b937403d8e56ac08b104` |
| `docs/evidence/agent-core-ocgo-hemostasis-20260830/11-runner-static-sweep.txt` | `f7a5e6ffe55f8488f0e86c290293d384349fa87c` | `f7a5e6ffe55f8488f0e86c290293d384349fa87c` | `cf9a04c2c73f6e44d1259c16a2320c143e159cdfb8b88f4689f088b43dd5ce65` |
| `docs/evidence/agent-core-ocgo-hemostasis-20260830/MANIFEST.md` | `1d50b8c1ba477a00f185019c8677558a3ff46ba1` | `1d50b8c1ba477a00f185019c8677558a3ff46ba1` | `67015c63f077c57014ed476ee73930ea34daf2b317b51a0644a647d6ad4a98b5` |
| `docs/evidence/agent-core-ocgo-hemostasis-20260830/runner.sh` | `ff41881bb80f5f28d710256506b2abfd70bcd483` | `ff41881bb80f5f28d710256506b2abfd70bcd483` | `53a10c98bb80f240c09491e5644ceed2687c9672fa962bb528f4f804c92aa0bd` |
| `docs/evidence/agent-core-ocgo-hemostasis-20260830/sandbox/MATRIX.txt` | `d8820e3e5ccc7c84d7ca3c8be2c3f29aacb0cb11` | `d8820e3e5ccc7c84d7ca3c8be2c3f29aacb0cb11` | `96df67d909c95342973fc57248b0a7dacf7830f7e52b72b0c84634658b92db63` |
| `docs/evidence/agent-core-ocgo-hemostasis-20260830/sandbox/launchctl-shim.sh` | `909f168255a7adcc9cd8568daafe020d00d89c64` | `909f168255a7adcc9cd8568daafe020d00d89c64` | `39363b06c6a04af7718c2f8f9e39ca6ff0c652da227753669be8e6174bb98620` |
| `docs/reports/agent-core-ocgo-hemostasis-execution-v1.md` | `a98292468d44f2695f8ab4d311ad23e420599234` | `a98292468d44f2695f8ab4d311ad23e420599234` | `df517b59344f458014140568f5620ddb8adbf091132729def9212970b2814b73` |

For every row, `SOURCE_BLOB_SHA = PUBLISHED_BLOB_SHA`.

## Publication safety

The evidence and runner were scanned before publication. Only key names, file metadata, hashes, redaction markers, and equality/readiness conclusions are retained; no credential value or complete credential-file copy is intentionally published. Final scan status is recorded in the task delivery and Draft PR.
