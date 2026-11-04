# 合同式交办：stage_06 xattr 采集修复（C6-H2 确诊根因的精准实施）

## 背景（先读 C6-PREIMAGE-ANALYSIS.md §4 H2 行 + 下方事实）
1. 全机 Python（/usr/bin、/opt/homebrew、/usr/local）**均无 os.listxattr**——r5 的 CLI fallback 是必须的，
   但其表示不可比（native dict vs 'cli':digest vs '<unreadable>' 哨兵）且逐条子进程（1.47M 次=1h27m）
2. /usr/bin/xattr CLI **支持 -lr 递归单进程** 与多文件批量
3. C5-R5 实测：ditto rc=0 但**丢空值 xattr**（如 com.apple.provenance: 空值）
4. 草稿验证：`xattr -lr` 输出格式 `path: key: value`（可按 path 分段解析）

## 任务（改 scripts/fleet-window/window-executor-v5.sh 的内嵌 helper Python）
1. **extended(p) 移除 xattr**（只留 flags）——哨兵与格式混装彻底消失
2. **inventory(root) 末尾增 tree 级 xattr 段**：
   - `xattr -lr root` 单进程 → 按 `path:` 分段解析 → {relpath: digest(排序后属性行)} 存 result['_xattrs_map']
   - 解析失败/命令 rc≠0 → fail-closed（报精确路径/stderr）
3. **preimage 的 ditto 之后**：对 target 跑同款 `xattr -lr` → 对账 source map：
   - target 缺失且 source 为**空值属性** → `xattr -w key '' target_path` 逐条重贴（记日志）
   - target 缺失**非空值**属性或值不同 → 硬失败（列条目）
   - 重贴后重算 target map，两 map 必须相等
4. **合成树测试**（/usr/local/v5-boot-isolation/xattr-fix-test/）：有值/空值/多属性/无属性/dangling symlink
   五类夹具 → 模拟 inventory+ditto+对账+重贴全流程 → 全 PASS 输出原文
5. 执行器 dry-run 仍 PASS；git diff --check 过

## 红线
只改 helper 内嵌 Python 的上述范围（其余 15 节点逻辑一字不动）；零生产接触；失败即停写 STOPPED-XATTRFIX.md
## 回执（RECEIPT-XATTRFIX.md）
patch diff、合成测试输出原文、dry-run 输出、UNKNOWN
