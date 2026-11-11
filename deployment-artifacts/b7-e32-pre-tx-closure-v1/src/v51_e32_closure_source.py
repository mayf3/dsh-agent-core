"""Accepted fixed e32 only; two original e29 V1 records, no stage/preservation.
Original DS admission/lease/guard; no EXECUTE/resume/child or mutable evidence rewrite.
"""
import contextlib,ctypes,fcntl,hashlib,json,os,stat,sys,threading
from pathlib import Path
E32 = {'operation_id': 'b7-packet-r31-19e485b2f9fa79a5-e32', 'packet_id': 'b7-native-execution-r31-c71fd2cc', 'registered_peer_uid': 502, 'manifest_sha256': '19e485b2f9fa79a5603a14536c5613be5f0c4c065d182ab420b6c7809a857109', 'source_sha256': '2a881af0daf50547881245f0cfc556d2f52af1f632b0662abc7754cefb3626ff', 'registration_receipt_sha256': '48206edf94673da11a569ee3761e96e429892ebb6a60905a0366e91f7027b398', 'registration_policy_sha256': '27151bf6484d28b916b790a41a66019aa5161f5418c0970c905a68c22d4e1edd', 'registration_request_sha256': 'b05bdabffb683a517cd66f15c362a06b6fe1f17085e087f70d5b4b46ac904dc8', 'execution_record_sha256': 'd84b96aebae1bee1127a5f9bee87adf78e6f4c0cd7debdc1842b3a62068f7f3a', 'execution_policy_sha256': 'ac2d3e6e04864217d022bbcae35c7ef376081bc72af1e85b70c15ad4420ed15f', 'journal_sha256': 'ff9f2122af69f557ba731958d47654525a138cb9587989f6664948abe828d8a4', 'snapshot_root': '/private/var/db/agent-deploy-system-execution/b7-native-execution-r31-c71fd2cc/b7-wired-stage', 'migration_root': '/private/var/db/agent-core/authsvc-codex-migration', 'native_absences': ['/private/var/db/agent-core/authsvc-codex-migration/activation-code-input', '/private/var/db/agent-core/authsvc-codex-migration/b7-preparation-input.json', '/private/var/db/agent-core/authsvc-codex-migration/b7-six-target-batch.json', '/private/var/db/agent-core/authsvc-codex-migration/b7-six-target-batch.json.new', '/private/var/db/agent-core/authsvc-codex-migration/migration-transaction.json', '/private/var/db/agent-core/authsvc-codex-migration/migration-fence.json', '/usr/local/var/agent-core/production-mutation-locks/production-deploy.lock', '/usr/local/share/agent-core/artifacts'], 'snapshot_files': {'accepted-provisioning-commit.txt': {'bytes': 323, 'sha256': '49c5113d2bae4971bf5f49521f2f3cb18627c57f190b68ba6fac21436a0d25b9'}, 'accepted-spec-copy-b08db324aa179af962536a804d275866fa2bb7f2.md': {'bytes': 13402, 'sha256': '3dd42a9b8793bb9f68df420d779edd7af42def897861551349cf68db30dd8458'}, 'checkpoint-inputs.json': {'bytes': 36963, 'sha256': 'c6e916129bfc8c1f180409a68e46630fe88c733c25b9b60add2c1c58ff6e66a1'}, 'checkpoint.py': {'bytes': 21288, 'sha256': '4e3218d2fa69568353f93e2960bbc774e20418ad890e992359481fe87d17d5b2'}, 'old-stage-lease-disposal-once.py': {'bytes': 58648, 'sha256': '519441cd6b51ba3039340027746eb493c36d9ffc41bfc60c7c256e79b4f81e53'}, 'option-b-quarantine-remove.py': {'bytes': 15121, 'sha256': 'e25593a703b74620e741dd40ce870d57d502a4b658f9b8564006e84b142bdc03'}, 'preimage-byte-bindings.json': {'bytes': 1061, 'sha256': '2ab340c78a5996f59d7a9e7249bb411366cef1fec979eea534e70e60940f4d12'}, 'seed-materials.mjs': {'bytes': 8819, 'sha256': '520068ca8d685bcfc34e31d4b448acdb97cb649780e188379e20f46274819346'}, 'stage-seed-once.py': {'bytes': 29408, 'sha256': '2a881af0daf50547881245f0cfc556d2f52af1f632b0662abc7754cefb3626ff'}}}
ORIGINAL_EXECUTION_POLICY = {'packets': {'b7-native-execution-r26': {'enabled': True, 'files': [{'bytes': 323, 'relative': 'accepted-provisioning-commit.txt', 'sha256': '49c5113d2bae4971bf5f49521f2f3cb18627c57f190b68ba6fac21436a0d25b9', 'sourcePath': '/private/var/db/agent-deploy-system/inputs/b7-install-executable-r3/packet/b7-wired-stage/accepted-provisioning-commit.txt'}, {'bytes': 13402, 'relative': 'accepted-spec-copy-b08db324aa179af962536a804d275866fa2bb7f2.md', 'sha256': '3dd42a9b8793bb9f68df420d779edd7af42def897861551349cf68db30dd8458', 'sourcePath': '/private/var/db/agent-deploy-system/inputs/b7-install-executable-r3/packet/b7-wired-stage/accepted-spec-copy-b08db324aa179af962536a804d275866fa2bb7f2.md'}, {'bytes': 36451, 'relative': 'checkpoint-inputs.json', 'sha256': 'fc44cfa4c23025cba722172933534935d41278046a7c25d30e2186ea76a364dc', 'sourcePath': '/private/var/db/agent-deploy-system/inputs/b7-install-executable-r3/packet/b7-wired-stage/checkpoint-inputs.json'}, {'bytes': 21710, 'relative': 'checkpoint.py', 'sha256': '7e79d99faa17f46a5f72855b9a8beea0d113e1c7a813566da74acca2e815375e', 'sourcePath': '/private/var/db/agent-deploy-system/inputs/b7-install-executable-r3/packet/b7-wired-stage/checkpoint.py'}, {'bytes': 58648, 'relative': 'old-stage-lease-disposal-once.py', 'sha256': '519441cd6b51ba3039340027746eb493c36d9ffc41bfc60c7c256e79b4f81e53', 'sourcePath': '/private/var/db/agent-deploy-system/inputs/b7-install-executable-r3/packet/b7-wired-stage/old-stage-lease-disposal-once.py'}, {'bytes': 15121, 'relative': 'option-b-quarantine-remove.py', 'sha256': 'e25593a703b74620e741dd40ce870d57d502a4b658f9b8564006e84b142bdc03', 'sourcePath': '/private/var/db/agent-deploy-system/inputs/b7-install-executable-r3/packet/b7-wired-stage/option-b-quarantine-remove.py'}, {'bytes': 1061, 'relative': 'preimage-byte-bindings.json', 'sha256': '1f1a9e2ed71296a2d16c1c7c7052682b1a56ec3a8907c6985419a57ef9bd03bd', 'sourcePath': '/private/var/db/agent-deploy-system/inputs/b7-install-executable-r3/packet/b7-wired-stage/preimage-byte-bindings.json'}, {'bytes': 8818, 'relative': 'seed-materials.mjs', 'sha256': '9c317c176410ba58d61503ccf656948f7c5441279b5879831a2958e10dd5675d', 'sourcePath': '/private/var/db/agent-deploy-system/inputs/b7-install-executable-r3/packet/b7-wired-stage/seed-materials.mjs'}, {'bytes': 28758, 'relative': 'stage-seed-once.py', 'sha256': '105048ee3b34842a74665580f63f24a5b1624048245e11a07036230bd9bed118', 'sourcePath': '/private/var/db/agent-deploy-system/inputs/b7-install-executable-r3/packet/b7-wired-stage/stage-seed-once.py'}], 'inputLimit': 4096, 'manifestPath': '/private/var/db/agent-deploy-system/inputs/b7-install-executable-r3/packet/PACKET.json', 'manifestSha256': '3053bfaca180cc01e8b9080b10d0712eac75de7a693e72c06bcdb7867b556ab5', 'maxRunSeconds': 7200, 'nativeLockPath': '/usr/local/var/agent-core/production-mutation-locks/production-deploy.lock', 'nativeTransactionPath': '/private/var/db/agent-core/authsvc-codex-migration/migration-transaction.json', 'outputLimit': 4194304, 'ownerIdleSeconds': 900, 'reason': 'BOUND_CURRENT_CHECKPOINT_EXECUTABLE_ORIGINAL_OWNER_AND_GUARDS_REQUIRED', 'resumeOuterPath': '/private/var/db/agent-core/authsvc-codex-migration/activation-code-input/b7-entry-code/b7-wired-inputs/dsh-agent-core/docs/evidence/shared-codex-auth-deployment-root-refreeze-v2-20261002/owner-router-closure-g2-g7-v23.sh', 'resumeOuterSha256': 'd323f7022f164b00fc744f37f0144bfadbbe43955e57ad3efb342e8d2f4c7f45', 'snapshotRoot': '/private/var/db/agent-deploy-system-execution/b7-native-execution-r26/b7-wired-stage', 'stageArgv': ['/usr/bin/python3', '/private/var/db/agent-deploy-system-execution/b7-native-execution-r26/b7-wired-stage/stage-seed-once.py'], 'terminalBinding': {'canaryProducerSha256': '2a8420e177a559f30855aabed6c94bf76409452008482d0345c7f77962276be4', 'carrierPath': '/private/var/db/agent-core/authsvc-codex-migration/activation-code-input/b7-entry-code/b7-wired-inputs/dsh-agent-core/docs/evidence/openai-codex-refresh-token-reused-v1-20260910/owner-authsvc-plugin-upgrade-r13.sh', 'carrierSha256': '5c9d0645cea47c67c651cdc8138cb481eee3b0234849cfde1bd8a00641bd43da', 'deploymentRoot': '/Users/authsvc/.agent-core', 'installerSha256': '1aa63605be32271e244151763e22affb6567c81cc5d0f68007132181bb457083', 'migrationToolSha256': '22e045c5b218a7822f206a524b3b0c6d9065ef795b98e28e8bdd3af0f053f3e8', 'outerPath': '/private/var/db/agent-core/authsvc-codex-migration/activation-code-input/b7-entry-code/b7-wired-inputs/dsh-agent-core/docs/evidence/shared-codex-auth-deployment-root-refreeze-v2-20261002/owner-router-closure-g2-g7-v23.sh', 'outerSha256': 'd323f7022f164b00fc744f37f0144bfadbbe43955e57ad3efb342e8d2f4c7f45', 'ownerRecorderSha256': 'd58a89bb8124cee97bdc26f36b4ed921ec233e9709da197c0d69ef7394adbc51', 'preparationToolSha256': 'eae3b40ab3f01877a1d2e2a18e83d277cf8d94395a1451643c3325f193dd8d0a', 'recoveryRoot': '/var/db/agent-core/authsvc-codex-migration', 'sixTargetProducerSha256': '03322db43a98f70c857ca0064eaa09a9881004abb0efccc174c21d1e23ce325c', 'toolSha256': '8ef6925a9913e1b475e9e4fdd71a70f399a3a53645dccddea7777c0a09a43705', 'trustedRoot': '/usr/local/libexec/agent-core'}}, 'b7-native-execution-r27-new-candidate-uninstallable': {'enabled': True, 'files': [{'bytes': 323, 'relative': 'accepted-provisioning-commit.txt', 'sha256': '49c5113d2bae4971bf5f49521f2f3cb18627c57f190b68ba6fac21436a0d25b9', 'sourcePath': '/private/var/db/agent-deploy-system/inputs/b7-install-r30/packet/b7-wired-stage/accepted-provisioning-commit.txt'}, {'bytes': 13402, 'relative': 'accepted-spec-copy-b08db324aa179af962536a804d275866fa2bb7f2.md', 'sha256': '3dd42a9b8793bb9f68df420d779edd7af42def897861551349cf68db30dd8458', 'sourcePath': '/private/var/db/agent-deploy-system/inputs/b7-install-r30/packet/b7-wired-stage/accepted-spec-copy-b08db324aa179af962536a804d275866fa2bb7f2.md'}, {'bytes': 36963, 'relative': 'checkpoint-inputs.json', 'sha256': 'c6e916129bfc8c1f180409a68e46630fe88c733c25b9b60add2c1c58ff6e66a1', 'sourcePath': '/private/var/db/agent-deploy-system/inputs/b7-install-r30/packet/b7-wired-stage/checkpoint-inputs.json'}, {'bytes': 21288, 'relative': 'checkpoint.py', 'sha256': '4e3218d2fa69568353f93e2960bbc774e20418ad890e992359481fe87d17d5b2', 'sourcePath': '/private/var/db/agent-deploy-system/inputs/b7-install-r30/packet/b7-wired-stage/checkpoint.py'}, {'bytes': 58648, 'relative': 'old-stage-lease-disposal-once.py', 'sha256': '519441cd6b51ba3039340027746eb493c36d9ffc41bfc60c7c256e79b4f81e53', 'sourcePath': '/private/var/db/agent-deploy-system/inputs/b7-install-r30/packet/b7-wired-stage/old-stage-lease-disposal-once.py'}, {'bytes': 15121, 'relative': 'option-b-quarantine-remove.py', 'sha256': 'e25593a703b74620e741dd40ce870d57d502a4b658f9b8564006e84b142bdc03', 'sourcePath': '/private/var/db/agent-deploy-system/inputs/b7-install-r30/packet/b7-wired-stage/option-b-quarantine-remove.py'}, {'bytes': 1061, 'relative': 'preimage-byte-bindings.json', 'sha256': '2ab340c78a5996f59d7a9e7249bb411366cef1fec979eea534e70e60940f4d12', 'sourcePath': '/private/var/db/agent-deploy-system/inputs/b7-install-r30/packet/b7-wired-stage/preimage-byte-bindings.json'}, {'bytes': 8819, 'relative': 'seed-materials.mjs', 'sha256': 'bdeebc35ae21eb1bea8bbcbee977c9cee21bb7c025f34957eca5768bfb19ea1e', 'sourcePath': '/private/var/db/agent-deploy-system/inputs/b7-install-r30/packet/b7-wired-stage/seed-materials.mjs'}, {'bytes': 29465, 'relative': 'stage-seed-once.py', 'sha256': 'd4741d3e3c85024729ff85d57418ab4084fc6b3a14359cea951c294914e1ea20', 'sourcePath': '/private/var/db/agent-deploy-system/inputs/b7-install-r30/packet/b7-wired-stage/stage-seed-once.py'}], 'inputLimit': 4096, 'manifestPath': '/private/var/db/agent-deploy-system/inputs/b7-install-r30/packet/PACKET.json', 'manifestSha256': '2edfbaee8c97de99d9ebb8896ee0886232adb09e744c8c01f7eb6c809d4992ae', 'maxRunSeconds': 7200, 'nativeLockPath': '/usr/local/var/agent-core/production-mutation-locks/production-deploy.lock', 'nativeTransactionPath': '/private/var/db/agent-core/authsvc-codex-migration/migration-transaction.json', 'outputLimit': 4194304, 'ownerIdleSeconds': 900, 'reason': 'B7_COHERENT_CANDIDATE_R30_REGISTRATION_ONLY_PRODUCTION_AUTHORITY_NONE', 'resumeOuterPath': '/private/var/db/agent-core/authsvc-codex-migration/activation-code-input/b7-entry-code/b7-wired-inputs/dsh-agent-core/docs/evidence/shared-codex-auth-deployment-root-refreeze-v2-20261002/owner-router-closure-g2-g7-v23.sh', 'resumeOuterSha256': 'd323f7022f164b00fc744f37f0144bfadbbe43955e57ad3efb342e8d2f4c7f45', 'snapshotRoot': '/private/var/db/agent-deploy-system-execution/b7-native-execution-r27-new-candidate-uninstallable/b7-wired-stage', 'stageArgv': ['/usr/bin/python3', '/private/var/db/agent-deploy-system-execution/b7-native-execution-r27-new-candidate-uninstallable/b7-wired-stage/stage-seed-once.py'], 'terminalBinding': {'canaryProducerSha256': '2a8420e177a559f30855aabed6c94bf76409452008482d0345c7f77962276be4', 'carrierPath': '/private/var/db/agent-core/authsvc-codex-migration/activation-code-input/b7-entry-code/b7-wired-inputs/dsh-agent-core/docs/evidence/openai-codex-refresh-token-reused-v1-20260910/owner-authsvc-plugin-upgrade-r13.sh', 'carrierSha256': 'fd6a1618bffe880ece8a59d9dc3cdaffbcfef2c0b2b9232398231a08eb2529c3', 'deploymentRoot': '/Users/authsvc/.agent-core', 'installerSha256': 'e342743320a525f68a7022df6cce368d0707b08dc4e6f04e3b2dfc689787044d', 'migrationToolSha256': '22e045c5b218a7822f206a524b3b0c6d9065ef795b98e28e8bdd3af0f053f3e8', 'outerPath': '/private/var/db/agent-core/authsvc-codex-migration/activation-code-input/b7-entry-code/b7-wired-inputs/dsh-agent-core/docs/evidence/shared-codex-auth-deployment-root-refreeze-v2-20261002/owner-router-closure-g2-g7-v23.sh', 'outerSha256': 'd323f7022f164b00fc744f37f0144bfadbbe43955e57ad3efb342e8d2f4c7f45', 'ownerRecorderSha256': '243357f274a6a8a7ed9bcdad0dd366f3f3699a55e4b10d67ce68c274e6c8d39b', 'preparationToolSha256': 'db1977a2bf5fffd7b2d07a1860b1c697c6c20b19034eed35ce7511c651ff889a', 'recoveryRoot': '/var/db/agent-core/authsvc-codex-migration', 'sixTargetProducerSha256': '03322db43a98f70c857ca0064eaa09a9881004abb0efccc174c21d1e23ce325c', 'toolSha256': 'be89f18aa738ea93a923647182ff89c6400dfe72f718ed31fe8f5e58b81c10ab', 'trustedRoot': '/usr/local/libexec/agent-core'}}, 'b7-native-execution-r31-c71fd2cc': {'enabled': True, 'files': [{'bytes': 323, 'relative': 'accepted-provisioning-commit.txt', 'sha256': '49c5113d2bae4971bf5f49521f2f3cb18627c57f190b68ba6fac21436a0d25b9', 'sourcePath': '/private/var/db/agent-deploy-system/inputs/b7-install-r31/packet/b7-wired-stage/accepted-provisioning-commit.txt'}, {'bytes': 13402, 'relative': 'accepted-spec-copy-b08db324aa179af962536a804d275866fa2bb7f2.md', 'sha256': '3dd42a9b8793bb9f68df420d779edd7af42def897861551349cf68db30dd8458', 'sourcePath': '/private/var/db/agent-deploy-system/inputs/b7-install-r31/packet/b7-wired-stage/accepted-spec-copy-b08db324aa179af962536a804d275866fa2bb7f2.md'}, {'bytes': 36963, 'relative': 'checkpoint-inputs.json', 'sha256': 'c6e916129bfc8c1f180409a68e46630fe88c733c25b9b60add2c1c58ff6e66a1', 'sourcePath': '/private/var/db/agent-deploy-system/inputs/b7-install-r31/packet/b7-wired-stage/checkpoint-inputs.json'}, {'bytes': 21288, 'relative': 'checkpoint.py', 'sha256': '4e3218d2fa69568353f93e2960bbc774e20418ad890e992359481fe87d17d5b2', 'sourcePath': '/private/var/db/agent-deploy-system/inputs/b7-install-r31/packet/b7-wired-stage/checkpoint.py'}, {'bytes': 58648, 'relative': 'old-stage-lease-disposal-once.py', 'sha256': '519441cd6b51ba3039340027746eb493c36d9ffc41bfc60c7c256e79b4f81e53', 'sourcePath': '/private/var/db/agent-deploy-system/inputs/b7-install-r31/packet/b7-wired-stage/old-stage-lease-disposal-once.py'}, {'bytes': 15121, 'relative': 'option-b-quarantine-remove.py', 'sha256': 'e25593a703b74620e741dd40ce870d57d502a4b658f9b8564006e84b142bdc03', 'sourcePath': '/private/var/db/agent-deploy-system/inputs/b7-install-r31/packet/b7-wired-stage/option-b-quarantine-remove.py'}, {'bytes': 1061, 'relative': 'preimage-byte-bindings.json', 'sha256': '2ab340c78a5996f59d7a9e7249bb411366cef1fec979eea534e70e60940f4d12', 'sourcePath': '/private/var/db/agent-deploy-system/inputs/b7-install-r31/packet/b7-wired-stage/preimage-byte-bindings.json'}, {'bytes': 8819, 'relative': 'seed-materials.mjs', 'sha256': '520068ca8d685bcfc34e31d4b448acdb97cb649780e188379e20f46274819346', 'sourcePath': '/private/var/db/agent-deploy-system/inputs/b7-install-r31/packet/b7-wired-stage/seed-materials.mjs'}, {'bytes': 29408, 'relative': 'stage-seed-once.py', 'sha256': '2a881af0daf50547881245f0cfc556d2f52af1f632b0662abc7754cefb3626ff', 'sourcePath': '/private/var/db/agent-deploy-system/inputs/b7-install-r31/packet/b7-wired-stage/stage-seed-once.py'}], 'inputLimit': 4096, 'manifestPath': '/private/var/db/agent-deploy-system/inputs/b7-install-r31/packet/PACKET.json', 'manifestSha256': '19e485b2f9fa79a5603a14536c5613be5f0c4c065d182ab420b6c7809a857109', 'maxRunSeconds': 7200, 'nativeLockPath': '/usr/local/var/agent-core/production-mutation-locks/production-deploy.lock', 'nativeTransactionPath': '/private/var/db/agent-core/authsvc-codex-migration/migration-transaction.json', 'outputLimit': 4194304, 'ownerIdleSeconds': 900, 'reason': 'B7_COHERENT_CANDIDATE_R31_BOUND_SOURCE_AND_FRESH_SNAPSHOT_ORIGINAL_GUARDS_REQUIRED', 'resumeOuterPath': '/private/var/db/agent-core/authsvc-codex-migration/activation-code-input/b7-entry-code/b7-wired-inputs/dsh-agent-core/docs/evidence/shared-codex-auth-deployment-root-refreeze-v2-20261002/owner-router-closure-g2-g7-v23.sh', 'resumeOuterSha256': 'd323f7022f164b00fc744f37f0144bfadbbe43955e57ad3efb342e8d2f4c7f45', 'snapshotRoot': '/private/var/db/agent-deploy-system-execution/b7-native-execution-r31-c71fd2cc/b7-wired-stage', 'stageArgv': ['/usr/bin/python3', '/private/var/db/agent-deploy-system-execution/b7-native-execution-r31-c71fd2cc/b7-wired-stage/stage-seed-once.py'], 'terminalBinding': {'canaryProducerSha256': '2a8420e177a559f30855aabed6c94bf76409452008482d0345c7f77962276be4', 'carrierPath': '/private/var/db/agent-core/authsvc-codex-migration/activation-code-input/b7-entry-code/b7-wired-inputs/dsh-agent-core/docs/evidence/openai-codex-refresh-token-reused-v1-20260910/owner-authsvc-plugin-upgrade-r13.sh', 'carrierSha256': 'fd6a1618bffe880ece8a59d9dc3cdaffbcfef2c0b2b9232398231a08eb2529c3', 'deploymentRoot': '/Users/authsvc/.agent-core', 'installerSha256': 'e342743320a525f68a7022df6cce368d0707b08dc4e6f04e3b2dfc689787044d', 'migrationToolSha256': '22e045c5b218a7822f206a524b3b0c6d9065ef795b98e28e8bdd3af0f053f3e8', 'outerPath': '/private/var/db/agent-core/authsvc-codex-migration/activation-code-input/b7-entry-code/b7-wired-inputs/dsh-agent-core/docs/evidence/shared-codex-auth-deployment-root-refreeze-v2-20261002/owner-router-closure-g2-g7-v23.sh', 'outerSha256': 'd323f7022f164b00fc744f37f0144bfadbbe43955e57ad3efb342e8d2f4c7f45', 'ownerRecorderSha256': '243357f274a6a8a7ed9bcdad0dd366f3f3699a55e4b10d67ce68c274e6c8d39b', 'preparationToolSha256': 'db1977a2bf5fffd7b2d07a1860b1c697c6c20b19034eed35ce7511c651ff889a', 'recoveryRoot': '/var/db/agent-core/authsvc-codex-migration', 'sixTargetProducerSha256': '03322db43a98f70c857ca0064eaa09a9881004abb0efccc174c21d1e23ce325c', 'toolSha256': 'be89f18aa738ea93a923647182ff89c6400dfe72f718ed31fe8f5e58b81c10ab', 'trustedRoot': '/usr/local/libexec/agent-core'}}}, 'version': 2}
_ALLOWED={'B7_PACKET_DISPOSAL_V3','DS_B7_EXECUTION_STATUS_V2','DS_B7_OWNER_OUTPUT_V2'}
_FS_ROOT='/'

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
  parent=_parent(e,h,80,0o755) if Path(path).parent==Path(e.ds.receipt_path(E32['operation_id'])).parent else _parent(e,h)
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

