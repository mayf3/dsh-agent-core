# WORKFLOW_TRANSITION_ARTIFACT_BUILD_V2（制品 执行）

- TASK_NAME = 制品 执行（TASK_TYPE = 执行；CTR-HD-006 链第 2 环 ARTIFACT_BUILD；Recipient = 新的 Deployment Build Agent）
- 日期：2026-08-31；Authority = `AGENT_CORE_WORKFLOW_TRANSITION_PINNED_HOTFIX_DEPLOYMENT_V1`（accepted @ github/main `1a9b81de`，PR #131；本轮 fetch 实证 merge commit == origin/main tip 且为其祖先）
- 制品（canonical，用户私有 0700，非 /tmp）：`/Users/yanfenma/workspace/deployment-artifacts/workflow-transition-final-f4bc431/`
- **本轮零生产触碰、零 sudo、零重启、零 Grant/canary/真实 transition；制品完成 ≠ 已部署。**

## 0. 结论

```text
TASK_NAME = 制品 执行
TASK_STATUS = COMPLETE
AUTHORITY_PRESENT_IN_MAIN = YES
AUTHORITY_MERGE_COMMIT = 1a9b81de19c2bf4af01f62f6189acffc1bb6839d

RELEASE_SOURCE_COMMIT = f4bc4311225c9e0fd906ce108a5b9ffdbd83a957（tree 1f327d8a6c8f3ffefcb1dad85c3b59a7ab7cbd9b）
TARGET_GIT_BLOB = 577c8778cf35810ce7538aff52ab354e0c1dddc6
PRODUCTION_PREIMAGE_BLOB = 04ca8550fbdaf9b66624dea42701a8a9af7547a8
PRODUCTION_PREFLIGHT = PASS（五项全过，fresh 只读；详见 §4）

ARTIFACT_PATH = /Users/yanfenma/workspace/deployment-artifacts/workflow-transition-final-f4bc431/workflow-transition-f4bc431.tar
ARTIFACT_SHA256 = 67e5e183722ed50601ff84ca7dc0f6c217bc4f67c4ce826f301f53ef40f82473
ARTIFACT_BYTE_SIZE = 30720

SOURCE_STAMP_PATH = …/SOURCE_STAMP.json        SOURCE_STAMP_VALID = YES（artifact+manifest 摘要程序化复验）
DEPLOYMENT_MANIFEST_PATH = …/DEPLOYMENT_MANIFEST.json
DEPLOYMENT_SCOPE = 恰好 1 个运行时文件（workflow.js；allowlist 单路径；无其它文件/测试/整树）

ROLLBACK_BUNDLE_PATH = …/rollback/rollback-preimage-04ca8550.tar（sha256 fe290f9fefb112f9b50a9ec0fff273267d37c02c5f4dc7c4e90e286d252eedb6）
ROLLBACK_SCOPE = 同一文件 + ai.agent-core.runtime 精确重启（ROLLBACK_MATCHES_DEPLOYMENT_SCOPE = YES）
ROLLBACK_DRILL = PASS（14→15→14；字节/size/mode 恢复；零残留；沙箱已删）

OWNER_EXECUTION_PLAN_PATH = …/OWNER_EXECUTION_PLAN.md    OWNER_EXECUTION_PLAN_EXECUTED = NO

BROKER_TESTS = 186/186 PASS（pinned worktree 重跑 + 证据捕获二次重跑）
WORKFLOW_TRANSITION_TESTS = 5/5 PASS
MANIFEST_INVENTORY_TESTS = PASS（aggregate = 15；workflow 模块 7 manifests 含 transition）
TARGET_MANIFEST_COUNT = 15
GOVERNANCE_VERIFY = PASS（vendored bytes match governance.lock.json）
STRUCTURE_VERIFY = PASS（0 violations；冻结树 identity + vs first-parent 双跑）
DIFF_CHECK = PASS（git diff --check clean；tracked 零改动）
SECRET_SCAN = PASS（0 hits；tar 成员 + 全部交付文件）

PRODUCTION_CHANGED = NO      SERVICES_RESTARTED = NO     SUDO_EXECUTED = NO
GRANT_CHANGED = NO           CANARY_EXECUTED = NO        REAL_TRANSITION_EXECUTED = NO

READY_FOR_INDEPENDENT_AUDIT = YES
NEXT_TASK = 制品 审计
```

