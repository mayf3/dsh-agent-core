# Independent gate readback — R2

Returned by `/root/independent_audit` after read-only inspection of actual logs. No test execution, code/environment mutation or new source review by this reviewer.

```text
REVIEW_TARGET = 0f25ce5270c0964476184af509c5857acbdf1527
VERIFICATION_TREE = 63534a3f954004da8967cd1284df8915d11d5603
BRANCH_HEAD = 91e224bc079f26cef285cba6da0872cb640ed330
CONTRACT_REVIEW = PASS (unchanged source review)
603-REVIEW-001 = CLOSED
REQUIRED_GATE_RESULT = FAIL
BLOCKER_CLASS = REQUIRED_GATE_FAILURE
PUSH_READY = NO
MERGE_READY = NO
NEXT_ACTION = STOP
```

结构门实际rc0：0 candidate violations，28 visible baseline debt；不是全仓无债。changed-runtime实际rc1：40 tests，27 pass，13 fail。13项均为 `HTTP_PROXY: runtime_proxy_env_present`，在compose挂载前被既有guard拒绝，不能据此断言产品回归。

新增V2零写负向实际通过：前后SHA256均为 `10cb327a7c7b62afc2dbbb71e868daece061cd36a9df6e768427017dadf039df`，mutation=0、upgrade=0，目录全部文件hash不变。malformed→UNKNOWN、异步纯读OFF/stop、排队OFF、stop拒绝tick/等receipt、三态evidence、termination-only保持UNKNOWN、late business append、aggregate fence用例实际通过。composition drain被环境guard拒绝，没有验证其内部drain assertions。

Scheduler、Scheduler-Router、EKR/B2及后续门NOT_RUN。stdout SHA256 `e85b02077794a5111c30c28446d10e21b66e63b2bda9a089c0912ae22c543814`，stderr空，SHA256 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`。产品diff仍为先前审查的 `0648557ec25d8be06447fff0b29ff9af61bc234ab0fcaa5170fcc3f333c0b5ad`。

阻断来源为Owner/ASSESSMENT的变化门rc0及失败即停要求。最小后续闭合须续行授权下采用无recognized proxy环境键且Node=v25.6.1的隔离测试环境，保留既有guard；重跑失败门后续未运行门。本轮先因HTTP_PROXY拒绝，实测Node=v26.7.0与源码要求v25.6.1的差异是下一前置条件，不是第二项已执行失败。