@contextlib.contextmanager
def _lease(e):
 path=str(Path(e.ds.STATE_ROOT)/'mutation.lock')
 with e.ds.ObservationPath(path,'b7-mutation',e.ds._observation_root_owners()) as h:
  parent=_parent(e,h,80,0o770);fd=os.open(h.name,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=h.parent)
  try:
   s=os.fstat(fd);pin=_file(s)
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
   e.need(self.path in e.disposal_paths(E32['operation_id']) and os.path.normpath(self.path)==self.path)
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
 e.need(path in e.disposal_paths(E32['operation_id']))
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
 e._e32_durability[path]=proof

def _registration(e,op):
 e.need(op==E32['operation_id']);raw,_=_read(e,e.ds.receipt_path(op),0o644,80)
 e.need(_sha(raw)==E32['registration_receipt_sha256']);reg=_strict(raw)
 expected=dict(kind='DS_B7_PACKET_REGISTRATION_V1',version=1,action='B7_PACKET_REGISTER_V1',operation_id=op,state='REGISTERED_ONLY',registered_peer_uid=502,policy_sha256=E32['registration_policy_sha256'],request_sha256=E32['registration_request_sha256'],binding=dict(packetId=E32['packet_id'],manifestSha256=E32['manifest_sha256'],sourceSha256=E32['source_sha256']))
 e.need(_canonical(reg)==_canonical(expected));e.need(_sha(_canonical(dict(operation_id=op,binding=reg['binding'],registered_peer_uid=502,policy_sha256=reg['policy_sha256'])))==reg['request_sha256']);return raw,reg

