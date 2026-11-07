# 现有 validator 隔离诊断（非未来控制资格）

在本任务 worktree 根目录用 `python3` 执行下列代码，实际 stdout 见 [control-probe-result.json](control-probe-result.json)。仅 AST 选定纯函数，不导入原模块，不执行其顶层路径初始化或任何生产阶段；合成 writer_uid=502 不代表真实角色。

```python
from pathlib import Path
import ast, datetime as dt, hashlib, json, re
p = Path("scripts/fleet-window/window_helper_core.py")
source = p.read_bytes()
module = ast.parse(source)
names = {"require", "stamp", "validate_authority"}
selected = ast.Module(body=[n for n in module.body if isinstance(n, ast.FunctionDef) and n.name in names], type_ignores=[])
namespace = {"dt": dt, "re": re}
exec(compile(selected, "<AST-only-window-authority-probe>", "exec"), namespace)
base = dict(window_id="SYNTHETIC_NOT_AUTHORIZATION", writer="synthetic-writer", writer_uid=502,
    valid_from="2026-11-04T00:00:00Z", valid_until="2026-11-05T00:00:00Z",
    expected_old_pid=1, expected_old_identity="SYNTHETIC_NOT_PROCESS",
    expected_old_sha="23fb91a690b0a7182ae3ae4bc388c4e3679d4cc9",
    expected_plist_sha256="0"*64, expected_harness_stamp="SYNTHETIC",
    expected_bindings_sha256="0"*64, expected_runtime_uid=505, expected_runtime_gid=601,
    scopes=["source_lockfile_cleanup","production_mutex","bootout","full_preimage","install",
            "plist_deployed_sha_only","bootstrap","verify","hr_observe"])
cases = [
    ("no_appointment_or_captain", dict(base)),
    ("extra_forbidden_scope", dict(base, scopes=base["scopes"]+["grant_secret_change"])),
    ("self_asserted_nonexistent_expired_appointment", dict(base, issuerPrincipal="SELF_ASSERTED_CAPTAIN",
         appointmentRef="NONEXISTENT", appointment_valid_until="2020-01-01T00:00:00Z")),
    ("expired_window_control", dict(base, valid_until="2026-11-04T00:00:00Z"))]
results = []
for name, item in cases:
    try:
        namespace["validate_authority"](item, writer_uid=502, now_epoch=namespace["stamp"]("2026-11-04T12:00:00Z"))
        results.append({"case": name, "result": "ACCEPTED_BY_PURE_VALIDATOR"})
    except RuntimeError as e:
        results.append({"case": name, "result": "REJECTED_BY_PURE_VALIDATOR", "reason": str(e)})
assert [x["result"] for x in results] == ["ACCEPTED_BY_PURE_VALIDATOR"]*3 + ["REJECTED_BY_PURE_VALIDATOR"]
print(json.dumps({"source": str(p), "source_sha256": hashlib.sha256(source).hexdigest(),
    "method": "AST extraction of require/stamp/validate_authority only; module not imported",
    "production_calls": 0, "network_calls": 0, "executed_at_scope": "isolated synthetic pure functions",
    "results": results, "limitation": "Not full executor, actual admission, production effect or future-control qualification"}, ensure_ascii=False, indent=2))
```
