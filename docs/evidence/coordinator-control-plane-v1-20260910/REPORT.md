# WORKFLOW_COORDINATOR_CONTROL_PLANE_V1 — 实施与部署收据（2026-09-09 深夜轮）

## 已完成（source + svc 生产）

- Acceptance（Owner EXACT-HEAD ACCEPTANCE=YES，SHIP_BLOCKERS=0）：
  - svc #35 → main `dd235dc`（acceptance commit beaaf32；§1 起 contract bytes 逐字节 NONE delta）
  - dsh #229 → main `b913ffb`（§26 finalize；§25 bytes 不变；svc authority repin dd235dc）
  - dsh #230 → main `6b81995`（frontmatter 翻转 + external authority repin dd235dc；§4 census 历史标签按裁定保留）
- svc 实现（branch impl/coordinator-control-plane-v1 @ `6dc1027`，本地提交；与 main dd235dc 的合并经由后续 source PR 或直接保留在 impl 分支，见下方说明）：
  - W 放宽：cancel/archive 事务 Step5 + member 三函数 → DOMAIN_OWNER OR GLOBAL_WORKFLOW_COORDINATOR（错误码字节不变，含 not_domain_owner）
  - N 端点：GET/GET/PATCH /internal/v1/domains…、GET owner（domain_owner_missing）、binding-reconcile plan/apply（exact-preimage → binding_conflict fail-closed；receipt command_types domain.update / domain.binding_reconcile）
  - CTR-CP-006：member add 三态 outcome（added / 同 key replay 原 receipt / 新 key → already_member 零 mutation 零第二条 member_added audit，member_add_noop 显式审计）
  - 潜伏 main 修复：activation_kind::text（global+domain 两投影）——生产事故 0f60c6f0 热修从未进 main，本次恢复 main↔live 对齐
  - 测试：tests/35 六项 + tests/23 边界更新至新法（9/9）；01/24/27/28/29 的失败 A/B pristine 实证为共享库污染/环境缺变量，非本回归
- svc 生产部署（controlled，零 migration）：
  - live `/version` gitSha = `6dc1027fb6e9770702cb14c47bfed2b7b654cf2b`，artifact sha256 `d81d1a25…7bf229b7`
  - healthz/readyz 200、auth 401、新端点未认证 401/405（路由注册 + fail-closed）
  - ledger.json 追加收据；rollback preimage = releases/0f60c6f0…（旧 artifact 3d43f70e…）
  - 注：进程 32486（/private/tmp/svc-rehearsal，Sep 7 遗留 rehearsal）不占端口、未触碰
- fresh canonical HR resolution（五门 4/5）：auth-service 目录唯一解析 agt_hr-agent → `dc702687-6515-4a2a-91ae-e572a9bbd766`（active），与 expected 历史 identity 一致
- dsh broker 实现（PR #235 → main `f132557`）：
  - workflow_execute 四 operation（§25）+ declarer +7 svc 字典码
  - 三 grouped manifest（domain_admin/members/binding_reconcile）+ inventory 18→21 + 三个 dedicated test homes
  - broker 套件 396/396 离线全绿；既有 18 manifest 字节零回归

## BLOCKED（升级 Owner，均为授权的升级条件）

1. **Coordinator bootstrap grant（五门第 5 门后唯一剩余执行步）**：admin provisioning 凭据不可得——bc970ced 的 machine-client secret 在 authsvc 属主目录（~/.openclaw/credentials，agent shell 不可读），sudo 需密码，auth DB 密码不可得。B7 禁止 HR 自授，故必须由 Owner 用 provisioning authority 凭据执行：

```bash
# Owner 执行（凭据 = provisioning authority 的 machine client；scope 需含 workflow.admin）
TOKEN=$(curl -s --noproxy '*' -X POST http://127.0.0.1:4001/oauth/token \
  -H 'Content-Type: application/json' \
  -d '{"grant_type":"client_credentials","client_id":"<PROVISIONER_CLIENT_ID>","client_secret":"<SECRET>","scope":"workflow.admin"}' | jq -r .access_token)
IDEM=$(uuidgen)
curl -s --noproxy '*' -X PUT \
  "http://127.0.0.1:8989/internal/v1/admin/global-role-bindings/dc702687-6515-4a2a-91ae-e572a9bbd766" \
  -H "Authorization: Bearer $TOKEN" -H "Idempotency-Key: $IDEM" -H 'Content-Type: application/json' \
  -d '{"roleKey":"GLOBAL_WORKFLOW_COORDINATOR","enabled":true}'
# read-back：GET owner / 直发一个 coordinator 面 200 即证
```
（fresh resolution 已唯一命中该 UUID —— expected evidence 一致；若 Owner 侧 fresh 解析不同 → STOP/IDENTITY_MISMATCH。）

2. **Broker 生产部署（步骤 9）**：P0 生产并发纪律（PRODUCTION_MUTATION_CONCURRENCY=1）+ 生产 broker index.js 当前承载 agent-process-exited goal 的 overlay（该 goal 明令勿碰），今晚不抢占。slot 释放后从 dsh main `f132557` 走既定 narrow-closure + boot rehearsal + kickstart 流程。

3. **Runtime read-back + dogfood A/B/C（步骤 10–12）**：依赖 1（grant）与 2（deploy）。dogfood B 三 Canary（9fd262ec / 5538dca9 / 5fe7570a）等通道打通后由 HR 以自己身份 verify→cancel→verify→archive→verify。