def _execution(e,op,reg):
 raw,_=_read(e,e.path(op),0o600,80);e.need(_sha(raw)==E32['execution_record_sha256']);state=_strict(raw)
 expected=dict(kind='DS_B7_EXECUTION_V2',operation_id=op,registration_sha256=reg['request_sha256'],execution_policy_sha256=E32['execution_policy_sha256'],phase='RETAINED',attempt=1,tx_id=None,terminal_output=False,input_sequence=0,input_pending=None,reason='EXECUTION_INTENT')
 e.need(_canonical(state)==_canonical(expected));return state

def _snapshot(e):
 root=E32['snapshot_root']
 with e.ds.ObservationPath(root,'b7-evidence',e.ds._observation_root_owners()) as h:
  parent=_parent(e,h);before=os.stat(h.name,dir_fd=h.parent,follow_symlinks=False)
  e.need(stat.S_ISDIR(before.st_mode) and (before.st_uid,before.st_gid,stat.S_IMODE(before.st_mode))==(0,0,0o700))
  fd=os.open(h.name,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=h.parent)
  try:
   pin=_file(before);e.need(pin==_file(os.fstat(fd)));names=sorted(os.listdir(fd));e.need(names==sorted(E32['snapshot_files']));leaf_pins={}
   for name in names:
    raw,proof=_read(e,str(Path(root)/name),0o600,0);row=E32['snapshot_files'][name];leaf_pins[name]=proof[1]
    e.need(len(raw)==row['bytes'] and _sha(raw)==row['sha256'])
   for name,leaf_pin in leaf_pins.items():e.need(leaf_pin==_file(os.stat(name,dir_fd=fd,follow_symlinks=False)))
   e.need(names==sorted(os.listdir(fd)) and pin==_file(os.fstat(fd))==_file(os.stat(h.name,dir_fd=h.parent,follow_symlinks=False)));_verify(e,h,parent)
  finally:os.close(fd)

