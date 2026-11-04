# C7 收账输入与隔离验证

本次只实现收账与精确清单；没有删除入口。窗口 GO、生产操作和清单内路径的实际删除仍需独立窗口授权。不要把本次机制验证当作生产窗口验收。

SOP R6 没有指定命名对象域，R7 没有指定可靠年代排序键。执行器不凭文件名或 mtime 推断。窗口 authority 必须携带以下 `c7` 字段，缺项在 stage00 获取生产互斥前拒绝：

```json
{
  "c7": {
    "naming_scope": "Owner确认的同一命名对象域和清点口径",
    "before_path": "/absolute/manual-before.json",
    "before_sha256": "64位实际SHA256",
    "after_path": "/absolute/manual-after.json",
    "renames": {"old-name": "new-name"},
    "generations_newest_first": [".ds-old-newest", ".ds-old-second", ".ds-old-older"],
    "protected_generations": [".ds-old-older"],
    "protection_basis": "人工核对current、open transaction、pinned rollback、review evidence和025材料的依据/回执坐标"
  }
}
```

这是现有窗口 authority 的附加输入，不是独立执行授权。代际顺序必须来自可核验的代际记录，并覆盖 `LIVE=/usr/local/libexec/agent-core` 下全部直接 `.ds-old-*` 目录；缺失、重复、非目录或 symlink 均拒绝。显式保护集独立于最新两代，均保留。附加保守保护包括 `.pinned`、`.keep`、`.review-evidence`、`.open-transaction` marker、current 链接目标、含025或`.bak`的材料名。不能用这些附加保护替代完整人工保护集。

命名前后快照格式相同，必须绝对物理路径，普通文件、无 symlink 祖先。基线在窗口前人工清点并钉 SHA；后态须在本窗口 stage11 验证 PASS 后清点，可在 stage12 的观察期间准备：

```json
{
  "window_id": "same-as-authority",
  "scope": "same-as-c7.naming_scope",
  "captured_at": "2026-11-05T02:45:00Z",
  "method": "manual-inventory",
  "collector": "可归因的清点者",
  "names": ["new-name", "unchanged-name"]
}
```

stage00 保存基线原文、SHA、采集口径与映射；stage13 重新核对基线字节、窗口/对象域/时间和后态。一对一映射同时应用于基线，拒绝未知改名前名、缺失改名后名、重复与映射碰撞，断言映射后 `removed=[]` 且 `added=[]`；原始增删与映射同时保留。

stage13 在释放自有互斥前输出：

- `c7-close.json`：R6 前后绑定、原始及映射后差异；R7 代际顺序、保护原因、保留集和待删集。
- `c7-delete-candidates.json`：精确绝对路径及 lstat 的 device/inode/uid/gid/mode/mtime。
- `c7-delete-candidates.nul`：逐绝对路径 NUL 分隔，避免空白/换行误切分。

这些是当时快照，不是之后的删除许可。实际删除须重新核对路径、身份、保护、窗口授权和时效。没有递归枚举代内内容或执行 unlink/rmdir/rmtree；非 `.ds-old-*`、`.bak-*`、`node_modules.bak` 不进入待删集，025 材料保留。部署 `.bak-*` 原有 normal3/pinned 规则独立不变。

`bash scripts/fleet-window/window-executor-v5.sh --selftest` 仅在 `/usr/local/v5-boot-isolation` 创建新独占运行目录。00–04 标为隔离机制校验，复用实际纯校验函数、绑定 C5-r11 原始证据；生产互斥、清理、fresh-read、结算与静默轮询不执行。随后单独启动官方 stdio fresh-child canary，保存实际 argv/env/stdout/stderr/退出。历史完整 runtime 双启动只重新核对证据，不重跑、不冒充本次启动。

执行器已因 CODE_STRUCTURE_GUARDRAILS_V2 的500行要求，将原内嵌 Python 拆为 `window_executor_state.py` 与 `window_executor_helper.py`；必须连同 `window_close.py` 从同一 Git SHA 取用，不能单独复制旧 shell。原件到新模块的逐行相等坐标在 `C7-EXTRACTION-MAP.json`，完整差异与实测输出随 RECEIPT-C7 保留。
