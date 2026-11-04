# STOPPED-XATTRFIX

状态：STOPPED_SCOPE_CONFLICT；记录时间：2026-11-04T11:54:24.332590+00:00。

目标工作树：`/private/tmp/dsh-fleet-window-tools`；branch=`chore/fleet-window-tools`；HEAD/base=`c4152e9a45e2f1798807492c73516d924dcaf855`。
执行器 SHA-256：`7af63a75ec376816dfa516c72f0edf29605725777c3564511c87ce57f5d47abe`；与 HEAD 字节相同；未实施补丁。

用户任务要求 `inventory()` 返回普通字典的 `_xattrs_map`（relpath → digest），同时禁止修改其余节点逻辑。这两项在现有共享消费者上不能同时满足：

- `scripts/fleet-window/window-executor-v5.sh:543,545-546`：prerequisites 用 `v['kind']` 遍历 inventory。无条件新增保留键会 KeyError。仅 metadata=True 增键可避开此处，但不解决下一项。
- 同文件 `691-693`：final-binding 使用 metadata=True 的 inventory；保留键的值没有 kind/uid/gid/mode，执行 `v['kind']` 必然 KeyError。
- 同文件 `659-673`：preserve-config 对所有 current 项做整值子集比较。目标合法缺少一个带 xattr 的配置文件时，其完整 map 与 expected 不同，会在补齐前提前拒绝；记录遍历也没有区分保留键。
- 同文件 `688`：final-binding 的 uid/gid 剥离函数面向文件记录，不能用于属性表；属性表需直接比较。

只读 schema 探针（纯内存，未调用 helper）：

```text
final-binding same consumer loop => KeyError('kind'), path='_xattrs_map'
preserve-config subset gate with valid missing-only attributes => False
```

独立只读审查得出同一结论。不存在已确认的、保持普通字典/JSON/完整覆盖语义且完全不适配消费者的方案。拒绝用隐藏键的 dict 子类、按 op 偷切 schema 或跳过 xattr 检查规避。

阻断分类：SCOPE_ESCALATION（必要消费者适配超出本次用户红线）。SOURCE=用户“只改 helper 内嵌 Python 的上述范围（其余15节点逻辑一字不动）”；COUNTEREXAMPLE=上述 KeyError 与合法缺失配置提前拒绝；IMPACT=新 schema 会破坏 stage_03/08/09；MINIMAL_CLOSURE=用户授权以下最小适配或另行明确满足共享消费者兼容性的方案。

最小可审阅范围扩展（仅建议，未应用）：

1. prerequisites 的普通记录遍历排除 `_xattrs_map`；metadata=False 保持原有不采集元数据语义也可避免该处改动。
2. preserve-config 的普通记录遍历排除保留键；xattr 子集比较按现存文件路径逐项比较，补齐后的完整 inventory 相等仍包含完整属性表。
3. final-binding 将完整属性表直接比较；uid/gid 剥离及 kind/uid/gid/mode 检查只处理文件记录。

此外实现时须固定 nofollow（CLI 帮助确认 `-s`）；支持或明确拒绝无法无歧义解析的二进制续行/路径。不得跟随 dangling 或绝对链接进入生产。

IMPLEMENTATION_ALLOWED=NO（当前范围）；MERGE_READY=NO；PRODUCTION_OPERATION_ALLOWED=NO。
未改执行器、未创建合成树、未运行 ditto/xattr 采集或写属性、未读取生产树/历史 preimage、未调用任何生产阶段/服务/端口/安装器/结算。
只运行原执行器 `--dry-run` 和 git diff --check，两者 rc=0。dry-run 不调用 helper，不能解除本停点。
待用户范围答复；等待不构成批准。失败即停后的后续写入限于本停点与合同要求的回执。