def _fresh(e):
 e.need(e.active is None,'MUTATION_BUSY','admission')
 with e.ds.ObservationPath(E32['migration_root'],'b7-evidence',e.ds._observation_root_owners()) as h:
  parent=_parent(e,h);before=os.stat(h.name,dir_fd=h.parent,follow_symlinks=False)
  e.need(stat.S_ISDIR(before.st_mode) and (before.st_uid,before.st_gid,stat.S_IMODE(before.st_mode))==(0,0,0o700))
  fd=os.open(h.name,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=h.parent)
  try:e.need(_file(before)==_file(os.fstat(fd))==_file(os.stat(h.name,dir_fd=h.parent,follow_symlinks=False)));_verify(e,h,parent)
  finally:os.close(fd)
 for path in E32['native_absences']:_need_absent(e,path)
 raw,_=_read(e,str(Path(E32['migration_root'])/'.b7-six-journal.jsonl'),0o600,0)
 e.need(_sha(raw)==E32['journal_sha256'])

def _auth(op):
 return dict(kind='DS_B7_PRE_TX_DISPOSAL_AUTH_V1',operation_id=op,manifest_sha256=E32['manifest_sha256'],source_sha256=E32['source_sha256'],execution_receipt_sha256=E32['execution_record_sha256'],journal_sha256=E32['journal_sha256'],evidence=dict(execution_phase='RETAINED',attempt=1,tx_id=None,holder_present=False))
