# 既有offline renderer的精确输入来源

v2 `scripts/render-configs.py` 只做离线形状/固定target检查，不验证receipt真实性、签发身份、交付secret或写生产。原owner先独立验证下面三个owning来源的四份receipt（Auth supply、Auth loaded-alignment、DSH/MCP config、Router Binding）的授权、exact hash、freshness与相互绑定，再输出一次公开合成readback；缺任何来源就不运行renderer。不能用模型填写字符串来跨越这些门槛。

| v2 renderer输入键 | v3实际来源 |
|---|---|
| connector_subject | 原DSH/MCP受控config receipt中的稳定UUID；同时等于Auth supply receipt的connector_subject |
| product_principal_id | Auth supply receipt.principal_id，principal_type必须service；与原config唯一绑定 |
| client_id | 同一Auth supply receipt.client_id；与私有MCP文件的public client_id一致 |
| attestation_ref | 同一获批Auth supply的safe receipt引用；此为renderer旧metadata键名，不要求/伪造CSESB attestation |
| source_binding_ref | 原DSH/MCP config receipt引用；此为renderer旧metadata键名，不创建/查询CSESB source-binding |
| auth_contract_digest | 原Auth loaded-alignment receipt所证明的实际MCP候选sourceBundleDigest |
| auth_runtime_digest | 同一loaded-alignment receipt的实际runtimeDigest，与registry/supply依赖一致 |
| binding_receipt_ref | 原Router dedicated Binding真实读回的引用；不是手填bindings.json |
| resource/scope/agent_id/target_principal_id/domain_id/binding_id/runtime_root/communication_scope_id | renderer的固定常量，须与四份owner receipts中对应字段完全相同，不接收用户覆盖 |

原Auth source/DB/loaded runtime及供给readback、原DSH config mapping、原Router Binding分别是不同事实，不能用同一自述JSON替代。合成readback不包含secret/token/verifier，也不改变四份原receipt。renderer保留原SHA256和只写v2 `generated-configs` 新子目录、enabled=false的行为；v3没有重解释任何运行时字段或修改v2字节。若owner receipt不能提供这些确切事实，缺项保持阻断，不生成假值。