语义确认（target blob 实测，见 evidence/test-matrix.txt §4）：`operations = [submit]`（唯一）；
`requiredScopes = ["workflow.execute"]`；model-facing 参数 =
`workflowInstanceId, transitionDefinitionId, expectedWorkflowStateVersion, submissionPayload`
（**不含** principalId / agentId / actor / assignee / idempotencyKey）；`http.idempotencyKey == true`
（Idempotency-Key 仍由 trusted transport 生成，模型不可传入；5/5 测试含 generic-IK 写形验证）。

## 1. Worktree Gate 与停止条件判定（ACC-HD-008）

- fetch 后 `origin/main = 1a9b81de`（fetch 输出 `1fdf8c3..1a9b81d`）；`git merge-base --is-ancestor 1a9b81de origin/main` = PASS（merge commit 即当前 tip）。
- 独立 clean worktree（detached @ `f4bc431`，porcelain 空；不进入/不清理用户已有 checkout）：`/Users/yanfenma/workspace/deployment-worktrees/workflow-transition-final-f4bc431`。
- 冻结面验证：`HEAD:…workflow.js` blob = `577c8778…`（== dispatch pin）；六兄弟运行时文件 blob（mapping `890d35b9` / schema `13f80f87` / transport `b697850c` / relay `24c0931a` / registry `7cd71350` / index `6c4a60af`）与基线审计 §A 逐项一致。
- 停止条件五项逐一判定，均未触发：
  1. Authority 撤销/supersede：frontmatter `status: accepted`、`superseded_by: null`（origin/main 实读）——未触发。
  2. workflow_transition 新安全 blocker：`6478356..1a9b81d` 无任何触及 `packages/broker/src/capabilities/workflow.js` 的提交（PR #127 fleet-codex / PR #105 forum-moderation 均不在该路径）——未触发。
  3. 生产 preimage 变化：fresh 只读 `git hash-object` == `04ca8550…`——未触发。
  4. 生产 service / packaging / deployment unit 变化：`ai.agent-core.runtime` running（pid 2766）、entrypoint/plist/路径如 OBS-HD-009，部署单元仍单 ESM 文件——未触发。
  5. Governing Spec 部署合同变化：`6478356..origin/main` 间 `AGENT_CORE_WORKFLOW_ASSIGNEE_TRANSITION_CAPABILITY_V1.md` 零提交——未触发。
- 漂移分类（CTR-HD-007）：authoring 后 main 前进 = 权威 spec 提案/接受（docs）+ PR #127 + PR #105，全部**无关**→ 继续执行，**未改绑** source commit / feature set / allowlist（CTR-HD-002 六值原样）。

## 2. 旧制品处置（CTR-HD-010 / ACC-HD-010）

两枚旧 tar（`db573426…`、`482e19c9…`）保持 REJECTED：本轮**未进入、未读取、未修补、未重新封印**其目录
（`…/deployment-artifacts/dsh-agent-core-workflow-transition-f4bc4311225c/` 原样未动）。新制品自冻结
git object 重新生成（`git show f4bc431:…workflow.js` 直取 blob 字节，非 working-file 拷贝），全新 digest。

## 3. 测试矩阵（pinned worktree；二次重跑捕获入 evidence/test-matrix.txt）

- broker 全量 `node --test`：**186/186**（与基线审计同值；npm 装依赖仅 untracked node_modules，tracked 零改动）
- `workflow-transition.test.js`：**5/5**（IK 写形 / submit-only 合同冻结 / 授权 POST 语义 / 可选 payload 缺省 / 错误封套）
- `manifest-inventory.test.js`：PASS（**15** 全部 validate）
- governance：`verify_governance.py` PASS；structure：`verify-code-structure.mjs` PASS（identity + HEAD~1 双跑，0 violations）；diff：clean