def _terminal(op):
 digest=E32['execution_record_sha256']
 return dict(kind='DS_B7_PRE_TX_DISPOSAL_TERMINAL_V1',operation_id=op,authorization_sha256=_sha(_canonical(_auth(op))),disposal=dict(native_state='CLOSED_PRE_TX',installed=False),pre=dict(execution_receipt_sha256=digest),post=dict(execution_receipt_sha256=digest))
def _load(e,op,slot):
 e.need(op==E32['operation_id'] and slot in ('auth','terminal'));path=e.disposal_paths(op)[slot=='terminal']
 if not _probe(e,path):return None
 raw,_=_read(e,path,0o600,80);expected=_auth(op) if slot=='auth' else _terminal(op)
 record=_strict(raw);e.need(raw==_canonical(expected) and _canonical(record)==_canonical(expected));return record

def _pair(e,op):
 a=_load(e,op,'auth');t=_load(e,op,'terminal');e.need(t is None or a is not None)
 if t is not None:e.need(t['authorization_sha256']==_sha(_canonical(a)))
 return a,t

def _known(e,path):
 raw,pin=_read(e,path,0o600,80);known=e._e32_durability.get(path)==pin
 if not known:e._e32_durability.pop(path,None)
 return known

def _check(e,op,peer,lease,fresh):
 lease();reg,policy=e.identity(op,peer);state=e.load(op,reg);e.need(e.active is None,'MUTATION_BUSY','admission');_snapshot(e);a,t=_pair(e,op)
 if fresh or t is None:_fresh(e)
 lease();return reg,policy,state,dict(zip(e.disposal_paths(op),(a,t)))

