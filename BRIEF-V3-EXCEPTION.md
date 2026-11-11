# 合同式交办：结构治理 V3 一次性精确差量过渡例外（Owner 第三裁定，2026-11-06）

## Owner 裁定边界（逐字约束，不得越界）
1. **不**全局 rebaseline；**不**修改 V2 固定基线 d506f811；**不**普遍允许历史超限文件按当前行数重新登记
2. 允许建立**一次性、精确差量的过渡例外**：仅覆盖 `scripts/trusted-cp-deploy-install.sh` 的 scheduler-watchdog.mjs 必要白名单变更，绑定精确旧 blob `ef5053201e6af88b1edbcdfc33e845f872183b2b` / 新 blob `356899a8ec0726f245790379429f97dfc6ea3bfb` + 路径 + 实际 diff（+1行白名单）
3. 500 行普通上限**不变**；installer 1315 行登记为**历史技术债 + 单独后续拆分责任与验收**（不是符合通用标准，不是本次一行修复前置）
4. **不可表达则停止本路线**（禁 registry cap 刷新/绕过），回合规拆分（现行 500 上限）

## 交付物
1. **V3 规则文档** `docs/specs/CODE_STRUCTURE_GUARDRAILS_V3_TRANSITION_EXCEPTION_V1.md`（或仓内惯例命名）：例外条款 = 一次性/精确 blob 对绑定/仅该路径/仅该 diff/任何其他改动即失效；历史技术债台账条目（1315 行 + 拆分责任 + 验收定义）；500 上限与 V2 其余条款全部沿用
2. **校验器实现** `scripts/verify-code-structure.mjs`：例外机制（如 STRUCTURE_TRANSITION_EXCEPTION_V1 注册表条目：path+baseBlob+headBlob 三元组匹配才生效；blob 任一变化即失效并报违规；异常文件其余行数增长同样违规）——机器可检查
3. **校验器测试**：例外精确命中 PASS / blob 变化 FAIL / 其他文件不受影响 / 无注册表条目时行为同 V2
4. RECEIPT-V3-EXCEPTION.md + 提交 push + PR（标题含 V3 transitional exception；**不合并**——独立审查后 Owner 正式接受）

## 红线
只改：新规则文档 + 校验器例外机制 + 其测试；不动产品源码；#603 不动（其重验在 V3 接受后另派）；零生产写入；失败即停写 STOPPED-V3-EXCEPTION.md
