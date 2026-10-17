"""Accepted fixed e33 R3. Original DISPOSAL/STATUS/OUTPUT only.
No generic recovery, retained-checkpoint mode, arbitrary path or business replay.
"""
import contextlib,ctypes,fcntl,hashlib,http.client,json,os,signal,stat,subprocess,sys,threading,time
from pathlib import Path
_FS_ROOT='/'
E33 = {'operation_id': 'b7-packet-r32-a2ff19b8d8671ec6-e33', 'tx_id': 'tx-0c789451b5ca437288197b9faf61b6bc', 'packet_id': 'b7-native-execution-r32-c71fd2cc', 'manifest_sha256': 'a2ff19b8d8671ec6b19d812d455e3ae2497d19043d1ee53abbb2b93981527b12', 'source_sha256': '85d446af3754eed86648a716a97cd7d7345bf7c8cf07c78c7be67546901c9910', 'registration': {'action': 'B7_PACKET_REGISTER_V1', 'binding': {'manifestSha256': 'a2ff19b8d8671ec6b19d812d455e3ae2497d19043d1ee53abbb2b93981527b12', 'packetId': 'b7-native-execution-r32-c71fd2cc', 'sourceSha256': '85d446af3754eed86648a716a97cd7d7345bf7c8cf07c78c7be67546901c9910'}, 'kind': 'DS_B7_PACKET_REGISTRATION_V1', 'operation_id': 'b7-packet-r32-a2ff19b8d8671ec6-e33', 'policy_sha256': '7a2010a0dedeb2fd39cea1eb852d232ba282eef17b4ac44aa673eb06ffb4a70a', 'registered_peer_uid': 502, 'request_sha256': 'fb91900b6a00c006a5a5b52ea4dd49e544b8d0d61b3638e528b64cf44f83b87a', 'state': 'REGISTERED_ONLY', 'version': 1}, 'execution': {'attempt': 1, 'execution_policy_sha256': 'b804b93ab3ee9f1582f9f4ee23dc550900576d5f180261b3284099cfbe4e5c3e', 'input_pending': None, 'input_sequence': 0, 'kind': 'DS_B7_EXECUTION_V2', 'operation_id': 'b7-packet-r32-a2ff19b8d8671ec6-e33', 'phase': 'RETAINED', 'reason': 'EXECUTION_INTENT', 'registration_sha256': 'fb91900b6a00c006a5a5b52ea4dd49e544b8d0d61b3638e528b64cf44f83b87a', 'terminal_output': False, 'tx_id': 'tx-0c789451b5ca437288197b9faf61b6bc'}, 'holder': {'format': 'B7_GLOBAL_HOLDER_V1', 'phase': 'PREPARING', 'nonce': '24923231115f41f8c31097450da93ee6', 'binding': {'txId': 'tx-0c789451b5ca437288197b9faf61b6bc', 'deploymentRoot': '/Users/authsvc/.agent-core', 'trustedRoot': '/usr/local/libexec/agent-core', 'recoveryRoot': '/var/db/agent-core/authsvc-codex-migration', 'outerPath': '/private/var/db/agent-core/authsvc-codex-migration/activation-code-input/b7-entry-code/b7-wired-inputs/dsh-agent-core/docs/evidence/shared-codex-auth-deployment-root-refreeze-v2-20261002/owner-router-closure-g2-g7-v23.sh', 'outerSha256': 'd323f7022f164b00fc744f37f0144bfadbbe43955e57ad3efb342e8d2f4c7f45', 'carrierPath': '/private/var/db/agent-core/authsvc-codex-migration/activation-code-input/b7-entry-code/b7-wired-inputs/dsh-agent-core/docs/evidence/openai-codex-refresh-token-reused-v1-20260910/owner-authsvc-plugin-upgrade-r13.sh', 'carrierSha256': 'fd6a1618bffe880ece8a59d9dc3cdaffbcfef2c0b2b9232398231a08eb2529c3', 'toolSha256': 'be89f18aa738ea93a923647182ff89c6400dfe72f718ed31fe8f5e58b81c10ab', 'migrationToolSha256': '22e045c5b218a7822f206a524b3b0c6d9065ef795b98e28e8bdd3af0f053f3e8', 'preparationToolSha256': 'db1977a2bf5fffd7b2d07a1860b1c697c6c20b19034eed35ce7511c651ff889a', 'installerSha256': 'e342743320a525f68a7022df6cce368d0707b08dc4e6f04e3b2dfc689787044d', 'sixTargetProducerSha256': '03322db43a98f70c857ca0064eaa09a9881004abb0efccc174c21d1e23ce325c', 'canaryProducerSha256': '2a8420e177a559f30855aabed6c94bf76409452008482d0345c7f77962276be4', 'ownerRecorderSha256': '243357f274a6a8a7ed9bcdad0dd366f3f3699a55e4b10d67ce68c274e6c8d39b'}}, 'registration_receipt_sha256': 'fc886f9faaf99181abdc4f796f5c0e6a811f2f31507a6405f80159132741978c', 'execution_record_sha256': '97687bcb1e8a25e30b9be4e23b670e5224e5c28263ffbdc09a9246c9bb310e08', 'holder_sha256': '0d8d7abe25990f87a50e8c93e006b043bb028c005471f517b77ff062bcadae13', 'batch_sha256': 'e088a024361d3508e5f89a84b82629fee5c5e2ea16f00731af6f1d99f7950b01', 'batch_bytes': 23087288, 'seed_sha256': '74a1e744b65e3e7137b4c3c0c1383ec9757de40b98f60f8d2103e3542c3cf912', 'journal_sha256': '6370a50c5412d142e332df2f71cca72473a7632487db1e55b382eb9d3a340a8d', 'trees': {'codeinput': {'root': '/private/var/db/agent-core/authsvc-codex-migration/activation-code-input', 'sha256': '89fb4b957f307c1ba36c3c1a433a50b01243078564050e270f6361e4d8461ce4', 'entries': 92549, 'regular_bytes': 1018845026}, 'publicArtifacts': {'root': '/usr/local/share/agent-core/artifacts', 'sha256': 'becae091ac99cd5a941c590df22b0289a93524bfb0b007b4a8f78bb3a664a7e4', 'entries': 7, 'regular_bytes': 47590139}, 'generation': {'root': '/Users/authsvc/.agent-core/control/codex-plugin-runtime/gen-b7-tx-0c789451b5ca437288197b9faf61b6bc-24923231115f41f8', 'sha256': '38b42a64fc6183981da39e4df8b3e9d89b35cba303d1aca89b4dbe09c0abce5e', 'entries': 23577, 'regular_bytes': 120514792}, 'shadow': {'root': '/private/var/db/agent-core/authsvc-codex-migration/b7-post-conditions-tx-0c789451b5ca437288197b9faf61b6bc', 'sha256': 'f29ee03c47da8c41b300992e5f77d91f638009c30f4132fe95f21bbc3893dbb6', 'entries': 23487, 'regular_bytes': 72933}, 'preimageDir': {'root': '/Users/authsvc/.agent-core/control/codex-plugin-preimage-b7-tx-0c789451b5ca437288197b9faf61b6bc-24923231115f41f8', 'sha256': 'ce7198af72a9d6c9b26833d2ac43ba28820d2653966c36e95987b165d3209362', 'entries': 2, 'regular_bytes': 232}, 'preimageStore': {'root': '/private/var/db/agent-core/authsvc-codex-migration/.b7-six-preimage-store', 'sha256': '8546d144212f5a48a7cfa90bafd08e68f455776c985670015d4cfdfe9ef18373', 'entries': 19, 'regular_bytes': 19706}}, 'migration_root': '/private/var/db/agent-core/authsvc-codex-migration', 'lock_root': '/usr/local/var/agent-core/production-mutation-locks/production-deploy.lock', 'snapshot_root': '/private/var/db/agent-deploy-system-execution/b7-native-execution-r32-c71fd2cc/b7-wired-stage', 'snapshot_files': {'accepted-provisioning-commit.txt': {'bytes': 323, 'relative': 'accepted-provisioning-commit.txt', 'sha256': '49c5113d2bae4971bf5f49521f2f3cb18627c57f190b68ba6fac21436a0d25b9', 'sourcePath': '/private/var/db/agent-deploy-system/inputs/b7-install-r32/packet/b7-wired-stage/accepted-provisioning-commit.txt'}, 'accepted-spec-copy-b08db324aa179af962536a804d275866fa2bb7f2.md': {'bytes': 13402, 'relative': 'accepted-spec-copy-b08db324aa179af962536a804d275866fa2bb7f2.md', 'sha256': '3dd42a9b8793bb9f68df420d779edd7af42def897861551349cf68db30dd8458', 'sourcePath': '/private/var/db/agent-deploy-system/inputs/b7-install-r32/packet/b7-wired-stage/accepted-spec-copy-b08db324aa179af962536a804d275866fa2bb7f2.md'}, 'checkpoint-inputs.json': {'bytes': 36944, 'relative': 'checkpoint-inputs.json', 'sha256': '6c135705da444996ef7aecd2a2c743d2c626e451059fcd638f04c2c21e5bb418', 'sourcePath': '/private/var/db/agent-deploy-system/inputs/b7-install-r32/packet/b7-wired-stage/checkpoint-inputs.json'}, 'checkpoint.py': {'bytes': 21288, 'relative': 'checkpoint.py', 'sha256': '4e3218d2fa69568353f93e2960bbc774e20418ad890e992359481fe87d17d5b2', 'sourcePath': '/private/var/db/agent-deploy-system/inputs/b7-install-r32/packet/b7-wired-stage/checkpoint.py'}, 'old-stage-lease-disposal-once.py': {'bytes': 58648, 'relative': 'old-stage-lease-disposal-once.py', 'sha256': '519441cd6b51ba3039340027746eb493c36d9ffc41bfc60c7c256e79b4f81e53', 'sourcePath': '/private/var/db/agent-deploy-system/inputs/b7-install-r32/packet/b7-wired-stage/old-stage-lease-disposal-once.py'}, 'option-b-quarantine-remove.py': {'bytes': 15121, 'relative': 'option-b-quarantine-remove.py', 'sha256': 'e25593a703b74620e741dd40ce870d57d502a4b658f9b8564006e84b142bdc03', 'sourcePath': '/private/var/db/agent-deploy-system/inputs/b7-install-r32/packet/b7-wired-stage/option-b-quarantine-remove.py'}, 'preimage-byte-bindings.json': {'bytes': 1061, 'relative': 'preimage-byte-bindings.json', 'sha256': '2ab340c78a5996f59d7a9e7249bb411366cef1fec979eea534e70e60940f4d12', 'sourcePath': '/private/var/db/agent-deploy-system/inputs/b7-install-r32/packet/b7-wired-stage/preimage-byte-bindings.json'}, 'seed-materials.mjs': {'bytes': 8819, 'relative': 'seed-materials.mjs', 'sha256': '6d5060b2bb673d918083d716a2d6085764fb2ac038c24443265bdc39575bdff5', 'sourcePath': '/private/var/db/agent-deploy-system/inputs/b7-install-r32/packet/b7-wired-stage/seed-materials.mjs'}, 'stage-seed-once.py': {'bytes': 29408, 'relative': 'stage-seed-once.py', 'sha256': '85d446af3754eed86648a716a97cd7d7345bf7c8cf07c78c7be67546901c9910', 'sourcePath': '/private/var/db/agent-deploy-system/inputs/b7-install-r32/packet/b7-wired-stage/stage-seed-once.py'}}, 'holder_inode': [16777233, 205045569], 'migration_inode': [16777233, 111949693], 'artifacts_parent_inode': [16777233, 186170744], 'native_absences': ['/private/var/db/agent-core/authsvc-codex-migration/migration-transaction.json', '/private/var/db/agent-core/authsvc-codex-migration/migration-fence.json', '/private/var/db/agent-core/authsvc-codex-migration/b7-preparation-tx-0c789451b5ca437288197b9faf61b6bc.json', '/private/var/db/agent-core/authsvc-codex-migration/b7-accepted-tx-0c789451b5ca437288197b9faf61b6bc.json', '/private/var/db/agent-core/authsvc-codex-migration/activation-tx-0c789451b5ca437288197b9faf61b6bc', '/private/var/db/agent-core/authsvc-codex-migration/commit-confirmation.json'], 'histories': {'codeinput': '/private/var/db/agent-core/authsvc-codex-migration/activation-code-input.e33-closed-a2ff19b8', 'seed': '/private/var/db/agent-core/authsvc-codex-migration/b7-preparation-input.e33-closed-a2ff19b8.json', 'publicArtifacts': '/usr/local/share/agent-core/artifacts.e33-closed-a2ff19b8', 'batch': '/private/var/db/agent-core/authsvc-codex-migration/b7-six-target-batch.e33-closed-a2ff19b8.json'}, 'checkpoint': {'deploymentRoot': '/Users/authsvc/.agent-core', 'health': {'contractSource': 'installed DS HEALTH_URL read-only contract; never probed by this author', 'host': '127.0.0.1', 'path': '/health', 'port': 8790}, 'kind': 'B7_NATIVE_CHECKPOINT_INPUTS_R3', 'liveDeltas': [{'bytes': 92734, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/packages/llm/llm-pi-ai/lib/index.js', 'sha256': '023eedbc4949224970bbc39aa520ee7a07bfb9dc69fd13df97027c09fba21d02', 'uid': 505}, {'bytes': 92734, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/abcea89414687ddb24077fa95517b830/lib/index.js', 'sha256': '023eedbc4949224970bbc39aa520ee7a07bfb9dc69fd13df97027c09fba21d02', 'uid': 0}, {'bytes': 889, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/packages/llm/llm-pi-ai/lib/invariant.js', 'sha256': 'b38a2e8add12257d9fc76c2c13751b3c8f30f8e1c150ba7d373ba2f84814f7b3', 'uid': 505}, {'bytes': 889, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/abcea89414687ddb24077fa95517b830/lib/invariant.js', 'sha256': 'b38a2e8add12257d9fc76c2c13751b3c8f30f8e1c150ba7d373ba2f84814f7b3', 'uid': 0}, {'bytes': 318837, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/packages/llm/llm-pi-ai/lib/tsconfig.tsbuildinfo', 'sha256': 'ca8ce44f919b5b1708afb239d537cad30e36ce05aa81681048030dccb5e24472', 'uid': 505}, {'bytes': 318837, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/abcea89414687ddb24077fa95517b830/lib/tsconfig.tsbuildinfo', 'sha256': 'ca8ce44f919b5b1708afb239d537cad30e36ce05aa81681048030dccb5e24472', 'uid': 0}, {'bytes': 4206, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/packages/llm/llm-pi-ai/lib/types/adapter.d.ts', 'sha256': '235cd6a2c3d4a7be22e7e6debcbfd37120abf45b5252074448305d764e89cf8b', 'uid': 505}, {'bytes': 4206, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/abcea89414687ddb24077fa95517b830/lib/types/adapter.d.ts', 'sha256': '235cd6a2c3d4a7be22e7e6debcbfd37120abf45b5252074448305d764e89cf8b', 'uid': 0}, {'bytes': 1368, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/packages/llm/llm-pi-ai/lib/types/adapter.d.ts.map', 'sha256': '60390de1f7065171b0d4b1540c2df4016221d543c6407ce244dfb28d26442909', 'uid': 505}, {'bytes': 1368, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/abcea89414687ddb24077fa95517b830/lib/types/adapter.d.ts.map', 'sha256': '60390de1f7065171b0d4b1540c2df4016221d543c6407ce244dfb28d26442909', 'uid': 0}, {'bytes': 17366, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/packages/llm/llm-pi-ai/lib/types/adapter.js', 'sha256': '2053c352c43a331b6e5142179ad806016ff53a0965c519ab1105eca484927269', 'uid': 505}, {'bytes': 17366, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/abcea89414687ddb24077fa95517b830/lib/types/adapter.js', 'sha256': '2053c352c43a331b6e5142179ad806016ff53a0965c519ab1105eca484927269', 'uid': 0}, {'bytes': 9254, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/packages/llm/llm-pi-ai/lib/types/adapter.js.map', 'sha256': '5a5ee76a001692f1b44b774d0e6e973c7fc261a917676af51dc151e23a5a23d0', 'uid': 505}, {'bytes': 9254, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/abcea89414687ddb24077fa95517b830/lib/types/adapter.js.map', 'sha256': '5a5ee76a001692f1b44b774d0e6e973c7fc261a917676af51dc151e23a5a23d0', 'uid': 0}, {'bytes': 18809, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/packages/llm/llm-pi-ai/lib/types/catalog.d.ts', 'sha256': 'd4fc0b1f3f3bc2865d1e00dbe2e3247a0cc9671e586d14402568d06dc70d3590', 'uid': 505}, {'bytes': 18809, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/abcea89414687ddb24077fa95517b830/lib/types/catalog.d.ts', 'sha256': 'd4fc0b1f3f3bc2865d1e00dbe2e3247a0cc9671e586d14402568d06dc70d3590', 'uid': 0}, {'bytes': 5003, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/packages/llm/llm-pi-ai/lib/types/catalog.d.ts.map', 'sha256': '2641d2a9a3844e4c8e46573805959346609a8c93f1464c68e640e87ff29e4ec5', 'uid': 505}, {'bytes': 5003, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/abcea89414687ddb24077fa95517b830/lib/types/catalog.d.ts.map', 'sha256': '2641d2a9a3844e4c8e46573805959346609a8c93f1464c68e640e87ff29e4ec5', 'uid': 0}, {'bytes': 29315, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/packages/llm/llm-pi-ai/lib/types/catalog.js', 'sha256': 'abc2c28fb00d67dfbe9e017898d88a889d2a505e9a0777c3a7521f58ab7a0654', 'uid': 505}, {'bytes': 29315, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/abcea89414687ddb24077fa95517b830/lib/types/catalog.js', 'sha256': 'abc2c28fb00d67dfbe9e017898d88a889d2a505e9a0777c3a7521f58ab7a0654', 'uid': 0}, {'bytes': 13772, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/packages/llm/llm-pi-ai/lib/types/catalog.js.map', 'sha256': '54579a33f5a89c5ec9445b6ba139d9043a02794364eed3d71d2df79645a6f184', 'uid': 505}, {'bytes': 13772, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/abcea89414687ddb24077fa95517b830/lib/types/catalog.js.map', 'sha256': '54579a33f5a89c5ec9445b6ba139d9043a02794364eed3d71d2df79645a6f184', 'uid': 0}, {'bytes': 10712, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/packages/llm/llm-pi-ai/lib/types/config.d.ts', 'sha256': 'ec7a937dc6df2e9ea772a7c2d983c7f10bcfe74f10cef7ab77474c8c2d89652e', 'uid': 505}, {'bytes': 10712, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/abcea89414687ddb24077fa95517b830/lib/types/config.d.ts', 'sha256': 'ec7a937dc6df2e9ea772a7c2d983c7f10bcfe74f10cef7ab77474c8c2d89652e', 'uid': 0}, {'bytes': 2680, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/packages/llm/llm-pi-ai/lib/types/config.d.ts.map', 'sha256': '594fe366b58fcca4a8b66a7bf604693de711c3eb77136bed214c4e07596a0c8a', 'uid': 505}, {'bytes': 2680, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/abcea89414687ddb24077fa95517b830/lib/types/config.d.ts.map', 'sha256': '594fe366b58fcca4a8b66a7bf604693de711c3eb77136bed214c4e07596a0c8a', 'uid': 0}, {'bytes': 13398, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/packages/llm/llm-pi-ai/lib/types/config.js', 'sha256': '8b286089ed53578d51d150a54fe54d4a719c225d5b4ffb14abd19559855a1d34', 'uid': 505}, {'bytes': 13398, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/abcea89414687ddb24077fa95517b830/lib/types/config.js', 'sha256': '8b286089ed53578d51d150a54fe54d4a719c225d5b4ffb14abd19559855a1d34', 'uid': 0}, {'bytes': 8221, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/packages/llm/llm-pi-ai/lib/types/config.js.map', 'sha256': 'cac19dd01849eaca519cf3455bea210848127b0d067ee6319119a5bfb34f713e', 'uid': 505}, {'bytes': 8221, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/abcea89414687ddb24077fa95517b830/lib/types/config.js.map', 'sha256': 'cac19dd01849eaca519cf3455bea210848127b0d067ee6319119a5bfb34f713e', 'uid': 0}, {'bytes': 1996, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/packages/llm/llm-pi-ai/lib/types/context.d.ts', 'sha256': '24b5d89b283f2608426cd36d9515b048b02c4c80b56ed22204afaebc402501a3', 'uid': 505}, {'bytes': 1996, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/abcea89414687ddb24077fa95517b830/lib/types/context.d.ts', 'sha256': '24b5d89b283f2608426cd36d9515b048b02c4c80b56ed22204afaebc402501a3', 'uid': 0}, {'bytes': 616, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/packages/llm/llm-pi-ai/lib/types/context.d.ts.map', 'sha256': 'cef58847ec44f0399b806ac3cfcebf9cfb232c6291384aa283760e8885df8325', 'uid': 505}, {'bytes': 616, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/abcea89414687ddb24077fa95517b830/lib/types/context.d.ts.map', 'sha256': 'cef58847ec44f0399b806ac3cfcebf9cfb232c6291384aa283760e8885df8325', 'uid': 0}, {'bytes': 7384, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/packages/llm/llm-pi-ai/lib/types/context.js', 'sha256': '5e0d92d6556e75da00538bf6cf77fa6b6b5f3d61900ae2abea6b75149a944cf3', 'uid': 505}, {'bytes': 7384, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/abcea89414687ddb24077fa95517b830/lib/types/context.js', 'sha256': '5e0d92d6556e75da00538bf6cf77fa6b6b5f3d61900ae2abea6b75149a944cf3', 'uid': 0}, {'bytes': 6559, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/packages/llm/llm-pi-ai/lib/types/context.js.map', 'sha256': '4f7d04146bf9f2cf002f6100b20a1377cab3a904b026b21e1b700595b57bf3db', 'uid': 505}, {'bytes': 6559, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/abcea89414687ddb24077fa95517b830/lib/types/context.js.map', 'sha256': '4f7d04146bf9f2cf002f6100b20a1377cab3a904b026b21e1b700595b57bf3db', 'uid': 0}, {'bytes': 2189, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/packages/llm/llm-pi-ai/lib/types/discovery.d.ts', 'sha256': 'a758e5ac6423d6322b76840eb29ebf590ac708f834f272cfe80635491a794de6', 'uid': 505}, {'bytes': 2189, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/abcea89414687ddb24077fa95517b830/lib/types/discovery.d.ts', 'sha256': 'a758e5ac6423d6322b76840eb29ebf590ac708f834f272cfe80635491a794de6', 'uid': 0}, {'bytes': 370, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/packages/llm/llm-pi-ai/lib/types/discovery.d.ts.map', 'sha256': 'aeff36ff4c6d085ebb8fb6501da17f59db85eac6d53518dec682877fa04fd0a4', 'uid': 505}, {'bytes': 370, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/abcea89414687ddb24077fa95517b830/lib/types/discovery.d.ts.map', 'sha256': 'aeff36ff4c6d085ebb8fb6501da17f59db85eac6d53518dec682877fa04fd0a4', 'uid': 0}, {'bytes': 11811, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/packages/llm/llm-pi-ai/lib/types/discovery.js', 'sha256': 'c1464e9c82e8018403003bf98cee972f57d3a982d12543d9e0df4ed05d9a27d2', 'uid': 505}, {'bytes': 11811, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/abcea89414687ddb24077fa95517b830/lib/types/discovery.js', 'sha256': 'c1464e9c82e8018403003bf98cee972f57d3a982d12543d9e0df4ed05d9a27d2', 'uid': 0}, {'bytes': 6331, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/packages/llm/llm-pi-ai/lib/types/discovery.js.map', 'sha256': '8d9079c75f3cd5f9fe66247540d6d3ee4dbb3adb022880773468c244588a729c', 'uid': 505}, {'bytes': 6331, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/abcea89414687ddb24077fa95517b830/lib/types/discovery.js.map', 'sha256': '8d9079c75f3cd5f9fe66247540d6d3ee4dbb3adb022880773468c244588a729c', 'uid': 0}, {'bytes': 2863, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/packages/llm/llm-pi-ai/lib/types/index.d.ts', 'sha256': 'f2d6f1e1f4ec9db206b00c5d48d89e767af0240663d9a46281572850f29767ed', 'uid': 505}, {'bytes': 2863, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/abcea89414687ddb24077fa95517b830/lib/types/index.d.ts', 'sha256': 'f2d6f1e1f4ec9db206b00c5d48d89e767af0240663d9a46281572850f29767ed', 'uid': 0}, {'bytes': 712, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/packages/llm/llm-pi-ai/lib/types/index.d.ts.map', 'sha256': '8a418fe036a4a20fdbe939b951fbf0eba0655f62924c205cf8d770e79fdfd362', 'uid': 505}, {'bytes': 712, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/abcea89414687ddb24077fa95517b830/lib/types/index.d.ts.map', 'sha256': '8a418fe036a4a20fdbe939b951fbf0eba0655f62924c205cf8d770e79fdfd362', 'uid': 0}, {'bytes': 14233, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/packages/llm/llm-pi-ai/lib/types/index.js', 'sha256': 'f834f9eabe6d75c2b753d5ce2c4c63b980183c5a3e60ecbee11277aedca278ff', 'uid': 505}, {'bytes': 14233, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/abcea89414687ddb24077fa95517b830/lib/types/index.js', 'sha256': 'f834f9eabe6d75c2b753d5ce2c4c63b980183c5a3e60ecbee11277aedca278ff', 'uid': 0}, {'bytes': 6018, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/packages/llm/llm-pi-ai/lib/types/index.js.map', 'sha256': '1a8fa7fbcf43bef110d78b8ba39ebbad64a2b6486fdafbd59c138ec821cd77be', 'uid': 505}, {'bytes': 6018, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/abcea89414687ddb24077fa95517b830/lib/types/index.js.map', 'sha256': '1a8fa7fbcf43bef110d78b8ba39ebbad64a2b6486fdafbd59c138ec821cd77be', 'uid': 0}, {'bytes': 679, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/packages/llm/llm-pi-ai/lib/types/invariant.d.ts', 'sha256': 'f8b0dcb52b2822c992fa0d40d00b681d1fe7e8c4274b5839fd5c6456fb2503bc', 'uid': 505}, {'bytes': 679, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/abcea89414687ddb24077fa95517b830/lib/types/invariant.d.ts', 'sha256': 'f8b0dcb52b2822c992fa0d40d00b681d1fe7e8c4274b5839fd5c6456fb2503bc', 'uid': 0}, {'bytes': 348, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/packages/llm/llm-pi-ai/lib/types/invariant.d.ts.map', 'sha256': '7097e7d7da144bd7255f76e8a8c57026c94ac16da5128f20ce8c00ddd0068729', 'uid': 505}, {'bytes': 348, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/abcea89414687ddb24077fa95517b830/lib/types/invariant.d.ts.map', 'sha256': '7097e7d7da144bd7255f76e8a8c57026c94ac16da5128f20ce8c00ddd0068729', 'uid': 0}, {'bytes': 903, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/packages/llm/llm-pi-ai/lib/types/invariant.js', 'sha256': 'a30f05b519d6c649e853f9c4b016426cd722e4d6a2f6d8a242d0cd4aa24971c2', 'uid': 505}, {'bytes': 903, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/abcea89414687ddb24077fa95517b830/lib/types/invariant.js', 'sha256': 'a30f05b519d6c649e853f9c4b016426cd722e4d6a2f6d8a242d0cd4aa24971c2', 'uid': 0}, {'bytes': 499, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/packages/llm/llm-pi-ai/lib/types/invariant.js.map', 'sha256': '7446b15ecee69c9143a0e2191176c214e7aa196d43d3d200ec2cdee6576a59c0', 'uid': 505}, {'bytes': 499, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/abcea89414687ddb24077fa95517b830/lib/types/invariant.js.map', 'sha256': '7446b15ecee69c9143a0e2191176c214e7aa196d43d3d200ec2cdee6576a59c0', 'uid': 0}, {'bytes': 2922, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/packages/llm/llm-pi-ai/lib/types/provider.d.ts', 'sha256': 'b0909f05766b177eceacbb36a30cd12d59d6d02a2adc39bf1ab928f3ae962357', 'uid': 505}, {'bytes': 2922, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/abcea89414687ddb24077fa95517b830/lib/types/provider.d.ts', 'sha256': 'b0909f05766b177eceacbb36a30cd12d59d6d02a2adc39bf1ab928f3ae962357', 'uid': 0}, {'bytes': 651, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/packages/llm/llm-pi-ai/lib/types/provider.d.ts.map', 'sha256': '72730e994533ffab8acff8170bdebbd65f3ae4d8e2e54ec8a3b597f2613c43b0', 'uid': 505}, {'bytes': 651, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/abcea89414687ddb24077fa95517b830/lib/types/provider.d.ts.map', 'sha256': '72730e994533ffab8acff8170bdebbd65f3ae4d8e2e54ec8a3b597f2613c43b0', 'uid': 0}, {'bytes': 8367, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/packages/llm/llm-pi-ai/lib/types/provider.js', 'sha256': '860770a7cca109631a6d131b68ee4da8aa43ca726c3847ad7b420909b30947f8', 'uid': 505}, {'bytes': 8367, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/abcea89414687ddb24077fa95517b830/lib/types/provider.js', 'sha256': '860770a7cca109631a6d131b68ee4da8aa43ca726c3847ad7b420909b30947f8', 'uid': 0}, {'bytes': 2806, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/packages/llm/llm-pi-ai/lib/types/provider.js.map', 'sha256': 'f296c3e1c9334921281266821a5eca27bb0d1522fb411e0db0582521466b58ed', 'uid': 505}, {'bytes': 2806, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/abcea89414687ddb24077fa95517b830/lib/types/provider.js.map', 'sha256': 'f296c3e1c9334921281266821a5eca27bb0d1522fb411e0db0582521466b58ed', 'uid': 0}, {'bytes': 2443, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/packages/llm/llm-pi-ai/lib/types/replay.d.ts', 'sha256': '1849c73bbd1fb69dfeaf7a5e67b7c77f394a070f4df33e9082acb47734492590', 'uid': 505}, {'bytes': 2443, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/abcea89414687ddb24077fa95517b830/lib/types/replay.d.ts', 'sha256': '1849c73bbd1fb69dfeaf7a5e67b7c77f394a070f4df33e9082acb47734492590', 'uid': 0}, {'bytes': 988, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/packages/llm/llm-pi-ai/lib/types/replay.d.ts.map', 'sha256': 'e1708e0eb9870bdfb4de46fa3cf005a3cede2d50a7b6f97dd58367ad74559c99', 'uid': 505}, {'bytes': 988, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/abcea89414687ddb24077fa95517b830/lib/types/replay.d.ts.map', 'sha256': 'e1708e0eb9870bdfb4de46fa3cf005a3cede2d50a7b6f97dd58367ad74559c99', 'uid': 0}, {'bytes': 10933, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/packages/llm/llm-pi-ai/lib/types/replay.js', 'sha256': 'e0226d7c9d5dbb9d2d33a549ed24a50ddc4391b97b5bcd3739dabf35480a1517', 'uid': 505}, {'bytes': 10933, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/abcea89414687ddb24077fa95517b830/lib/types/replay.js', 'sha256': 'e0226d7c9d5dbb9d2d33a549ed24a50ddc4391b97b5bcd3739dabf35480a1517', 'uid': 0}, {'bytes': 8280, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/packages/llm/llm-pi-ai/lib/types/replay.js.map', 'sha256': '27889bb3bedfaa940092291b7171d77c5bc51b7a3d4de20313b75708cdb42b47', 'uid': 505}, {'bytes': 8280, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/abcea89414687ddb24077fa95517b830/lib/types/replay.js.map', 'sha256': '27889bb3bedfaa940092291b7171d77c5bc51b7a3d4de20313b75708cdb42b47', 'uid': 0}, {'bytes': 2140, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/packages/llm/llm-pi-ai/lib/types/stream.d.ts', 'sha256': '402a1eaaea1548212d117a7cc7b6b06fd8489fd32935ddc898cc159b5aff8462', 'uid': 505}, {'bytes': 2140, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/abcea89414687ddb24077fa95517b830/lib/types/stream.d.ts', 'sha256': '402a1eaaea1548212d117a7cc7b6b06fd8489fd32935ddc898cc159b5aff8462', 'uid': 0}, {'bytes': 571, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/packages/llm/llm-pi-ai/lib/types/stream.d.ts.map', 'sha256': '40c4013a919a6960ce9b44c013d7b28f1a91d6004e67decfe57122cccc0ec605', 'uid': 505}, {'bytes': 571, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/abcea89414687ddb24077fa95517b830/lib/types/stream.d.ts.map', 'sha256': '40c4013a919a6960ce9b44c013d7b28f1a91d6004e67decfe57122cccc0ec605', 'uid': 0}, {'bytes': 13849, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/packages/llm/llm-pi-ai/lib/types/stream.js', 'sha256': '41dddaa6c9017be0c59f27b0706c456fb6b53a3650d5b00614092b2169cbb3b0', 'uid': 505}, {'bytes': 13849, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/abcea89414687ddb24077fa95517b830/lib/types/stream.js', 'sha256': '41dddaa6c9017be0c59f27b0706c456fb6b53a3650d5b00614092b2169cbb3b0', 'uid': 0}, {'bytes': 7683, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/packages/llm/llm-pi-ai/lib/types/stream.js.map', 'sha256': 'a948c77ebc5c363abb0b5d52e59ce4756c8f5ef9eae19e33daa060e1abd02e5d', 'uid': 505}, {'bytes': 7683, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/abcea89414687ddb24077fa95517b830/lib/types/stream.js.map', 'sha256': 'a948c77ebc5c363abb0b5d52e59ce4756c8f5ef9eae19e33daa060e1abd02e5d', 'uid': 0}, {'bytes': 60920, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/node_modules/.pnpm/@earendil-works+pi-ai@0.82.1_@modelcontextprotocol+sdk@1.29.0_zod@4.4.3__ws@8.21.0_zod@4.4.3/node_modules/@earendil-works/pi-ai/dist/api/openai-completions.d.ts.map', 'sha256': '44b166fe60b434d5075c1a4c0c5ea5084598072e2588daa71c7e1d3ab85dad29', 'uid': 505}, {'bytes': 60920, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/e45d7e39a15efbf9e2a64f449cb0e8bd/dist/api/openai-completions.d.ts.map', 'sha256': '44b166fe60b434d5075c1a4c0c5ea5084598072e2588daa71c7e1d3ab85dad29', 'uid': 0}, {'bytes': 57297, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/node_modules/.pnpm/@earendil-works+pi-ai@0.82.1_@modelcontextprotocol+sdk@1.29.0_zod@4.4.3__ws@8.21.0_zod@4.4.3/node_modules/@earendil-works/pi-ai/dist/api/openai-completions.js', 'sha256': '64574442e6aeba782b224bf643d230c83a7f4e7980e4fc166cf936d30d9be50a', 'uid': 505}, {'bytes': 57297, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/e45d7e39a15efbf9e2a64f449cb0e8bd/dist/api/openai-completions.js', 'sha256': '64574442e6aeba782b224bf643d230c83a7f4e7980e4fc166cf936d30d9be50a', 'uid': 0}, {'bytes': 103972, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/node_modules/.pnpm/@earendil-works+pi-ai@0.82.1_@modelcontextprotocol+sdk@1.29.0_zod@4.4.3__ws@8.21.0_zod@4.4.3/node_modules/@earendil-works/pi-ai/dist/api/openai-completions.js.map', 'sha256': 'fc631f1cbec27e7d68878c423a913a3463cb235fa0ac3f24f71812798cf71f9b', 'uid': 505}, {'bytes': 103972, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/e45d7e39a15efbf9e2a64f449cb0e8bd/dist/api/openai-completions.js.map', 'sha256': 'fc631f1cbec27e7d68878c423a913a3463cb235fa0ac3f24f71812798cf71f9b', 'uid': 0}, {'bytes': 32086, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/node_modules/.pnpm/@earendil-works+pi-ai@0.82.1_@modelcontextprotocol+sdk@1.29.0_zod@4.4.3__ws@8.21.0_zod@4.4.3/node_modules/@earendil-works/pi-ai/dist/api/openai-responses-shared.d.ts.map', 'sha256': '292884a3cc59ebea846b64ee6b1d33d56c4ead5fcb3c63317f05e344439f0f6b', 'uid': 505}, {'bytes': 32086, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/e45d7e39a15efbf9e2a64f449cb0e8bd/dist/api/openai-responses-shared.d.ts.map', 'sha256': '292884a3cc59ebea846b64ee6b1d33d56c4ead5fcb3c63317f05e344439f0f6b', 'uid': 0}, {'bytes': 28596, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/node_modules/.pnpm/@earendil-works+pi-ai@0.82.1_@modelcontextprotocol+sdk@1.29.0_zod@4.4.3__ws@8.21.0_zod@4.4.3/node_modules/@earendil-works/pi-ai/dist/api/openai-responses-shared.js', 'sha256': '5ec637db5d115bb5a2da5e144bc83a526ad79dc5940d710824e49fefbbac0e05', 'uid': 505}, {'bytes': 28596, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/e45d7e39a15efbf9e2a64f449cb0e8bd/dist/api/openai-responses-shared.js', 'sha256': '5ec637db5d115bb5a2da5e144bc83a526ad79dc5940d710824e49fefbbac0e05', 'uid': 0}, {'bytes': 54656, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/node_modules/.pnpm/@earendil-works+pi-ai@0.82.1_@modelcontextprotocol+sdk@1.29.0_zod@4.4.3__ws@8.21.0_zod@4.4.3/node_modules/@earendil-works/pi-ai/dist/api/openai-responses-shared.js.map', 'sha256': '145dcc52e16ffacd47b162656c5d2bbc621319e24edaf78ac9a92247b5b296cf', 'uid': 505}, {'bytes': 54656, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/e45d7e39a15efbf9e2a64f449cb0e8bd/dist/api/openai-responses-shared.js.map', 'sha256': '145dcc52e16ffacd47b162656c5d2bbc621319e24edaf78ac9a92247b5b296cf', 'uid': 0}, {'bytes': 31970, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/node_modules/.pnpm/@earendil-works+pi-ai@0.82.1_@modelcontextprotocol+sdk@1.29.0_zod@4.4.3__ws@8.21.0_zod@4.4.3/node_modules/@earendil-works/pi-ai/dist/types.d.ts', 'sha256': 'c90d91182ebe6beac3606c1b998067a830064930f78cf3ee5e62b9fb2cb548e4', 'uid': 505}, {'bytes': 31970, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/e45d7e39a15efbf9e2a64f449cb0e8bd/dist/types.d.ts', 'sha256': 'c90d91182ebe6beac3606c1b998067a830064930f78cf3ee5e62b9fb2cb548e4', 'uid': 0}, {'bytes': 48962, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/node_modules/.pnpm/@earendil-works+pi-ai@0.82.1_@modelcontextprotocol+sdk@1.29.0_zod@4.4.3__ws@8.21.0_zod@4.4.3/node_modules/@earendil-works/pi-ai/dist/types.d.ts.map', 'sha256': 'c0dbe81bf66f0f776a7896d25ed52a2e82fc1c5521a8da80c5ac0e0982b15107', 'uid': 505}, {'bytes': 48962, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/e45d7e39a15efbf9e2a64f449cb0e8bd/dist/types.d.ts.map', 'sha256': 'c0dbe81bf66f0f776a7896d25ed52a2e82fc1c5521a8da80c5ac0e0982b15107', 'uid': 0}, {'bytes': 44, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/node_modules/.pnpm/@earendil-works+pi-ai@0.82.1_@modelcontextprotocol+sdk@1.29.0_zod@4.4.3__ws@8.21.0_zod@4.4.3/node_modules/@earendil-works/pi-ai/dist/types.js', 'sha256': '01ae2a5b120382f9a648ced7ee8507493a134f216d100fc61600c6c9738235d2', 'uid': 505}, {'bytes': 44, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/e45d7e39a15efbf9e2a64f449cb0e8bd/dist/types.js', 'sha256': '01ae2a5b120382f9a648ced7ee8507493a134f216d100fc61600c6c9738235d2', 'uid': 0}, {'bytes': 33989, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/node_modules/.pnpm/@earendil-works+pi-ai@0.82.1_@modelcontextprotocol+sdk@1.29.0_zod@4.4.3__ws@8.21.0_zod@4.4.3/node_modules/@earendil-works/pi-ai/dist/types.js.map', 'sha256': '97e2a4a4ea1497818db8f46978d10c7ffc061c63c893f41443af98b9af9b7bd6', 'uid': 505}, {'bytes': 33989, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/node_modules/.capture-deps/e45d7e39a15efbf9e2a64f449cb0e8bd/dist/types.js.map', 'sha256': '97e2a4a4ea1497818db8f46978d10c7ffc061c63c893f41443af98b9af9b7bd6', 'uid': 0}, {'bytes': 20965, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/packages/broker/src/index.js', 'sha256': '8916dec1ecf7f8ab42b050f8267036be5a15f76fc2cb35f7ae84ffcf59a2c563', 'uid': 505}, {'bytes': 18539, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/packages/broker/src/authoring-file-entry.js', 'sha256': '2db5aeea525f138aa2a4441831f377c2dbf6c17271a412c320331c4241d0e26a', 'uid': 505}, {'bytes': 7533, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/app/packages/broker/src/capabilities/workflow-definition-read.js', 'sha256': '049358d75a3e2b8082afe172cb77c338da8506e79327e06479645a82b49fc478', 'uid': 505}, {'bytes': 16088, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/packages/attachment/attachment-local/lib/index.js', 'sha256': 'af12c4406845ad7739ca176c07d776ec21243e6575217b75960aacfb3c6357bb', 'uid': 505}, {'bytes': 13768, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/packages/attachment/attachment-local/lib/types/store.js', 'sha256': 'f89f8d260f0029ed24008e1f01b7364fb208aef263d8b9326b7eba8ff0487335', 'uid': 505}, {'bytes': 2643, 'gid': 601, 'mode': 420, 'path': '/usr/local/libexec/agent-core/harness/node_modules/.pnpm/@earendil-works+pi-ai@0.82.1_@modelcontextprotocol+sdk@1.29.0_zod@4.4.3__ws@8.21.0_zod@4.4.3/node_modules/@earendil-works/pi-ai/package.json', 'sha256': '955aa1caab4c875fc7755abe7cacbf9002d9875c471e8d5af245e495ae1d4596', 'uid': 505}], 'oldCleanAbsent': ['/var/db/agent-core/authsvc-codex-migration/activation-code-input', '/var/db/agent-core/authsvc-codex-migration/b7-preparation-input.json', '/var/db/agent-core/authsvc-codex-migration/b7-six-target-batch.json', '/var/db/agent-core/authsvc-codex-migration/b7-six-target-batch.json.new', '/var/db/agent-core/authsvc-codex-migration/migration-transaction.json', '/var/db/agent-core/authsvc-codex-migration/migration-fence.json', '/usr/local/var/agent-core/production-mutation-locks/production-deploy.lock', '/usr/local/share/agent-core/artifacts'], 'oldProducer': {'authorization': 'B7_SIX_FIXED_SCOPE_USER_AUTHORIZED_20261007', 'homeFiles': ['settings.yaml', 'profiles/agent-core-production/package.json', 'profiles/agent-core-production/cordis.patch.yml'], 'journal': '/var/db/agent-core/authsvc-codex-migration/.b7-six-journal.jsonl', 'preimageCompatibility': {'byteBindingPath': '/private/var/db/agent-deploy-system-execution/b7-native-execution-r32-c71fd2cc/b7-wired-stage/preimage-byte-bindings.json', 'byteBindingSha256': '2ab340c78a5996f59d7a9e7249bb411366cef1fec979eea534e70e60940f4d12', 'currentJournal': {'authority': 'mother Spec PR452 copy 7911a67e section 3 L103 (authorized operator read surface)', 'journalSha256': 'ff9f2122af69f557ba731958d47654525a138cb9587989f6664948abe828d8a4', 'origin': 'AUTHORIZED_OPERATOR_READ_SURFACE_V1', 'reader': 'executor agent via authorized sudo -n read-only channel (NOT the human Owner)', 'utc': '2026-10-15T15:36:00Z'}, 'journalSha256': 'ff9f2122af69f557ba731958d47654525a138cb9587989f6664948abe828d8a4', 'kind': 'B7_THREE_PREIMAGE_COMPATIBILITY_V1', 'metadataReceiptSha256': '05afac224c0cb4cf736205c469eb5598e858ecbffbd567d6367324bee4cc99fb'}, 'preimageStore': '/var/db/agent-core/authsvc-codex-migration/.b7-six-preimage-store'}, 'recoveryRoot': '/var/db/agent-core/authsvc-codex-migration', 'sixLiveReconciliation': {'kind': 'B7_SIX_LIVE_RECONCILIATION_V1', 'pluginLibSha256': 'e1b22e294a46853fc58aa21b15d5e72fd910d6e2c0cf64ce16ed0f531d7e251e'}, 'sources': {'oldDisposal': {'path': '/private/var/db/agent-deploy-system-execution/b7-native-execution-r27-new-candidate-uninstallable/b7-wired-stage/old-stage-lease-disposal-once.py', 'sha256': '519441cd6b51ba3039340027746eb493c36d9ffc41bfc60c7c256e79b4f81e53'}, 'option': {'path': '/private/var/db/agent-deploy-system-execution/b7-native-execution-r27-new-candidate-uninstallable/b7-wired-stage/option-b-quarantine-remove.py', 'sha256': 'e25593a703b74620e741dd40ce870d57d502a4b658f9b8564006e84b142bdc03'}}, 'userDisposalReceipt': {'noncePrefix': 'aa0d61e64c72b44c', 'stdoutFile': 'USER-RECEIPTS.json'}}, 'checkpoint_sha256': '6c135705da444996ef7aecd2a2c743d2c626e451059fcd638f04c2c21e5bb418', 'public_configuration': {'at': '2026-10-17T03:18:41.636935+00:00', 'read_only_fixed_metadata_hashes_only': True, 'entries': [{'path': '/Users/authsvc/.agent-core/agent-model-overrides.json', 'rc': 0, 'stat': '16777233|188001967|505|601|600|1|11045|Regular File|', 'stderr': '', 'sha256': '321897cd8fb3024f05c4cb0b2960351fcd76b208d749e9b160ffd5e7b0216bf1'}, {'path': '/Users/authsvc/.agent-core/agents.json', 'rc': 0, 'stat': '16777233|188124079|0|601|755|1|48|Symbolic Link|/usr/local/libexec/agent-core/config/agents.json', 'stderr': ''}, {'path': '/usr/local/libexec/agent-core/config/agents.json', 'rc': 0, 'stat': '16777233|122832634|0|0|644|1|17970|Regular File|', 'stderr': '', 'sha256': 'e0800b0fde6fc46b2873decd0f83c9b807b48b56cc3c9ad9cf578a5685b5b6fe'}, {'path': '/Users/authsvc/.agent-core/control/codex-plugin-runtime/current', 'rc': 1, 'stat': '', 'stderr': 'stat: /Users/authsvc/.agent-core/control/codex-plugin-runtime/current: stat: No such file or directory\n'}]}, 'tools': {'outerPath': {'path': '/private/var/db/agent-core/authsvc-codex-migration/activation-code-input/b7-entry-code/b7-wired-inputs/dsh-agent-core/docs/evidence/shared-codex-auth-deployment-root-refreeze-v2-20261002/owner-router-closure-g2-g7-v23.sh', 'sha256': 'd323f7022f164b00fc744f37f0144bfadbbe43955e57ad3efb342e8d2f4c7f45', 'dev': 16777233, 'ino': 204952966, 'uid': 0, 'gid': 0, 'mode': 420, 'nlink': 1, 'bytes': 40784, 'kind': 'Regular File'}, 'carrierPath': {'path': '/private/var/db/agent-core/authsvc-codex-migration/activation-code-input/b7-entry-code/b7-wired-inputs/dsh-agent-core/docs/evidence/openai-codex-refresh-token-reused-v1-20260910/owner-authsvc-plugin-upgrade-r13.sh', 'sha256': 'fd6a1618bffe880ece8a59d9dc3cdaffbcfef2c0b2b9232398231a08eb2529c3', 'dev': 16777233, 'ino': 204952918, 'uid': 0, 'gid': 0, 'mode': 420, 'nlink': 1, 'bytes': 103038, 'kind': 'Regular File'}, 'toolPath': {'path': '/private/var/db/agent-core/authsvc-codex-migration/activation-code-input/b7-entry-code/b7-wired-inputs/dsh-agent-core/scripts/lib/deployment-reuse/transaction-recovery.mjs', 'sha256': 'be89f18aa738ea93a923647182ff89c6400dfe72f718ed31fe8f5e58b81c10ab', 'dev': 16777233, 'ino': 204954169, 'uid': 0, 'gid': 0, 'mode': 420, 'nlink': 1, 'bytes': 21544, 'kind': 'Regular File'}, 'migrationToolPath': {'path': '/private/var/db/agent-core/authsvc-codex-migration/activation-code-input/b7-entry-code/b7-wired-inputs/dsh-agent-core/scripts/lib/trusted-cp-fleet-config-v2v3-migration.mjs', 'sha256': '22e045c5b218a7822f206a524b3b0c6d9065ef795b98e28e8bdd3af0f053f3e8', 'dev': 16777233, 'ino': 204954221, 'uid': 0, 'gid': 0, 'mode': 420, 'nlink': 1, 'bytes': 25005, 'kind': 'Regular File'}, 'preparationToolPath': {'path': '/private/var/db/agent-core/authsvc-codex-migration/activation-code-input/b7-entry-code/b7-wired-inputs/dsh-agent-core/scripts/lib/deployment-reuse/b7-preparation.mjs', 'sha256': 'db1977a2bf5fffd7b2d07a1860b1c697c6c20b19034eed35ce7511c651ff889a', 'dev': 16777233, 'ino': 204954147, 'uid': 0, 'gid': 0, 'mode': 420, 'nlink': 1, 'bytes': 26274, 'kind': 'Regular File'}, 'installerPath': {'path': '/private/var/db/agent-core/authsvc-codex-migration/activation-code-input/b7-entry-code/b7-wired-inputs/dsh-agent-core/scripts/trusted-cp-deploy-install.sh', 'sha256': 'e342743320a525f68a7022df6cce368d0707b08dc4e6f04e3b2dfc689787044d', 'dev': 16777233, 'ino': 204954267, 'uid': 0, 'gid': 0, 'mode': 420, 'nlink': 1, 'bytes': 62640, 'kind': 'Regular File'}, 'sixTargetProducerPath': {'path': '/private/var/db/agent-core/authsvc-codex-migration/activation-code-input/b7-entry-code/b7-wired-inputs/dsh-agent-core/scripts/lib/deployment-reuse/six-target-provision.mjs', 'sha256': '03322db43a98f70c857ca0064eaa09a9881004abb0efccc174c21d1e23ce325c', 'dev': 16777233, 'ino': 204954162, 'uid': 0, 'gid': 0, 'mode': 420, 'nlink': 1, 'bytes': 17459, 'kind': 'Regular File'}, 'canaryProducerPath': {'path': '/private/var/db/agent-core/authsvc-codex-migration/activation-code-input/b7-entry-code/b7-wired-inputs/dsh-agent-core/scripts/lib/deployment-reuse/canary-producer.mjs', 'sha256': '2a8420e177a559f30855aabed6c94bf76409452008482d0345c7f77962276be4', 'dev': 16777233, 'ino': 204954148, 'uid': 0, 'gid': 0, 'mode': 420, 'nlink': 1, 'bytes': 6156, 'kind': 'Regular File'}, 'ownerRecorderPath': {'path': '/private/var/db/agent-core/authsvc-codex-migration/activation-code-input/b7-entry-code/b7-wired-inputs/dsh-agent-core/scripts/lib/deployment-reuse/b7-owner-confirmation.py', 'sha256': '243357f274a6a8a7ed9bcdad0dd366f3f3699a55e4b10d67ce68c274e6c8d39b', 'dev': 16777233, 'ino': 204954146, 'uid': 0, 'gid': 0, 'mode': 420, 'nlink': 1, 'bytes': 34907, 'kind': 'Regular File'}}}
ORIGINAL_ROW = {'enabled': True, 'files': [{'bytes': 323, 'relative': 'accepted-provisioning-commit.txt', 'sha256': '49c5113d2bae4971bf5f49521f2f3cb18627c57f190b68ba6fac21436a0d25b9', 'sourcePath': '/private/var/db/agent-deploy-system/inputs/b7-install-r32/packet/b7-wired-stage/accepted-provisioning-commit.txt'}, {'bytes': 13402, 'relative': 'accepted-spec-copy-b08db324aa179af962536a804d275866fa2bb7f2.md', 'sha256': '3dd42a9b8793bb9f68df420d779edd7af42def897861551349cf68db30dd8458', 'sourcePath': '/private/var/db/agent-deploy-system/inputs/b7-install-r32/packet/b7-wired-stage/accepted-spec-copy-b08db324aa179af962536a804d275866fa2bb7f2.md'}, {'bytes': 36944, 'relative': 'checkpoint-inputs.json', 'sha256': '6c135705da444996ef7aecd2a2c743d2c626e451059fcd638f04c2c21e5bb418', 'sourcePath': '/private/var/db/agent-deploy-system/inputs/b7-install-r32/packet/b7-wired-stage/checkpoint-inputs.json'}, {'bytes': 21288, 'relative': 'checkpoint.py', 'sha256': '4e3218d2fa69568353f93e2960bbc774e20418ad890e992359481fe87d17d5b2', 'sourcePath': '/private/var/db/agent-deploy-system/inputs/b7-install-r32/packet/b7-wired-stage/checkpoint.py'}, {'bytes': 58648, 'relative': 'old-stage-lease-disposal-once.py', 'sha256': '519441cd6b51ba3039340027746eb493c36d9ffc41bfc60c7c256e79b4f81e53', 'sourcePath': '/private/var/db/agent-deploy-system/inputs/b7-install-r32/packet/b7-wired-stage/old-stage-lease-disposal-once.py'}, {'bytes': 15121, 'relative': 'option-b-quarantine-remove.py', 'sha256': 'e25593a703b74620e741dd40ce870d57d502a4b658f9b8564006e84b142bdc03', 'sourcePath': '/private/var/db/agent-deploy-system/inputs/b7-install-r32/packet/b7-wired-stage/option-b-quarantine-remove.py'}, {'bytes': 1061, 'relative': 'preimage-byte-bindings.json', 'sha256': '2ab340c78a5996f59d7a9e7249bb411366cef1fec979eea534e70e60940f4d12', 'sourcePath': '/private/var/db/agent-deploy-system/inputs/b7-install-r32/packet/b7-wired-stage/preimage-byte-bindings.json'}, {'bytes': 8819, 'relative': 'seed-materials.mjs', 'sha256': '6d5060b2bb673d918083d716a2d6085764fb2ac038c24443265bdc39575bdff5', 'sourcePath': '/private/var/db/agent-deploy-system/inputs/b7-install-r32/packet/b7-wired-stage/seed-materials.mjs'}, {'bytes': 29408, 'relative': 'stage-seed-once.py', 'sha256': '85d446af3754eed86648a716a97cd7d7345bf7c8cf07c78c7be67546901c9910', 'sourcePath': '/private/var/db/agent-deploy-system/inputs/b7-install-r32/packet/b7-wired-stage/stage-seed-once.py'}], 'inputLimit': 4096, 'manifestPath': '/private/var/db/agent-deploy-system/inputs/b7-install-r32/packet/PACKET.json', 'manifestSha256': 'a2ff19b8d8671ec6b19d812d455e3ae2497d19043d1ee53abbb2b93981527b12', 'maxRunSeconds': 7200, 'nativeLockPath': '/usr/local/var/agent-core/production-mutation-locks/production-deploy.lock', 'nativeTransactionPath': '/private/var/db/agent-core/authsvc-codex-migration/migration-transaction.json', 'outputLimit': 4194304, 'ownerIdleSeconds': 900, 'reason': 'B7_COHERENT_CANDIDATE_R32_BOUND_SOURCE_AND_FRESH_SNAPSHOT_ORIGINAL_GUARDS_REQUIRED', 'resumeOuterPath': '/private/var/db/agent-core/authsvc-codex-migration/activation-code-input/b7-entry-code/b7-wired-inputs/dsh-agent-core/docs/evidence/shared-codex-auth-deployment-root-refreeze-v2-20261002/owner-router-closure-g2-g7-v23.sh', 'resumeOuterSha256': 'd323f7022f164b00fc744f37f0144bfadbbe43955e57ad3efb342e8d2f4c7f45', 'snapshotRoot': '/private/var/db/agent-deploy-system-execution/b7-native-execution-r32-c71fd2cc/b7-wired-stage', 'stageArgv': ['/usr/bin/python3', '/private/var/db/agent-deploy-system-execution/b7-native-execution-r32-c71fd2cc/b7-wired-stage/stage-seed-once.py'], 'terminalBinding': {'canaryProducerSha256': '2a8420e177a559f30855aabed6c94bf76409452008482d0345c7f77962276be4', 'carrierPath': '/private/var/db/agent-core/authsvc-codex-migration/activation-code-input/b7-entry-code/b7-wired-inputs/dsh-agent-core/docs/evidence/openai-codex-refresh-token-reused-v1-20260910/owner-authsvc-plugin-upgrade-r13.sh', 'carrierSha256': 'fd6a1618bffe880ece8a59d9dc3cdaffbcfef2c0b2b9232398231a08eb2529c3', 'deploymentRoot': '/Users/authsvc/.agent-core', 'installerSha256': 'e342743320a525f68a7022df6cce368d0707b08dc4e6f04e3b2dfc689787044d', 'migrationToolSha256': '22e045c5b218a7822f206a524b3b0c6d9065ef795b98e28e8bdd3af0f053f3e8', 'outerPath': '/private/var/db/agent-core/authsvc-codex-migration/activation-code-input/b7-entry-code/b7-wired-inputs/dsh-agent-core/docs/evidence/shared-codex-auth-deployment-root-refreeze-v2-20261002/owner-router-closure-g2-g7-v23.sh', 'outerSha256': 'd323f7022f164b00fc744f37f0144bfadbbe43955e57ad3efb342e8d2f4c7f45', 'ownerRecorderSha256': '243357f274a6a8a7ed9bcdad0dd366f3f3699a55e4b10d67ce68c274e6c8d39b', 'preparationToolSha256': 'db1977a2bf5fffd7b2d07a1860b1c697c6c20b19034eed35ce7511c651ff889a', 'recoveryRoot': '/var/db/agent-core/authsvc-codex-migration', 'sixTargetProducerSha256': '03322db43a98f70c857ca0064eaa09a9881004abb0efccc174c21d1e23ce325c', 'toolSha256': 'be89f18aa738ea93a923647182ff89c6400dfe72f718ed31fe8f5e58b81c10ab', 'trustedRoot': '/usr/local/libexec/agent-core'}}

def _sha(raw):return hashlib.sha256(raw).hexdigest()

def _id(s):return (s.st_dev,s.st_ino,s.st_uid,s.st_gid,s.st_mode)

def _file(s):return _id(s)+(s.st_nlink,s.st_size,s.st_mtime_ns,s.st_ctime_ns)

def _canonical(v):return json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=True).encode()

def _strict(raw):
 def pairs(items):
  out={}
  for k,v in items:
   if k in out:raise ValueError('DUPLICATE_FIELD')
   out[k]=v
  return out
 return json.loads(raw,object_pairs_hook=pairs,parse_constant=lambda _:(_ for _ in ()).throw(ValueError('JSON_CONSTANT')))

def _parent(e,held,gid=None,mode=None):
 s=os.fstat(held.parent)
 e.need(stat.S_ISDIR(s.st_mode) and s.st_uid==0 and (gid is None or s.st_gid==gid) and (mode is None or stat.S_IMODE(s.st_mode)==mode))
 return _id(s)

def _verify(e,held,pin):
 e.need(_id(os.fstat(held.parent))==pin)
 held.verify()

def _read(e,path,mode,gid,limit=1024*1024,sync=False,expected_canonical=None):
 with e.ds.ObservationPath(str(path),'b7-evidence',e.ds._observation_root_owners()) as h:
  parent=_parent(e,h,80,0o755) if Path(path).parent==Path(e.ds.receipt_path(E33['operation_id'])).parent else _parent(e,h)
  before=os.stat(h.name,dir_fd=h.parent,follow_symlinks=False)
  e.need(stat.S_ISREG(before.st_mode) and before.st_uid==0 and before.st_gid==gid and stat.S_IMODE(before.st_mode)==mode and before.st_nlink==1 and 0<before.st_size<=limit)
  fd=os.open(h.name,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=h.parent)
  try:
   pin=_file(before);e.need(pin==_file(os.fstat(fd)))
   chunks=[];total=0
   while True:
    part=os.read(fd,min(65536,limit+1-total))
    if not part:break
    chunks.append(part);total+=len(part);e.need(total<=limit)
   raw=b''.join(chunks);e.need(len(raw)==before.st_size)
   if sync:
    e.need(expected_canonical is not None and raw==expected_canonical and _canonical(_strict(raw))==expected_canonical)
    os.fsync(fd);os.fsync(h.parent)
    os.lseek(fd,0,os.SEEK_SET);e.need(os.read(fd,limit+1)==raw)
   e.need(pin==_file(os.fstat(fd))==_file(os.stat(h.name,dir_fd=h.parent,follow_symlinks=False)))
   _verify(e,h,parent)
   return raw,(parent,pin,_sha(raw))
  finally:os.close(fd)

def _probe(e,path):
 with e.ds.ObservationPath(str(path),'b7-evidence',e.ds._observation_root_owners()) as h:
  try:os.stat(h.name,dir_fd=h.parent,follow_symlinks=False);return True
  except FileNotFoundError:return False

def _need_absent(e,path):e.need(not _probe(e,path))

def _lease(e):
 path=str(Path(e.ds.STATE_ROOT)/'mutation.lock')
 with e.ds.ObservationPath(path,'b7-mutation',e.ds._observation_root_owners()) as h:
  parent=_parent(e,h,80,0o770);fd=os.open(h.name,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=h.parent)
  try:
   s=os.fstat(fd);pin=_file(s)
   e.need([s.st_dev,s.st_ino]==E33['mutation_inode'])
   e.need(stat.S_ISREG(s.st_mode) and s.st_uid==0 and s.st_gid==80 and stat.S_IMODE(s.st_mode)==0o644 and s.st_nlink==1 and s.st_size==0)
   fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
   def verify():
    _verify(e,h,parent);e.need(pin==_file(os.fstat(fd))==_file(os.stat(h.name,dir_fd=h.parent,follow_symlinks=False)))
   verify();yield verify;verify()
  finally:os.close(fd)

def _rename_excl(e,parent,src,dst):
 e.need(sys.platform=='darwin');libc=ctypes.CDLL(None,use_errno=True);call=getattr(libc,'renameatx_np',None);e.need(call is not None)
 call.argtypes=(ctypes.c_int,ctypes.c_char_p,ctypes.c_int,ctypes.c_char_p,ctypes.c_uint);call.restype=ctypes.c_int
 if call(parent,os.fsencode(src),parent,os.fsencode(dst),0x4)!=0:
  n=ctypes.get_errno();raise OSError(n,os.strerror(n))

class _RecordParent:
 """Fixed receipt publication parent. Only its own directory entry changes.
 Other ancestors retain full original live pins; the final parent retains
 inode/custody (its size/times necessarily change during atomic publication).
 """
 def __init__(self,e,path):self.e=e;self.path=path;self.opened=[];self.trace=[]
 def __enter__(self):
  e=self.e
  try:
   e.need(self.path in e.disposal_paths(E33['operation_id']) and os.path.normpath(self.path)==self.path)
   e.need(os.path.commonpath((_FS_ROOT,self.path))==_FS_ROOT)
   parts=os.path.relpath(self.path,_FS_ROOT).split(os.sep)
   parent=os.open(_FS_ROOT,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW);self.opened.append(parent)
   self.root_pin=_file(os.fstat(parent));current=_FS_ROOT
   e.need(stat.S_ISDIR(os.fstat(parent).st_mode) and os.fstat(parent).st_uid==0 and not os.fstat(parent).st_mode&0o022)
   for index,part in enumerate(parts[:-1]):
    current=os.path.join(current,part);before=os.stat(part,dir_fd=parent,follow_symlinks=False)
    e.need(stat.S_ISDIR(before.st_mode) and before.st_uid==0)
    if current==e.ds.STATE_ROOT:e.need(before.st_gid==80 and stat.S_IMODE(before.st_mode)==0o770)
    else:e.need(not before.st_mode&0o022)
    fd=os.open(part,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=parent);self.opened.append(fd);e.need(_file(before)==_file(os.fstat(fd)))
    mutable=index==len(parts)-2;self.trace.append((parent,part,fd,_id(before) if mutable else _file(before),mutable));parent=fd
   self.parent,self.name=parent,parts[-1];_parent(e,self,80,0o755);self.verify();return self
  except BaseException:self.close();raise
 def verify(self):
  e=self.e;e.need(self.root_pin==_file(os.fstat(self.opened[0])))
  for parent,name,fd,pin,mutable in self.trace:
   key=_id if mutable else _file;e.need(pin==key(os.fstat(fd))==key(os.stat(name,dir_fd=parent,follow_symlinks=False)))
 def close(self):
  for fd in reversed(self.opened):os.close(fd)
  self.opened.clear()
 def __exit__(self,typ,value,tb):
  try:
   if typ is None:self.verify()
  finally:self.close()

def _publish(e,path,raw,recheck,lease):
 e.need(path in e.disposal_paths(E33['operation_id']))
 with _RecordParent(e,path) as h:
  parent=_parent(e,h,80,0o755);lease();_need_absent(e,path)
  tmp='.'+h.name+'.'+os.urandom(16).hex()+'.tmp';fd=None;pin=None
  try:
   fd=os.open(tmp,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW|os.O_CLOEXEC,0o600,dir_fd=h.parent)
   os.fchown(fd,0,80);os.fchmod(fd,0o600)
   offset=0
   while offset<len(raw):
    n=os.write(fd,raw[offset:]);e.need(n>0);offset+=n
   pin=_file(os.fstat(fd));os.fsync(fd);e.need(pin==_file(os.stat(tmp,dir_fd=h.parent,follow_symlinks=False)))
   recheck();lease();_verify(e,h,parent);_need_absent(e,path)
   e.need(pin==_file(os.fstat(fd))==_file(os.stat(tmp,dir_fd=h.parent,follow_symlinks=False)))
   _rename_excl(e,h.parent,tmp,h.name);os.fsync(h.parent)
   read,proof=_read(e,path,0o600,80);e.need(read==raw and proof[1][:-1]==pin[:-1]);lease();_verify(e,h,parent)
  finally:
   if fd is not None:
    cleanup=_id(os.fstat(fd));os.close(fd)
   else:cleanup=None
   # Remove only our un-published temporary inode; never touch a visible record.
   if cleanup is not None:
    try:
     if _id(os.stat(tmp,dir_fd=h.parent,follow_symlinks=False))==cleanup:os.unlink(tmp,dir_fd=h.parent)
    except FileNotFoundError:pass
 e._e33_durability[path]=proof

_lease=contextlib.contextmanager(_lease)

class FixedPath:
 """Held nofollow traversal for this fixed subject's root/service-owned data.
 Parent timestamps may change through our fixed publications; identity/custody
 and every traversed pathname remain pinned. Leaf content has separate proofs.
 """
 def __init__(self,e,path):self.e=e;self.path=str(path);self.fds=[];self.trace=[]
 def __enter__(self):
  e=self.e;parts=os.path.relpath(self.path,_FS_ROOT).split(os.sep)
  e.need(os.path.normpath(self.path)==self.path and os.path.commonpath((_FS_ROOT,self.path))==_FS_ROOT)
  e.need(all(p not in ('','..','.') for p in parts))
  try:
   parent=os.open(_FS_ROOT,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW);self.fds.append(parent)
   self.root_pin=_id(os.fstat(parent));current=_FS_ROOT
   for name in parts[:-1]:
    current=os.path.join(current,name);s=os.stat(name,dir_fd=parent,follow_symlinks=False)
    if current==E33['migration_root']:e.need([s.st_dev,s.st_ino]==E33['migration_inode'] and (s.st_uid,s.st_gid,stat.S_IMODE(s.st_mode))==(0,0,0o700))
    if current==str(Path(E33['trees']['publicArtifacts']['root']).parent):e.need([s.st_dev,s.st_ino]==E33['artifacts_parent_inode'] and (s.st_uid,s.st_gid,stat.S_IMODE(s.st_mode))==(0,0,0o755))
    e.need(stat.S_ISDIR(s.st_mode) and s.st_uid in (0,502,505))
    e.need(not s.st_mode&0o022 or (current==e.ds.STATE_ROOT and (s.st_uid,s.st_gid,stat.S_IMODE(s.st_mode))==(0,80,0o770)))
    fd=os.open(name,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=parent);self.fds.append(fd)
    e.need(_id(s)==_id(os.fstat(fd)));self.trace.append((parent,name,fd,_id(s)));parent=fd
   self.parent,self.name=parent,parts[-1];self.verify();return self
  except BaseException:self.close();raise
 def verify(self):
  self.e.need(self.root_pin==_id(os.fstat(self.fds[0])))
  for p,n,fd,pin in self.trace:self.e.need(pin==_id(os.fstat(fd))==_id(os.stat(n,dir_fd=p,follow_symlinks=False)))
 def close(self):
  for fd in reversed(self.fds):os.close(fd)
  self.fds=[]
 def __exit__(self,t,v,b):
  try:
   if t is None:self.verify()
  finally:self.close()

def _exists(e,path):
 with FixedPath(e,path) as h:
  try:os.stat(h.name,dir_fd=h.parent,follow_symlinks=False);return True
  except FileNotFoundError:return False

def _absent(e,path):e.need(not _exists(e,path))

def _blob(e,path,want=None,limit=33554432,sync=False):
 with FixedPath(e,path) as h:
  before=os.stat(h.name,dir_fd=h.parent,follow_symlinks=False)
  e.need(stat.S_ISREG(before.st_mode) and before.st_nlink==1 and 0<=before.st_size<=limit)
  fd=os.open(h.name,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=h.parent)
  try:
   pin=_file(before);e.need(pin==_file(os.fstat(fd)));chunks=[];total=0
   while True:
    part=os.read(fd,min(65536,limit+1-total))
    if not part:break
    chunks.append(part);total+=len(part);e.need(total<=limit)
   raw=b''.join(chunks);e.need(len(raw)==before.st_size)
   if want is not None:
    if 'stable_pin' in want:e.need(pin==want['stable_pin'])
    e.need(_sha(raw)==want['sha256'])
    for key,got in (('uid',before.st_uid),('gid',before.st_gid),('mode',stat.S_IMODE(before.st_mode)),('bytes',len(raw)),('dev',before.st_dev),('ino',before.st_ino)):
     if key in want:e.need(got==want[key])
   if sync:
    e.need(want is not None);os.fsync(fd);os.fsync(h.parent);os.lseek(fd,0,os.SEEK_SET);e.need(os.read(fd,limit+1)==raw)
   e.need(pin==_file(os.fstat(fd))==_file(os.stat(h.name,dir_fd=h.parent,follow_symlinks=False)));h.verify()
   return raw,pin
  finally:os.close(fd)

def _walk(e,path,file_hashes=None,known=None):
 """Original treeDigest grammar; optional allowlist never reads outscope bodies."""
 entries=[];leaf_pins={}
 def visit(parent,name,rel):
  s=os.stat(name,dir_fd=parent,follow_symlinks=False);pin=_file(s);mode=stat.S_IMODE(s.st_mode);meta=[s.st_uid,s.st_gid,mode]
  if stat.S_ISLNK(s.st_mode):entries.append([rel,'link']+meta+[os.readlink(name,dir_fd=parent)])
  elif stat.S_ISREG(s.st_mode):
   e.need(s.st_nlink==1);key=rel[2:] if rel.startswith('./') else rel
   if known is not None:
    e.need(rel in known and pin==known[rel]);value='STABLE_KNOWN_CONTENT'
   elif file_hashes is None or key in file_hashes:
    fd=os.open(name,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=parent)
    try:
     e.need(pin==_file(os.fstat(fd)));digest=hashlib.sha256()
     while True:
      data=os.read(fd,1048576)
      if not data:break
      digest.update(data)
     e.need(pin==_file(os.fstat(fd)));value=digest.hexdigest()
    finally:os.close(fd)
    if file_hashes is not None:e.need(value==file_hashes[key])
   else:value=['UNREAD_OUT_OF_SCOPE',s.st_size]
   entries.append([rel,'file']+meta+[value])
  elif stat.S_ISDIR(s.st_mode):
   fd=os.open(name,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=parent)
   try:
    e.need(pin==_file(os.fstat(fd)));entries.append([rel,'dir']+meta);names=sorted(os.listdir(fd),key=lambda x:x.encode('utf-16-be'))
    for child in names:visit(fd,child,rel+'/'+child)
    e.need(names==sorted(os.listdir(fd),key=lambda x:x.encode('utf-16-be')) and pin==_file(os.fstat(fd)))
   finally:os.close(fd)
  else:e.need(False)
  e.need(pin==_file(os.stat(name,dir_fd=parent,follow_symlinks=False)));leaf_pins[rel]=pin
 with FixedPath(e,path) as h:visit(h.parent,h.name,'.');h.verify()
 if known is not None:e.need(leaf_pins==known)
 return _sha(json.dumps(entries,ensure_ascii=False,separators=(',',':')).encode()),leaf_pins

def _tree(e,key,path=None,fast=False):
 row=E33['trees'][key];actual=path or row['root']
 if 'original_inode' in row:
  with FixedPath(e,actual) as h:
   s=os.stat(h.name,dir_fd=h.parent,follow_symlinks=False);e.need([s.st_dev,s.st_ino]==row['original_inode'])
 known=e._e33_history_pins.get(key) if fast else None
 if fast:e.need(known is not None)
 digest,pins=_walk(e,actual,known=known);e.need(len(pins)==row['entries'] and (fast or digest==row['sha256']))
 if not fast and actual==E33['histories'].get(key):e._e33_history_pins[key]=pins
 return pins

def _record(e,op,slot):
 path=e.disposal_paths(op)[slot=='terminal']
 if not _probe(e,path):return None
 raw,_=_read(e,path,0o600,80);expected=_auth() if slot=='auth' else _terminal()
 e.need(raw==_canonical(expected) and _strict(raw)==expected);return expected

def _auth():
 return dict(kind='DS_B7_PRESEALED_DISPOSAL_AUTH_V1',operation_id=E33['operation_id'],tx_id=E33['tx_id'],execution_receipt_sha256=E33['execution_record_sha256'],execution_policy_sha256=E33['execution']['execution_policy_sha256'],registration_receipt_sha256=E33['registration_receipt_sha256'],holder_binding=E33['holder']['binding'],evidence=dict(holder_sha256=E33['holder_sha256'],batch_sha256=E33['batch_sha256'],journal_sha256=E33['journal_sha256'],trees={k:v['sha256'] for k,v in E33['trees'].items()},histories=E33['histories'],disposition='ORIGINAL_SIX_INVERSE_FIXED_HISTORY_NATIVE_UNKNOWN'))

def _terminal():
 return dict(kind='DS_B7_PRESEALED_DISPOSAL_TERMINAL_V1',operation_id=E33['operation_id'],tx_id=E33['tx_id'],authorization_sha256=_sha(_canonical(_auth())),disposal=dict(native_state='DISPOSED_PRESEALED',installed=False),pre=dict(execution_receipt_sha256=E33['execution_record_sha256']),post=dict(execution_receipt_sha256=E33['execution_record_sha256']))

def _registration(e,op):
 e.need(op==E33['operation_id']);raw,_=_read(e,e.ds.receipt_path(op),0o644,80)
 e.need(list(_[1][:2])==E33['original_leaf_inodes']['registration'] and _sha(raw)==E33['registration_receipt_sha256'] and _strict(raw)==E33['registration']);return raw,E33['registration']

def _execution(e,op,reg):
 raw,_=_read(e,e.path(op),0o600,80);e.need(list(_[1][:2])==E33['original_leaf_inodes']['execution'] and _sha(raw)==E33['execution_record_sha256'] and _strict(raw)==E33['execution']);return E33['execution']

def _snapshot(e):
 root=E33['snapshot_root']
 with FixedPath(e,root) as h:
  s=os.stat(h.name,dir_fd=h.parent,follow_symlinks=False);e.need((s.st_uid,s.st_gid,stat.S_IMODE(s.st_mode))==(0,0,0o700) and stat.S_ISDIR(s.st_mode))
  fd=os.open(h.name,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=h.parent)
  try:
   pin=_file(s);e.need(sorted(os.listdir(fd))==sorted(E33['snapshot_files']))
   for name,row in E33['snapshot_files'].items():_blob(e,str(Path(root)/name),dict(sha256=row['sha256'],bytes=row['bytes'],uid=0,gid=0,mode=0o600),max(row['bytes'],1))
   e.need(pin==_file(os.fstat(fd))==_file(os.stat(h.name,dir_fd=h.parent,follow_symlinks=False)))
  finally:os.close(fd)

def _batch(e,history=False):
 p=E33['histories']['batch'] if history else E33['migration_root']+'/b7-six-target-batch.json'
 raw,pin=_blob(e,p,dict(sha256=E33['batch_sha256'],bytes=E33['batch_bytes'],uid=0,gid=0,mode=0o600),E33['batch_bytes']);b=_strict(raw)
 if not history:e.need(list(pin[:2])==E33['original_leaf_inodes']['batch'])
 e.need(set(b)=={'kind','authorizedBy','phase','journalFile','journalSha256','targets','preimageStore'} and b['kind']=='B7_SIX_TARGET_BATCH_V1' and b['authorizedBy']=='B7_SIX_FIXED_SCOPE_USER_AUTHORIZED_20261007' and b['phase']=='COMPLETE' and b['journalFile']=='.b7-six-journal.jsonl' and b['journalSha256']==E33['journal_sha256'] and b['preimageStore']==E33['declared_preimage_store'])
 e.need([t['id'] for t in b['targets']]==list(E33['homes']))
 for t in b['targets']:
  e.need(t['prestate']=='PARTIAL' and t['pending'] is False and len(t['files'])==E33['homes'][t['id']]['recorded_files'])
  e.need(len(t['preimages'])==3 and len(t['created'])==11)
  for rel in list(t['files'])+t['created']+[r['rel'] for r in t['preimages']]:e.need(type(rel)is str and rel and not rel.startswith('/') and all(n not in ('','..','.') for n in rel.split('/')))
 if history:e._e33_batch_pin=pin
 return raw,b

def _six(e,b,post=False):
 verified={}
 for t in b['targets']:
  row=E33['homes'][t['id']];home=row['root'];hashes=dict(t['files'])
  if post:
   hashes={k:v for k,v in hashes.items() if not(k=='profiles/node_modules/dsh-codex' or k.startswith('profiles/node_modules/dsh-codex/'))}
  digest,pins=_walk(e,home,hashes);e.need(digest==row['post_digest' if post else 'pre_digest']);verified[t['id']]=pins
  for r in t['preimages']:
   e.need(r['storeFile']==t['id']+'__'+r['rel'].replace('/','__'))
   want=dict(sha256=r['sha256'],bytes=r['bytes']);_blob(e,E33['trees']['preimageStore']['root']+'/'+r['storeFile'],want)
   if post:_blob(e,home+'/'+r['rel'],want)
  for rel,target in row['links'].items():
   p=home+'/'+rel
   if post:_absent(e,p)
   else:
    with FixedPath(e,p) as h:
     s=os.stat(h.name,dir_fd=h.parent,follow_symlinks=False);e.need(stat.S_ISLNK(s.st_mode) and s.st_nlink==1 and os.readlink(h.name,dir_fd=h.parent)==target)
  if post:_absent(e,home+'/profiles/node_modules/dsh-codex')
 if post:_absent(e,E33['migration_root']+'/b7-six-target-batch.json')
 return verified

def _runtime(e):
 for r in E33['checkpoint']['liveDeltas']:_blob(e,r['path'],r,max(1,r['bytes']))
 for r in E33['public_files']:_blob(e,r['path'],r,max(1,r['bytes']))
 for r in E33['public_aliases']:
  with FixedPath(e,r['path']) as h:
   s=os.stat(h.name,dir_fd=h.parent,follow_symlinks=False);e.need(stat.S_ISLNK(s.st_mode) and (s.st_uid,s.st_gid,stat.S_IMODE(s.st_mode),s.st_nlink)==(r['uid'],r['gid'],r['mode'],1) and os.readlink(h.name,dir_fd=h.parent)==r['target'])
 _absent(e,E33['runtime_current'])
 health=E33['checkpoint']['health'];e.need(health['host']=='127.0.0.1' and health['port']==8790 and health['path']=='/health')
 c=http.client.HTTPConnection(health['host'],health['port'],timeout=5)
 try:
  c.request('GET',health['path']);r=c.getresponse();raw=r.read(65537);e.need(r.status==200 and len(raw)<=65536);data=_strict(raw);e.need(data.get('ok')is True and data.get('deliverReady')is True)
 finally:c.close()

def _scene(e,b,post=False):
 e.need(e.active is None,'MUTATION_BUSY','admission');_snapshot(e)
 for p in E33['native_absences']:_absent(e,p)
 _blob(e,E33['migration_root']+'/.b7-six-journal.jsonl',dict(sha256=E33['journal_sha256'],uid=0,gid=0,mode=0o600,dev=E33['original_leaf_inodes']['journal'][0],ino=E33['original_leaf_inodes']['journal'][1]))
 for key in ('generation','preimageDir','preimageStore','shadow'):_tree(e,key)
 _six(e,b,post);_runtime(e)

def _placement(e,completed=False):
 for key in ('seed','publicArtifacts','codeinput'):
  src=E33['migration_root']+'/b7-preparation-input.json' if key=='seed' else E33['trees'][key]['root'];dst=E33['histories'][key]
  a,z=_exists(e,src),_exists(e,dst);e.need(a!=z)
  if completed:e.need(z)
  path=src if a else dst
  if key=='seed':_blob(e,path,dict(sha256=E33['seed_sha256'],uid=0,gid=0,mode=0o600,bytes=5087,dev=E33['original_leaf_inodes']['seed'][0],ino=E33['original_leaf_inodes']['seed'][1]))
  else:_tree(e,key,path)

def _copy_archive(e,raw,recheck,lease):
 path=E33['histories']['batch'];want=dict(sha256=E33['batch_sha256'],bytes=E33['batch_bytes'],uid=0,gid=0,mode=0o600)
 if _exists(e,path):_blob(e,path,want,E33['batch_bytes'],sync=True);return
 with FixedPath(e,path) as h:
  recheck();lease();_absent(e,path);fd=os.open(h.name,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600,dir_fd=h.parent)
  try:
   offset=0
   while offset<len(raw):n=os.write(fd,raw[offset:]);e.need(n>0);offset+=n
   e.need((os.fstat(fd).st_uid,os.fstat(fd).st_gid,stat.S_IMODE(os.fstat(fd).st_mode))==(0,0,0o600));os.fsync(fd);h.verify();os.fsync(h.parent)
  finally:os.close(fd)
 _blob(e,path,want,E33['batch_bytes']);recheck();lease()

def _sync_post(e,b):
 verified=_six(e,b,True)
 directories=set()
 for t in b['targets']:
  home=E33['homes'][t['id']]['root'];directories.add(home)
  for r in t['preimages']:
   p=home+'/'+r['rel'];_blob(e,p,dict(sha256=r['sha256'],bytes=r['bytes'],stable_pin=verified[t['id']]['./'+r['rel']]),sync=True);directories.add(str(Path(p).parent))
  for rel in t['created']:directories.add(str(Path(home+'/'+rel).parent))
  directories.add(home+'/profiles/node_modules')
 directories.add(E33['migration_root'])
 for p in sorted(directories):
  with FixedPath(e,p) as h:
   fd=os.open(h.name,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=h.parent)
   try:os.fsync(fd);h.verify()
   finally:os.close(fd)
 _six(e,b,True)

def _run_child(e,lease_fd,mode):
 e.need(mode in ('guard','inverse') and lease_fd>=64)
 argv=['/usr/bin/python3','-I','-c',CHILD_SOURCE,str(lease_fd),mode]
 child=None
 try:
  child=subprocess.Popen(argv,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env={'PATH':'/usr/bin:/bin:/usr/sbin:/sbin','LC_ALL':'C'},cwd='/',close_fds=True,pass_fds=(lease_fd,),start_new_session=True)
  out,err=child.communicate(timeout=20 if mode=='guard' else 180)
  e.need(len(out)<=65536 and len(err)<=65536)
  e._e33_child_receipts.append(dict(mode=mode,returncode=child.returncode,stdout_sha256=_sha(out),stderr_sha256=_sha(err),stdout_bytes=len(out),stderr_bytes=len(err),child_source_sha256=_sha(CHILD_SOURCE.encode())))
  e.need(child.returncode==0,'NONTERMINAL','observe')
  if mode=='guard':e.need(out.strip()==b'B7_MUTEX_INHERITED')
  else:
   prefix=('B7_SIX_TARGET_RECOVERED '+E33['tx_id']+' ').encode();e.need(out.startswith(prefix))
   e.need(_strict(out[len(prefix):])==list(E33['homes']))
 except BaseException:
  if child is not None:
   try:os.killpg(child.pid,signal.SIGKILL)
   except ProcessLookupError:pass
   child.communicate(timeout=10)
  raise

def _quiescent(e):
 # Fixed metadata-only process view. No raw commands are returned/logged.
 r=subprocess.run(['/bin/ps','-axo','pid=,ppid=,command='],stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env={'PATH':'/usr/bin:/bin','LC_ALL':'C'},cwd='/',timeout=10,check=False)
 e.need(r.returncode==0 and len(r.stdout)<=1048576 and len(r.stderr)<=65536)
 targets=[v['path'] for k,v in E33['tools'].items() if k in ('outerPath','carrierPath','preparationToolPath')]
 for line in r.stdout.decode('utf-8','strict').splitlines():
  fields=line.strip().split(None,2)
  e.need(len(fields)==3 and fields[0].isdigit() and fields[1].isdigit())
  if int(fields[0])!=os.getpid():e.need(not any(p in fields[2] for p in targets) and E33['tx_id'] not in fields[2],'MUTATION_BUSY','admission')
 locks=[str(Path(e.ds.STATE_ROOT)/'mutation.lock')]
 if _exists(e,E33['lock_root']):locks.insert(0,E33['lock_root']+'/holder')
 r=subprocess.run(['/usr/sbin/lsof','-nP','-Fpf','--']+locks,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env={'PATH':'/usr/bin:/bin:/usr/sbin:/sbin','LC_ALL':'C'},cwd='/',timeout=10,check=False)
 e.need(r.returncode in (0,1) and not r.stderr and len(r.stdout)<=65536)
 if r.returncode==1 and not r.stdout:return
 e.need(bool(r.stdout));owner=None
 for line in r.stdout.decode('ascii','strict').splitlines():
  e.need(len(line)>1 and line[0] in ('p','f'))
  if line[0]=='p':e.need(line[1:].isdigit());owner=int(line[1:]);e.need(owner==os.getpid(),'MUTATION_BUSY','admission')
  else:e.need(owner is not None and line[1:].rstrip('rwu').isdigit())

class NativeLease:
 def __init__(self,e):self.e=e;self.fd=None;self.tools={};self.released=False
 def __enter__(self):
  e=self.e;self.lock=FixedPath(e,E33['lock_root']);self.lock.__enter__()
  try:
   self.dir=os.open(self.lock.name,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=self.lock.parent)
   s=os.fstat(self.dir);e.need((s.st_uid,s.st_gid,stat.S_IMODE(s.st_mode))==(0,80,0o700));self.dir_pin=_id(s)
   low=os.open('holder',os.O_RDWR|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=self.dir)
   try:self.fd=fcntl.fcntl(low,fcntl.F_DUPFD_CLOEXEC,64)
   finally:os.close(low)
   fcntl.flock(self.fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
   history=_exists(e,E33['histories']['codeinput'])
   for key,row in E33['tools'].items():
    path=E33['histories']['codeinput']+row['path'][len(E33['trees']['codeinput']['root']):] if history else row['path']
    with FixedPath(e,path) as h:
     fd=os.open(h.name,os.O_RDONLY|os.O_NOFOLLOW,dir_fd=h.parent)
     try:self.tools[key]=(fd,_file(os.fstat(fd)));self.tool(key,history)
     except BaseException:os.close(fd);self.tools.pop(key,None);raise
   self.verify(history);return self
  except BaseException:self.__exit__(*sys.exc_info());raise
 def tool(self,key,history):
  e=self.e;fd,pin=self.tools[key];row=E33['tools'][key]
  path=row['path']
  if history:path=E33['histories']['codeinput']+path[len(E33['trees']['codeinput']['root']):]
  with FixedPath(e,path) as h:
   s=os.fstat(fd);e.need(pin==_file(s)==_file(os.stat(h.name,dir_fd=h.parent,follow_symlinks=False)))
   e.need(stat.S_ISREG(s.st_mode) and s.st_nlink==1 and [s.st_dev,s.st_ino]==[row['dev'],row['ino']] and (s.st_uid,s.st_gid,stat.S_IMODE(s.st_mode),s.st_size)==(row['uid'],row['gid'],row['mode'],row['bytes']))
   e.need(_sha(os.pread(fd,s.st_size+1,0))==row['sha256'])
 def verify(self,history=False):
  e=self.e;self.lock.verify();e.need(self.dir_pin==_id(os.fstat(self.dir))==_id(os.stat(self.lock.name,dir_fd=self.lock.parent,follow_symlinks=False)))
  e.need(sorted(os.listdir(self.dir))==['holder']);s=os.fstat(self.fd)
  e.need(stat.S_ISREG(s.st_mode) and (s.st_uid,s.st_gid,stat.S_IMODE(s.st_mode),s.st_nlink)==(0,80,0o600,1) and [s.st_dev,s.st_ino]==E33['holder_inode'])
  e.need(_file(s)==_file(os.stat('holder',dir_fd=self.dir,follow_symlinks=False)))
  raw=os.pread(self.fd,65537,0);e.need(len(raw)==s.st_size<=65536 and _sha(raw)==E33['holder_sha256'] and _strict(raw)==E33['holder'])
  other=os.open('holder',os.O_RDWR|os.O_NOFOLLOW,dir_fd=self.dir)
  try:
   try:fcntl.flock(other,fcntl.LOCK_EX|fcntl.LOCK_NB)
   except BlockingIOError:pass
   else:e.need(False,'MUTATION_BUSY','admission')
   fcntl.flock(self.fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
  finally:os.close(other)
  for key in self.tools:self.tool(key,history)
 def guard(self):self.verify(False);_run_child(self.e,self.fd,'guard');self.verify(False)
 def release(self):
  self.verify(True);e=self.e
  os.unlink('holder',dir_fd=self.dir);e.need(not os.listdir(self.dir));os.rmdir(self.lock.name,dir_fd=self.lock.parent);os.fsync(self.lock.parent);_absent(e,E33['lock_root']);self.released=True
 def __exit__(self,*args):
  for fd,pin in self.tools.values():os.close(fd)
  self.tools={}
  if self.fd is not None:os.close(self.fd);self.fd=None
  if hasattr(self,'dir'):os.close(self.dir)
  if hasattr(self,'lock'):self.lock.close()

def _preserve(e,b,native,lease):
 for key in ('seed','publicArtifacts','codeinput'):
  src=E33['migration_root']+'/b7-preparation-input.json' if key=='seed' else E33['trees'][key]['root'];dst=E33['histories'][key]
  _scene(e,b,True);_placement(e);lease()
  if _exists(e,src):
   native.guard()
   with FixedPath(e,src) as h:
    e.need(Path(src).parent==Path(dst).parent);before=_file(os.stat(h.name,dir_fd=h.parent,follow_symlinks=False))
    _absent(e,dst);native.verify(False);lease();_rename_excl(e,h.parent,h.name,Path(dst).name);os.fsync(h.parent)
    after=os.stat(Path(dst).name,dir_fd=h.parent,follow_symlinks=False)
    e.need(_id(after)==before[:5] and after.st_ino==before[1]);h.verify()
  else:
   with FixedPath(e,dst) as h:os.fsync(h.parent)
  _placement(e);lease()
 _placement(e,True);_scene(e,b,True);native.verify(True)

def _history(e,fast=False):
 _snapshot(e);_registration(e,E33['operation_id']);_execution(e,E33['operation_id'],E33['registration']);a=_record(e,E33['operation_id'],'auth');t=_record(e,E33['operation_id'],'terminal');e.need(a is not None and t is not None)
 if fast:
  e.need(e._e33_batch_pin is not None)
  with FixedPath(e,E33['histories']['batch']) as h:
   fd=os.open(h.name,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=h.parent)
   try:e.need(e._e33_batch_pin==_file(os.fstat(fd))==_file(os.stat(h.name,dir_fd=h.parent,follow_symlinks=False)));h.verify()
   finally:os.close(fd)
 else:_batch(e,True)
 # Only immutable original histories: never inspect a successor's mutable scene.
 for key in ('codeinput','publicArtifacts'):_tree(e,key,E33['histories'][key],fast=fast)
 _blob(e,E33['histories']['seed'],dict(sha256=E33['seed_sha256'],bytes=5087,uid=0,gid=0,mode=0o600,dev=E33['original_leaf_inodes']['seed'][0],ino=E33['original_leaf_inodes']['seed'][1]))
 for key,row in E33['tools'].items():
  path=E33['histories']['codeinput']+row['path'][len(E33['trees']['codeinput']['root']):];_blob(e,path,row,max(1,row['bytes']))
 return a,t

def _establish_record(e,path,expected,recheck,lease):
 recheck();raw,pin=_read(e,path,0o600,80);e.need(raw==_canonical(expected))
 if e._e33_durability.get(path)==pin:return
 lease();raw,pin=_read(e,path,0o600,80,sync=True,expected_canonical=_canonical(expected));recheck();lease();e._e33_durability[path]=pin

def e33_dispose(e,r,peer):
 op=r['operation_id']
 with _lease(e) as lease:
  with e.guard:
   e.identity(op,peer);e.need(e.active is None,'MUTATION_BUSY','admission');_snapshot(e)
   a=_record(e,op,'auth');t=_record(e,op,'terminal');e.need(t is None or a is not None)
   ap,tp=e.disposal_paths(op)
   if t is not None:
    _history(e)
    def history():_history(e);return True
    _establish_record(e,ap,a,history,lease);_establish_record(e,tp,t,history,lease)
    return e.view(op,*e.identity(op,peer),E33['execution'])
   _quiescent(e)
   original=_exists(e,E33['migration_root']+'/b7-six-target-batch.json')
   if a is None:e.need(not _exists(e,E33['histories']['batch']),'NONTERMINAL','observe')
   if original and a is not None:e.need(e._e33_inverse_not_begun,'NONTERMINAL','observe')
   raw,b=_batch(e,not original);_scene(e,b,not original);_placement(e)
   if original and _exists(e,E33['histories']['batch']):_batch(e,True)
   if original:
    for key in ('seed','publicArtifacts','codeinput'):e.need(not _exists(e,E33['histories'][key]))
   if not _exists(e,E33['lock_root']):
    e.need(not original and a is not None);_placement(e,True);_sync_post(e,b)
   else:
    with NativeLease(e) as native:
     def fresh():
      lease();e.identity(op,peer);_execution(e,op,E33['registration']);_scene(e,b,not original);_placement(e);native.verify(_exists(e,E33['histories']['codeinput']));return True
     fresh()
     if a is None:
      e.need(original and e._e33_inverse_not_begun is not False);native.guard();e._e33_inverse_not_begun=True;_publish(e,ap,_canonical(_auth()),fresh,lease);a=_auth()
     _establish_record(e,ap,a,fresh,lease)
     if original:
      _copy_archive(e,raw,fresh,lease);fresh();native.guard();e.need(e._e33_inverse_not_begun);e._e33_inverse_not_begun=False;_run_child(e,native.fd,'inverse')
      # From this point the immutable batch archive owns the completed-state proof.
      original=False
     _scene(e,b,True);_sync_post(e,b);fresh();_preserve(e,b,native,lease);fresh();native.verify(True);native.release()
   # Native namespace retired normally; no old-path guard or business runs here.
   def final():
    lease();e.identity(op,peer);_execution(e,op,E33['registration']);_scene(e,b,True);_placement(e,True);_absent(e,E33['lock_root']);_batch(e,True);return True
   final();_publish(e,tp,_canonical(_terminal()),final,lease);_establish_record(e,tp,_terminal(),final,lease)
   _history(e);return e.view(op,*e.identity(op,peer),E33['execution'])

def install_e33_recovery(ds,e):
 if getattr(e,'_e33_installed',False):raise ValueError('E33_ALREADY_INSTALLED')
 oldid,oldload,oldview,olddispose,oldoverlay,oldhandle=e.identity,e.load,e.view,e.disposal_dispose,e.disposal_view_overlay,ds.handle
 local=threading.local();e._e33_durability={};e._e33_child_receipts=[];e._e33_history_pins={};e._e33_batch_pin=None;e._e33_inverse_not_begun=None
 def allowed(op):return op==E33['operation_id'] and getattr(local,'allowed',False)
 def identity(op,peer):
  if not allowed(op):return oldid(op,peer)
  e.need(type(peer)is int and peer==502,'PEER_UNAUTHORIZED','authorize');_registration(e,op)
  e.need(e.policy['packets'].get(E33['packet_id'])==ORIGINAL_ROW and ORIGINAL_ROW.get('enabled')is True,'PROFILE_NOT_AUTHORIZED','authorize')
  return E33['registration'],ORIGINAL_ROW
 def load(op,reg):return _execution(e,op,reg) if allowed(op) else oldload(op,reg)
 def overlay(op):
  if not allowed(op):return oldoverlay(op)
  a=_record(e,op,'auth');t=_record(e,op,'terminal')
  if a is None or t is None:return None
  for path in e.disposal_paths(op):
   raw,pin=_read(e,path,0o600,80)
   if e._e33_durability.get(path)!=pin:return None
  _history(e,fast=True)
  return dict(native_state='DISPOSED_PRESEALED',installed=False,authorization_sha256=t['authorization_sha256'],execution_receipt_sha256=E33['execution_record_sha256'])
 def dispose(r,peer):return e33_dispose(e,r,peer) if allowed(r.get('operation_id')) else olddispose(r,peer)
 def handle(raw,peer=None):
  try:r=ds._observation_json(raw,'request') if len(raw)<=ds.REQUEST_LIMIT else {}
  except ds.ObservationFailure:return oldhandle(raw,peer=peer)
  targeted=type(r)is dict and r.get('operation_id')==E33['operation_id'] and r.get('action') in ('B7_PACKET_DISPOSAL_V3','DS_B7_EXECUTION_STATUS_V2','DS_B7_OWNER_OUTPUT_V2')
  previous=getattr(local,'allowed',False);local.allowed=targeted
  try:return oldhandle(raw,peer=peer)
  finally:local.allowed=previous
 e.identity=identity;e.load=load;e.disposal_view_overlay=overlay;e.disposal_dispose=dispose;ds.handle=handle;e._e33_installed=True;return e

E33["homes"] = {'agt_data-engineer-agent': {'root': '/Users/authsvc/.agent-core/homes/agt_data-engineer-agent', 'recorded_files': 21739, 'links': {'profiles/node_modules/.bin/dsh-openai-codex': '../dsh-codex/lib/bin.js', 'profiles/node_modules/@agent-core/bundle-demo': '/usr/local/libexec/agent-core/app/bundle-demo', 'profiles/node_modules/@agent-core/owner-guard': '/usr/local/libexec/agent-core/app/packages/owner-guard', 'profiles/node_modules/@agent-core/demo-server': '/usr/local/libexec/agent-core/app/packages/demo-server', 'profiles/node_modules/@agent-core/bundle-memory': '/usr/local/libexec/agent-core/app/bundle-memory', 'profiles/node_modules/@agent-core/agent-memory': '/usr/local/libexec/agent-core/app/packages/agent-memory', 'profiles/node_modules/@agent-core/bundle-agent-switch': '/usr/local/libexec/agent-core/app/bundle-agent-switch', 'profiles/node_modules/@agent-core/agent-switch': '/usr/local/libexec/agent-core/app/packages/agent-switch', 'profiles/node_modules/@agent-core/workspace-bootstrap': '/usr/local/libexec/agent-core/app/packages/workspace-bootstrap', 'profiles/node_modules/@agent-core/bundle-broker': '/usr/local/libexec/agent-core/app/bundle-broker', 'profiles/node_modules/@agent-core/broker': '/usr/local/libexec/agent-core/app/packages/broker'}, 'pre_digest': 'f5593b0fa7fb3d1e20930ffbd4addf83867c11b667278850ddf17d5a50764320', 'post_digest': '42c95440ff0d969b99a12d3e0b8f20178671e1dd4470b91adc6aa689c470bfaa'}, 'agt_family-insurance-manager-agent': {'root': '/Users/authsvc/.agent-core/homes/agt_family-insurance-manager-agent', 'recorded_files': 21739, 'links': {'profiles/node_modules/.bin/dsh-openai-codex': '../dsh-codex/lib/bin.js', 'profiles/node_modules/@agent-core/bundle-demo': '/usr/local/libexec/agent-core/app/bundle-demo', 'profiles/node_modules/@agent-core/owner-guard': '/usr/local/libexec/agent-core/app/packages/owner-guard', 'profiles/node_modules/@agent-core/demo-server': '/usr/local/libexec/agent-core/app/packages/demo-server', 'profiles/node_modules/@agent-core/bundle-memory': '/usr/local/libexec/agent-core/app/bundle-memory', 'profiles/node_modules/@agent-core/agent-memory': '/usr/local/libexec/agent-core/app/packages/agent-memory', 'profiles/node_modules/@agent-core/bundle-agent-switch': '/usr/local/libexec/agent-core/app/bundle-agent-switch', 'profiles/node_modules/@agent-core/agent-switch': '/usr/local/libexec/agent-core/app/packages/agent-switch', 'profiles/node_modules/@agent-core/workspace-bootstrap': '/usr/local/libexec/agent-core/app/packages/workspace-bootstrap', 'profiles/node_modules/@agent-core/bundle-broker': '/usr/local/libexec/agent-core/app/bundle-broker', 'profiles/node_modules/@agent-core/broker': '/usr/local/libexec/agent-core/app/packages/broker'}, 'pre_digest': 'f5593b0fa7fb3d1e20930ffbd4addf83867c11b667278850ddf17d5a50764320', 'post_digest': '42c95440ff0d969b99a12d3e0b8f20178671e1dd4470b91adc6aa689c470bfaa'}, 'agt_investment-manager-agent': {'root': '/Users/authsvc/.agent-core/homes/agt_investment-manager-agent', 'recorded_files': 21739, 'links': {'profiles/node_modules/.bin/dsh-openai-codex': '../dsh-codex/lib/bin.js', 'profiles/node_modules/@agent-core/bundle-demo': '/usr/local/libexec/agent-core/app/bundle-demo', 'profiles/node_modules/@agent-core/owner-guard': '/usr/local/libexec/agent-core/app/packages/owner-guard', 'profiles/node_modules/@agent-core/demo-server': '/usr/local/libexec/agent-core/app/packages/demo-server', 'profiles/node_modules/@agent-core/bundle-memory': '/usr/local/libexec/agent-core/app/bundle-memory', 'profiles/node_modules/@agent-core/agent-memory': '/usr/local/libexec/agent-core/app/packages/agent-memory', 'profiles/node_modules/@agent-core/bundle-agent-switch': '/usr/local/libexec/agent-core/app/bundle-agent-switch', 'profiles/node_modules/@agent-core/agent-switch': '/usr/local/libexec/agent-core/app/packages/agent-switch', 'profiles/node_modules/@agent-core/workspace-bootstrap': '/usr/local/libexec/agent-core/app/packages/workspace-bootstrap', 'profiles/node_modules/@agent-core/bundle-broker': '/usr/local/libexec/agent-core/app/bundle-broker', 'profiles/node_modules/@agent-core/broker': '/usr/local/libexec/agent-core/app/packages/broker'}, 'pre_digest': 'f5593b0fa7fb3d1e20930ffbd4addf83867c11b667278850ddf17d5a50764320', 'post_digest': '42c95440ff0d969b99a12d3e0b8f20178671e1dd4470b91adc6aa689c470bfaa'}, 'agt_lw-lifecycle-canary': {'root': '/Users/authsvc/.agent-core/homes/agt_lw-lifecycle-canary', 'recorded_files': 21739, 'links': {'profiles/node_modules/.bin/dsh-openai-codex': '../dsh-codex/lib/bin.js', 'profiles/node_modules/@agent-core/bundle-demo': '/usr/local/libexec/agent-core/app/bundle-demo', 'profiles/node_modules/@agent-core/owner-guard': '/usr/local/libexec/agent-core/app/packages/owner-guard', 'profiles/node_modules/@agent-core/demo-server': '/usr/local/libexec/agent-core/app/packages/demo-server', 'profiles/node_modules/@agent-core/bundle-memory': '/usr/local/libexec/agent-core/app/bundle-memory', 'profiles/node_modules/@agent-core/agent-memory': '/usr/local/libexec/agent-core/app/packages/agent-memory', 'profiles/node_modules/@agent-core/bundle-agent-switch': '/usr/local/libexec/agent-core/app/bundle-agent-switch', 'profiles/node_modules/@agent-core/agent-switch': '/usr/local/libexec/agent-core/app/packages/agent-switch', 'profiles/node_modules/@agent-core/workspace-bootstrap': '/usr/local/libexec/agent-core/app/packages/workspace-bootstrap', 'profiles/node_modules/@agent-core/bundle-broker': '/usr/local/libexec/agent-core/app/bundle-broker', 'profiles/node_modules/@agent-core/broker': '/usr/local/libexec/agent-core/app/packages/broker'}, 'pre_digest': 'c47698b39802ee6f124fc5598b83602daa932de2136c24a35ffb8a8222cc470f', 'post_digest': 'c39946a7227d01903a064a719459e3f6c12108f8903dd6328d8b54b4cc7f4555'}, 'agt_machine-learning-engineer-agent': {'root': '/Users/authsvc/.agent-core/homes/agt_machine-learning-engineer-agent', 'recorded_files': 21739, 'links': {'profiles/node_modules/.bin/dsh-openai-codex': '../dsh-codex/lib/bin.js', 'profiles/node_modules/@agent-core/bundle-demo': '/usr/local/libexec/agent-core/app/bundle-demo', 'profiles/node_modules/@agent-core/owner-guard': '/usr/local/libexec/agent-core/app/packages/owner-guard', 'profiles/node_modules/@agent-core/demo-server': '/usr/local/libexec/agent-core/app/packages/demo-server', 'profiles/node_modules/@agent-core/bundle-memory': '/usr/local/libexec/agent-core/app/bundle-memory', 'profiles/node_modules/@agent-core/agent-memory': '/usr/local/libexec/agent-core/app/packages/agent-memory', 'profiles/node_modules/@agent-core/bundle-agent-switch': '/usr/local/libexec/agent-core/app/bundle-agent-switch', 'profiles/node_modules/@agent-core/agent-switch': '/usr/local/libexec/agent-core/app/packages/agent-switch', 'profiles/node_modules/@agent-core/workspace-bootstrap': '/usr/local/libexec/agent-core/app/packages/workspace-bootstrap', 'profiles/node_modules/@agent-core/bundle-broker': '/usr/local/libexec/agent-core/app/bundle-broker', 'profiles/node_modules/@agent-core/broker': '/usr/local/libexec/agent-core/app/packages/broker'}, 'pre_digest': 'f5593b0fa7fb3d1e20930ffbd4addf83867c11b667278850ddf17d5a50764320', 'post_digest': '42c95440ff0d969b99a12d3e0b8f20178671e1dd4470b91adc6aa689c470bfaa'}, 'agt_technical-writer-agent': {'root': '/Users/authsvc/.agent-core/homes/agt_technical-writer-agent', 'recorded_files': 21739, 'links': {'profiles/node_modules/.bin/dsh-openai-codex': '../dsh-codex/lib/bin.js', 'profiles/node_modules/@agent-core/bundle-demo': '/usr/local/libexec/agent-core/app/bundle-demo', 'profiles/node_modules/@agent-core/owner-guard': '/usr/local/libexec/agent-core/app/packages/owner-guard', 'profiles/node_modules/@agent-core/demo-server': '/usr/local/libexec/agent-core/app/packages/demo-server', 'profiles/node_modules/@agent-core/bundle-memory': '/usr/local/libexec/agent-core/app/bundle-memory', 'profiles/node_modules/@agent-core/agent-memory': '/usr/local/libexec/agent-core/app/packages/agent-memory', 'profiles/node_modules/@agent-core/bundle-agent-switch': '/usr/local/libexec/agent-core/app/bundle-agent-switch', 'profiles/node_modules/@agent-core/agent-switch': '/usr/local/libexec/agent-core/app/packages/agent-switch', 'profiles/node_modules/@agent-core/workspace-bootstrap': '/usr/local/libexec/agent-core/app/packages/workspace-bootstrap', 'profiles/node_modules/@agent-core/bundle-broker': '/usr/local/libexec/agent-core/app/bundle-broker', 'profiles/node_modules/@agent-core/broker': '/usr/local/libexec/agent-core/app/packages/broker'}, 'pre_digest': 'f5593b0fa7fb3d1e20930ffbd4addf83867c11b667278850ddf17d5a50764320', 'post_digest': '42c95440ff0d969b99a12d3e0b8f20178671e1dd4470b91adc6aa689c470bfaa'}}

E33["public_files"] = [{'path': '/Users/authsvc/.agent-core/agent-model-overrides.json', 'uid': 505, 'gid': 601, 'mode': 384, 'bytes': 11045, 'dev': 16777233, 'ino': 188001967, 'sha256': '321897cd8fb3024f05c4cb0b2960351fcd76b208d749e9b160ffd5e7b0216bf1'}, {'path': '/usr/local/libexec/agent-core/config/agents.json', 'uid': 0, 'gid': 0, 'mode': 420, 'bytes': 17970, 'dev': 16777233, 'ino': 122832634, 'sha256': 'e0800b0fde6fc46b2873decd0f83c9b807b48b56cc3c9ad9cf578a5685b5b6fe'}]
E33["public_aliases"] = [{'path': '/Users/authsvc/.agent-core/agents.json', 'uid': 0, 'gid': 601, 'mode': 493, 'bytes': 48, 'dev': 16777233, 'ino': 188124079, 'target': '/usr/local/libexec/agent-core/config/agents.json'}]

CHILD_SOURCE = "import os,sys\nfd=int(sys.argv[1]);mode=sys.argv[2]\nif fd<64 or mode not in ('guard','inverse'):raise SystemExit(92)\nos.dup2(fd,9,inheritable=True)\nos.close(fd)\nenv={'PATH':'/usr/bin:/bin:/usr/sbin:/sbin','LC_ALL':'C','B7_OUTER_ACTIVE':'1'}\nargv={'guard': ['/bin/bash', '/private/var/db/agent-core/authsvc-codex-migration/activation-code-input/b7-entry-code/b7-wired-inputs/dsh-agent-core/docs/evidence/shared-codex-auth-deployment-root-refreeze-v2-20261002/owner-router-closure-g2-g7-v23.sh', 'b7-guard', '--transaction', 'tx-0c789451b5ca437288197b9faf61b6bc'], 'inverse': ['/usr/local/libexec/agent-core/node-runtime/bin/node', '/private/var/db/agent-core/authsvc-codex-migration/activation-code-input/b7-entry-code/b7-wired-inputs/dsh-agent-core/scripts/lib/deployment-reuse/b7-preparation.mjs', 'recover-six-target', 'tx-0c789451b5ca437288197b9faf61b6bc']}[mode]\nos.execve(argv[0],argv,env)\n"

E33['runtime_current']='/Users/authsvc/.agent-core/control/codex-plugin-runtime/current'

E33['mutation_inode']=[16777233,102163320]

E33['trees']['codeinput']['original_inode']=[16777233,204952637]
E33['trees']['publicArtifacts']['original_inode']=[16777233,205045485]

E33['original_leaf_inodes']={'seed':[16777233,205045565],'batch':[16777233,205471950],'journal':[16777233,193639506],'registration':[16777233,204949146],'execution':[16777233,205662351]}

E33['declared_preimage_store']='/var/db/agent-core/authsvc-codex-migration/.b7-six-preimage-store'