def _establish(e,path,lease,recheck):
 validated=recheck();e.need(path in validated and validated[path] is not None)
 expected=_canonical(validated[path])
 if _known(e,path):return
 e._e32_durability.pop(path,None);lease()
 _,pin=_read(e,path,0o600,80,sync=True,expected_canonical=expected)
 recheck();lease();e._e32_durability[path]=pin

def e32_closure_dispose(e,r,peer):
 op=r['operation_id']
 with _lease(e) as lease:
  with e.guard:
   e.identity(op,peer)
   a,t=_pair(e,op);original=not (t is not None and all(_known(e,path) for path in e.disposal_paths(op)))
   def recheck():return _check(e,op,peer,lease,original)[3]
   recheck();authpath,terminalpath=e.disposal_paths(op)
   if a is None:
    recheck();_publish(e,authpath,_canonical(_auth(op)),recheck,lease)
   _establish(e,authpath,lease,recheck)
   if t is None:
    recheck();_publish(e,terminalpath,_canonical(_terminal(op)),recheck,lease)
   _establish(e,terminalpath,lease,recheck)
   reg,policy,state,_=_check(e,op,peer,lease,original)
   return e.view(op,reg,policy,state)

def install_e32_closure(ds,e):
 if getattr(e,'_e32_closure_installed',False):raise ValueError('E32_ALREADY_INSTALLED')
 oldreg=e.base.registration;oldid=e.identity;oldload=e.load;oldview=e.view;olddispose=e.disposal_dispose;oldclosure=getattr(e,'closure_load',None);oldhandle=ds.handle
 local=threading.local();e._e32_durability={}
 def allowed(op):return op==E32['operation_id'] and getattr(local,'allowed',False)
 def registration(op):return _registration(e,op) if allowed(op) else oldreg(op)
 def identity(op,peer):
  if not allowed(op):return oldid(op,peer)
  _,reg=_registration(e,op);e.need(type(peer)is int and peer==502,'PEER_UNAUTHORIZED','authorize')
  e.need(_sha(_canonical(ORIGINAL_EXECUTION_POLICY))==E32['execution_policy_sha256'])
  e.need(E32['packet_id'] in e.policy['packets'] and e.policy['packets'][E32['packet_id']].get('enabled') is True,'PROFILE_NOT_AUTHORIZED','authorize')
  return reg,dict(ORIGINAL_EXECUTION_POLICY['packets'][E32['packet_id']])
 def load(op,reg):return _execution(e,op,reg) if allowed(op) else oldload(op,reg)
 def closure_load(op,slot):return _load(e,op,slot) if allowed(op) else oldclosure(op,slot) if oldclosure else None
 def dispose(r,peer):return e32_closure_dispose(e,r,peer) if allowed(r.get('operation_id')) else olddispose(r,peer)
 def view(op,reg,p,state):
  result=oldview(op,reg,p,state)
  if allowed(op):
   _snapshot(e);a,t=_pair(e,op)
   if t is not None and all(_known(e,path) for path in e.disposal_paths(op)):
    result['disposal_terminal']=dict(native_state='CLOSED_PRE_TX',installed=False,authorization_sha256=t['authorization_sha256'],execution_receipt_sha256=E32['execution_record_sha256']);result['next_action']='COHERENT_CANDIDATE_NEXT'
  return result
 def handle(raw,peer=None):
  try:r=ds._observation_json(raw,'request') if len(raw)<=ds.REQUEST_LIMIT else {}
  except ds.ObservationFailure:return oldhandle(raw,peer=peer)
  targeted=type(r)is dict and r.get('operation_id')==E32['operation_id'] and r.get('action') in _ALLOWED
  previous=getattr(local,'allowed',False);local.allowed=targeted
  try:return oldhandle(raw,peer=peer)
  finally:local.allowed=previous
 e.base.registration=registration;e.identity=identity;e.load=load;e.closure_load=closure_load;e.disposal_dispose=dispose;e.view=view;ds.handle=handle;e._e32_closure_installed=True
 return e
