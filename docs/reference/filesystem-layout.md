# 文件系统布局（Filesystem Layout）

> status: current · 本页是「Agent Core 在磁盘上长什么样」的唯一 authority。

## 仓库内（repo）

```
dsh-agent-core/
├── packages/            # 15 个 npm workspace 包（清单见 architecture/overview）
├── bundle-*/            # 能力包（integration / memory / agent-switch / broker / demo）
├── profile-*/           # DSH profile（integration 控制面 / integration-agent per-agent）
├── scripts/             # verify / 运维 / 一次性迁移脚本（见 reference/cli）
├── examples/v0-vertical-slice/   # 已废弃的 V0 历史示例
├── docs/                # 本文档树
│   ├── README.md        # current index（唯一导航入口）
│   ├── getting-started/ concepts/ architecture/ guides/ security/ reference/ contributing/
│   ├── investigations/  # Evidence Authority（活跃，不迁移）
│   ├── specs/           # Change / Implementation Authority（活跃，不迁移）
│   ├── decisions/       # Long-lived Invariant（ADR）
│   └── history/         # 研发历史（reports + snapshots，带 historical marker）
├── AGENTS.md            # Coding Agent bootstrap（指向 .agents/）
└── .agents/             # 开发协议（README + templates）
```

## 机器上（runtime，默认值）

```
~/.dsh/
├── .credentials.yaml       # DSH 模型 API key（value 永不入库）
├── settings.yaml           # 模型路由
├── workspaces/<agentId>/   # per-agent workspace（cwd；内含 AGENTS.md、MEMORY.md、memory/）
├── bindings/bindings.json  # Binding 持久化（原子 JSON）
└── profiles/agent-core-integration{,-agent}/   # install:integration 装入的 symlink

~/.agent-core/              # 生产持久根（PRODUCTION_RUNTIME_ROOT）
├── scheduler/jobs/jobs.json + runs.jsonl
└── control/runtime-evidence.jsonl
```

per-agent DSH_HOME 由 `@agent-core/agent-provisioning` 幂等准备（settings /
credentials / profile / 插件 farm 链接），对 Router 可能 spawn 的每个 profile 成立。

相关：[configuration](configuration.md) ·
[concepts/workspace-and-memory](../concepts/workspace-and-memory.md) ·
[security/credentials](../security/credentials.md)。