## 4. 生产部署前状态只读复核（fresh preflight，CTR-HD-004/005；证据 drill/preflight-read-only.txt）

1. Broker health = **PASS**（`127.0.0.1:8790/health` `{"ok":true,…}`；runtime 为 monolith，8790 即其健康面）
2. live workflow.js blob = **`04ca8550fbdaf9b66624dea42701a8a9af7547a8`**（== pin；sha256 `ca27f3a8…`；16107 bytes；regular file、非 symlink、root:wheel 0644、无 ACL、无 xattr）
3. `workflow_transition` 当前**不存在** + shipped manifest count = **14**（枚举输入 = 生产 `packages/broker/src` 19/19 文件逐 hash 验证副本；方法与 f4bc431 manifest-inventory 测试同源：forum 7 + workflow 6 + okr 1 = 14，全部 validate）
4. `AUTH_V1_CANARY_WRITE_ENABLED` = **false**（`launchctl print system/com.svc-workflow` 无任何 `AUTH_V1_*`；闸门在 svc-workflow `canary_guard.rs`，默认 false 即全 403 `canary_read_only`）
5. 服务坐标未变（stop-condition #4 证据）

## 5. 制品目录（0700，13 文件，MANIFEST.md + MANIFEST.sha256 封印）

```text
workflow-transition-f4bc431.tar   # canonical artifact：恰一 regular 成员 workflow.js（USTAR、0644、uid/gid 0、mtime=源提交时刻，确定性可复现）
SOURCE_STAMP.json / DEPLOYMENT_MANIFEST.json / OWNER_EXECUTION_PLAN.md
rollback/rollback-preimage-04ca8550.tar + rollback/PREIMAGE_META.json   # 等面回滚：preimage 字节+metadata（blob/sha/size/uid/gid/mode/mtime/ACL/xattr）
drill/enumerate-manifests.mjs + ROLLBACK_DRILL.md + rollback-drill-transcript.txt + preflight-read-only.txt + secret-scan.txt
MANIFEST.md + MANIFEST.sha256
```

诚实注记：(a) macOS 对用户会话新建文件自动附加空值 `com.apple.provenance` xattr（系统管理、不可删、不含数据、不影响任何 sha256）；已在 MANIFEST.md 声明。(b) 沙箱无法复现 root:wheel 属主 —— drill 证明字节/size/mode 完整恢复，owner/group 恢复由 Owner 计划的 `sudo install -o root -g wheel` 承载。(c) manifest count=14 的证明力来自"逐文件 hash 全等副本 + live blob fresh 实测"，非同款代码推断。

## 6. 边界（BOUNDARIES）

- DOCS-ONLY repo 变更（本报告 + evidence 目录，显式 pathspec 提交；既有 staged WIP 一律未动；Authority Spec / Governing Spec 零改动，ACC-HD-012）。
- 生产访问全程只读：health GET、stat/hash、launchctl print、文件读（rollback bundle 的 preimage 字节来源）。
- 不 sudo、不重启、不部署、不写 Grant、不执行 canary、不执行真实 transition、不写 workflow 数据、不把制品完成表述为已部署。
- 构建产物只写入用户私有 0700 目录与 0700 临时 worktree 区；/tmp 仅用过一次性解包校验（mktemp，已删）。

## 7. 给「制品 审计」轮的绑定对象（CTR-HD-008：任一字节变化授权全失效）

`workflow-transition-f4bc431.tar` sha256 `67e5e183…f82473`；`rollback-preimage-04ca8550.tar` sha256 `fe290f9f…eedb6`；
`DEPLOYMENT_MANIFEST.json` sha256 `15be1175…e635e`；`SOURCE_STAMP.json`（含上述摘要 + tree/commit/dirty=false）；
`OWNER_EXECUTION_PLAN.md`；production preimage `04ca8550fbdaf9b66624dea42701a8a9af7547a8`。
