# STOPPED-XATTRFIX-R3

状态：STOPPED_REQUIRED_GATE_FAILURE；记录时间：2026-11-04T12:11:51.124708+00:00。

worktree=/private/tmp/dsh-fleet-window-tools；branch=chore/fleet-window-tools；
HEAD/base=c4152e9a45e2f1798807492c73516d924dcaf855（未变）。执行授权见 BRIEF-XATTRFIX-R3.md。

## 精确停点

- SOURCE：用户 R3 任务顺序第 2、5 项：五类夹具全 PASS，失败即停。
- COUNTEREXAMPLE：首次合成测试进程 rc=1，10 tests，9 ok / 1 failure。
  `scripts/fleet-window/test_xattrfix_r3.py:84` 的无属性断言
  `actual.get('none', {}) == {}` 实测得到
  `{'com.apple.provenance': b'\x01\x02\x00aYZ\xf3\xdb\xa1t\xa4'}`。
  夹具创建/清属性在同文件 :49–58；虽然 :53 执行了 `xattr -crs`，不能
  据其 rc=0 就认为清空了所有属性。该失败未证明复制器错误，也未证明无属性夹具有效。
- IMPACT：REQUIRED_GATE_FAILURE；五类全 PASS 与完整拆分等价性未建立。
  affected_readiness=[COMMIT_READY, PUSH_READY, PR_READY] 均 NO；MERGE_READY=NO；
  PRODUCTION_OPERATION_ALLOWED=NO。不得将前面的完整 inventory 相等断言通过
  当作失败门的替代，不过滤 provenance、不改断言掩盖失败。
- MINIMAL_CLOSURE：后续经续办授权，先查清并建立本机可验证的真正无属性夹具，
  或由 Owner 明确裁定该夹具类别的验收含义；保留当前失败证据与实际属性，
  重新运行必须的五类门后才可进行后续等价性门。这里没有实施该后续修复。

## 运行坐标与原始证据

- fixture root：/usr/local/v5-boot-isolation/xattr-fix-test/
- 首次测试唯一子树：r3-pc7hpigy/
- 失败目标：r3-pc7hpigy/test_five_fixture_classes-g87eu9vb/target/none
- 原输出：/usr/local/v5-boot-isolation/xattr-fix-test/r3-synthetic-output.txt
- 进程记录：/usr/local/v5-boot-isolation/xattr-fix-test/r3-synthetic-result.json
- 原输出 SHA-256：918876faff6d2fd2f276daf9b0d7b67d0ea9a93a246267415eb60702a9bf4cb3
- 本次 unittest 批次采用默认非 failfast；同一进程运行了其余测试。进程首次返回
  rc=1 后未启动任何后续测试/验收命令。完整原文见 RECEIPT-XATTRFIX-R3.md。

## 保全状态

拆分及授权修复保留为未提交 diff；文件 physical lines 分别为 292 / 314 / 111 /
353，自测定义 320，均 <=500；这是计数观察，不是结构 gate PASS。
原件 974 行仍在 Git c4152e9a45e2f1798807492c73516d924dcaf855，SHA-256=7af63a75ec376816dfa516c72f0edf29605725777c3564511c87ce57f5d47abe。
原15 stage/main字节等价、dry-run diff、Selftest/Consumers、精确commit结构gate和独立最终
候选审查均 NOT_RUN / NOT_COMPLETED。无 commit、push、PR、merge。
零生产接触；所有 xattr/ditto 操作仅针对上述隔离合成树；未执行 executor --execute。
没有重写 R1/R2 停点或治理规则，没有继续修复本次失败。

## 独立停点复核

非作者 `/root/authority_review` 只读核对当前 HEAD/base、失败 :84、10 tests/9ok/1fail、
日志原文与 SHA-256、五份候选文件哈希/行数、cached diff 为空，以及 R1/R2/旧 stage06/
治理文件未改，结论为停点记录准确；未运行测试/xattr/生产访问、未改文件。
该复核只认证 STOPPED/RECEIPT 的准确性，不认证候选通过最终验收；
FROZEN_BLOCKER_UNION=[REQUIRED_GATE_FAILURE: five-fixture batch rc=1]。
