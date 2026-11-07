# STOPPED — Captain Auth identity-only creation

- observed_at: 2026-11-07T22:15:13.081372+00:00
- branch: `docs/captain-auth-create`
- base: `80fc43bd626ceaf5a680f9355ac9c8b209cdd82b`
- phase: `READ_ONLY_AUTHENTICATION_PREFLIGHT`
- result: `STOPPED_BEFORE_AUTH_MUTATION`
- reason: 当前执行者 `uid=502 (yanfenma)` 无法读取既有正式 provisioning 入口引用的凭据 `/Users/yanfenma/.openclaw/credentials/broker-provisioning-v2-secret`；fresh metadata 为 owner UID 505、GID 601、mode 0600、nonempty、`os.access(R_OK)=false`。没有读取或复制其内容。
- affected action: 以合法既有管理员身份取得 `aud=svc-auth`、`scope=auth.identity.provision` 的 V1 RS256 token 并调用 `POST /api/v1/principals`。当前 actor 权限/认证能力为 `NOT_HELD`；真实管理员 live 权限和目标现存状态为 `UNKNOWN`。
- actual actions: 只读治理/技能/源码/launchd/文件 metadata 查证；`GET http://127.0.0.1:4001/api/health` 返回 HTTP 200，contract 1.15.0。未 mint token，未调用受保护目标查询，未调用任何创建接口。
- stop boundary: Auth 创建/DB/Client/Secret/Grant/任命/生产写入全部停止；不切身份、不改凭据 owner/mode、不创建 helper、不绕认证、不触碰 runtime/8788。
- existing authority: Owner `owner-20261108-three-unified` items[0] + accepted `AGENT_CORE_STANDING_OPERATIONAL_DELEGATION_V1` CTR-SOD-004。创建目的已批准，不要求重批。
- evidence limit: 仅证明当前执行上下文缺合法可用认证输入，尚不证明所有现有 Auth 管理员均无法完成。允许继续本任务授权的只读机制诊断及失败登记/commit/push/PR。
- next safe action: 核查已存在的正式管理员调用机制，完成可审计差量收据；由原 Auth 合法管理责任链通过既有正式接口提供真实管理员身份/权限及 identity-only 回执。只有确需新增信任边界时才提交最小差量 HUMAN_GATE。

最终诊断、身份/类型/生命周期限制和验证见 [CAPTAIN-AUTH-CREATE-RECEIPT.md](CAPTAIN-AUTH-CREATE-RECEIPT.md)。
