# 网站询问只读合同提案：Workflow 读取 / 负责人解析 / 原问题正文重读（PROPOSED）

Status: PROPOSED — 按本仓 AGENTS 提交原评审；不接受不实现，不授予生产、凭据或业务操作。

对应：ppd Issue#1 五缺口 2/3/4 与 #975 6194148802 提案；归属仓为本仓（原生 Workflow 事实读取面、消息边界、会话/绑定元数据）。

## 合同 A：Workflow 只读读取（详情与业务总览数据源）
- 入口：原本人身份的合法 Workflow 读取面（现有 broker 只读能力），按完整 instance_id 精确查询。
- 返回白名单：instance_id、definition_id/version、current node/visit/stateVersion、owner Principal（绑定解析结果）、节点进入时间、submission/transition 记录（原 ID+时间）、已登记产物引用（path/bytes/sha256，获准范围）。
- 纪律：缺字段逐项 UNKNOWN/NOT_RETURNED；缺节点进入时间不算停滞；不按名称/时间邻近猜关联；分页 keyset+coverage。
- 消费者：Site 业务总览/详情投影（ppd 73e06d4 提案）经获准调用方读取，本合同不直接暴露给网页匿名面。

## 合同 B：负责人解析（Owner Principal → canonical Agent/domain/session）
- 输入：instance_id + node/visit（服务端按原绑定解析）；输出：Owner Principal、canonical Agent ID、enabled、domain、原合法会话（main 存在性为原子元数据）。
- 前端不得提交 Principal/Agent/sessionId/domain 作为授权依据；解析结果是发送前展示与命令绑定的依据。
- 绑定变化（节点/Owner/版本）后旧解析失效，须重解析；无合法解析=精确缺口返回，不换身份/猜对象。

## 合同 C：原问题正文 own-read 重读
- 网站询问的消息正文不由 Site 缓存；Owner 刷新后经 Human→Gateway→native own-read 逐次读取：
  GET 原 Gateway /v1/website-inquiries/requests/{rid}/question → 当前 ACL 校验 → 返回提交时字节+原 message 坐标+时间。
- 失败语义固定码：无权/不存在/已过期；无缓存旁路；分页合同（历史/事件）沿用 Gateway #8 既有 limit/before/cursor 语法并校验 Owner。

## 依赖与顺序
C 依赖 Gateway #8（8672def）transport 与 Auth #89 身份面；A/B 为 ppd 投影（73e06d4）的数据合同。三合同接受前不写产品实现。
