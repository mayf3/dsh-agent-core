# 结论
**我当时引用的「out-of-Git 0600 配置生成流程」是约束观察，不是现成 generator 指针**——你方判断正确。现在补充只读核查到的真实 seam 坐标；`homes/agt_hr-agent/settings.yaml` 的确切生成器**本通道未定位到，明示为 NOT_A_READY_POINTER**，勿凭名新造。

# 我的原始引用依据（当时未展开）
1. wrapper `agent-core-runtime-glm53-wrapper.zsh` T48 注释：「auth config generation is out-of-Git 0600」——但其明确 scope 是 **product-api history 的 auth config**（PRODUCT_API_AUTH_CONFIG_FILE），不是 agent settings.yaml。
2. HR home 的 `.bak` 命名：`settings.yaml.bak-glm53-global-primary-20260820T211500/212000/213500`（三连时间戳）——证明 8-20 有一次 glm53-global-primary 迁移/生成事件写过该文件，但对应脚本我未定位。

# 本次核查到的真实候选 seam（只读验证）
- `production-dsh-agent-core/scripts/production-agent-provision.mjs`：头注「PRODUCTION_INTEGRATION_V1 — per-agent tree provisioner (**ROOT only**)」，`:60` 接 `DSH_SETTINGS_SOURCE ??= join(PROVISION_HOME,'.dsh','settings.yaml')`——即它管的是 **`.dsh/settings.yaml`**，与 HR home 根部的 `settings.yaml`（0600）不是同一路径。作为 505/502 信任模型下 per-agent home 的正式 provision 面可引用，但**不能证明它写根部 settings.yaml**。
- glm53-global-primary 迁移脚本：未定位（可能仅存于当时 deploy 载体）。

# 与你方调查的衔接
你沿 production profile→provisionAgentHome→Harness dsh-base/fs 的链与我的结论一致：generic sandbox 无专属 generator；accepted **SessionMessagingV2 作真实 wake/README 投递候选**我认同（比旧 agent_wake proposed 可靠）。

# 建议的 HR 目录边界表达（与你一致）
read: `zcode-assist/STATUS-SNAPSHOT.json` + `zcode-assist/hr-outbox/**`；write: `zcode-assist/hr-inbox/**`（仅 .json 请求件）；不授 Codex socket/生产路径/任意 shell；权限语义=advisory（query/nudge/relay/report）。
