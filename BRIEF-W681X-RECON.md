# BRIEF-W681X-RECON — #681窗口候选四态逐文件对账（installed / PR-pre / PR-post / main）

## 授权
Owner 2026-11-10 指令：绑定实际运行入口、当前安装内容、正确目标制品及已有 overlay；保留现有作者/QA/正确实现。只读普查 + docs PR 不合并。

## 输入（全部已有工件，勿重做）
- installed：sudo 读 /usr/local/libexec/agent-core/app/packages/agent-router/src/（逐文件 SHA256+owner+mode）
- 656367cd 三文件候选：worktrees/w681-staging/staging_*.js（SHA 已核：1e6340b3/53f02f66/ca97f2c4）+ 前像（47693d4d/6e079adc/add4e95e）
- W1 #692：origin/main..refs 或直接用 PR diff（base 90493d543 前的 #692 merge=caller-wait-config 新文件+deadline-config+index+测试；merge commit 90493d543）
- W2 #693：57a8b9c95（8文件：late-reply.js/index/ingress-delivery.js/delivery-failures.js/late-reply-records.js/route-chain.js+测试）
- W3 #694：81883da8c（11文件：+937/-10）
- main：origin/main HEAD

## 任务（逐文件四态表）
对以下并集文件：656367cd 3 文件 + W1/W2/W3 所有非测试 src 文件：
每文件给出：installed SHA / PR-pre SHA / PR-post SHA / main SHA / 分类：
- CLEAN_INCLUDE：installed == PR-pre 且 main == PR-post（PR delta 恰好是缺失部分）
- ALREADY_CURRENT：installed == main
- DRIFT：installed ≠ PR-pre 且 ≠ main（安装基线与 PR 前像有其他漂移——列漂移摘要）
- NEW_FILE_MISSING：main/PR-post 存在而 installed 不存在，且 PR-pre 不存在（新文件安全加）
- CONFLICT_RISK：main 与 PR-post 不同（PR 合并后 main 又动过——列差异来源 commit）

## 结论
- 安全安装清单（CLEAN_INCLUDE + NEW_FILE_MISSING + ALREADY_CURRENT 剔除）
- DRIFT/CONFLICT_RISK 文件：每文件漂移来源一句话
- 656367cd event-correlation 特别核：main 13a207e2 vs 候选 1e6340b3 差异=transport retry 尾巴（是否为唯一差异，逐行核对）
- 输出 BRIEF-W681X-RECON-RESULT.md + 本简报，单 commit push origin census/w681x-file-reconciliation + PR(base main) 不合并；push 失败 bundle /tmp/transfer-w681x.bundle

## 工具指令
sudo 读 installed 文件（sha256/ls）；shell git/gh；禁 MCP github；写后自证。
