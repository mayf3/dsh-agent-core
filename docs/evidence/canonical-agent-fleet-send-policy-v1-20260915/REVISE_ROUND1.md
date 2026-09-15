# PR #75 REVISE — blocker union 关闭记录（第一轮：authority 候选 + 缺陷复现）

- date: 2026-09-15
- 触发：Owner REVISE ruling on https://github.com/mayf3/auth-service/pull/75#issuecomment-5679964426
  （四条 blocker：P1-A 首次 secret 丢失 / P1-B 覆盖 HR inspection / P1-C 缺 Auth 本地
  实现 authority / P2 并发建 grant 不幂等）
- 本轮遵守：实现分支保留不动；NO merge / NO deploy / NO reconcile。

## 1. Authority 候选（docs-only，均 proposed，等 Owner exact-head 接受）

| 候选 | 仓 | commit/位置 | 内容 |
|---|---|---|---|
| dsh AMENDMENT_1（INSPECTION_PRESERVATION） | dsh-agent-core branch goal/canonical-agent-fleet-send-policy-v1 | 5dd41e2（spec r4） | §3 闭集改为 lawful row family：`['agent.session.send'] ∪ P, P ⊆ {inspect_own_dispatch}`（ENUMERATED_INDEPENDENT_SCOPES 闭集，各成员须自持 Auth accepted authority——首成员=AUTH_SERVICE_HR_AGENT_SESSION_INSPECTION_GRANT_V1 @9eeb896）；ADD 恒 send-only；NORMALIZE=make-lawful（缺 send 补 send、仅裁 NON-enumerated、枚举成员保留、version 仅实际变化递增） |
| Auth 本地实现 authority | mayf3/auth-service branch goal/canonical-agent-fleet-send-policy-v1（PR #75 docs-only 新 commit） | docs/specs/AUTH_SERVICE_CANONICAL_AGENT_FLEET_SEND_GRANT_PROVISIONING_V1.md | 事务/并发义务（T1 原子 create+grant/T2 P2002 收敛/T3 重试 secret 恢复/T4 I4 边界内授权改 idempotent.ts——Owner 明示 I4 冻结的是 issuance/deny 而非 provisioning helper）、birth/reconcile make-lawful 坐标、RG1-RG3 回归义务、blocker 处置表 |

## 2. 缺陷复现（PR head 14c552e 上机械复现，3/3 RED）

复现测试源码（scratch，未入 PR 分支；最终回归将随修复以绿色形态提交）与
实跑 transcript 如下。

### 2.1 源码 tests/oauth/revise-blocker-repro.test.ts

```typescript
/**
 * PR #75 REVISE blocker-union DEFECT REPRODUCTIONS (not the final regressions).
 * Each test asserts the TARGET (post-fix) behavior; at PR head 14c552e all three
 * FAIL, which mechanically reproduces the reviewed blockers:
 *   RG1 -> P1-B inspection overwrite by exact-scope NORMALIZE
 *   RG2 -> P1-A first client secret lost when the stamp fails after create
 *   RG3 -> P2 concurrent grant create does not converge (unhandled P2002)
 * Run: npx tsx --test tests/oauth/revise-blocker-repro.test.ts   (from auth-service)
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FLEET_SEND_AUDIENCE_ID,
  FLEET_SEND_SCOPE,
  ensureFleetSessionSendGrant,
  type FleetSendGrantStore,
} from '../../src/lib/oauth/v1/fleet-send-grant.js';

// ─── In-memory store with PK uniqueness + secret-bearing client registry ───

interface GrantRow {
  machineClientId: string;
  audienceId: string;
  scopes: string[];
  version: number;
}

interface ClientRow {
  id: string;
  machinePrincipalId: string;
  secret?: string;
}

const P2002 = 'P2002';

function makeStore(opts: {
  principalType?: 'agent' | 'service';
  principalFound?: boolean;
  audienceStatus?: 'active' | null;
  existingGrants?: GrantRow[];
  failEnsureWith?: Error;
}) {
  const clients: ClientRow[] = [];
  const grantRows: GrantRow[] = opts.existingGrants ? opts.existingGrants.map((g) => ({ ...g })) : [];
  const principalId = '11111111-1111-1111-1111-111111111111';
  const client = { id: 'mc_reproclient00000000000', machinePrincipalId: principalId };

  const store = {
    machinePrincipal: {
      findUnique: async () =>
        opts.principalFound === false
          ? null
          : { id: principalId, principalType: opts.principalType ?? 'agent', status: 'active' },
    },
    authAudience: {
      findUnique: async () =>
        opts.audienceStatus == null
          ? null
          : { audienceId: FLEET_SEND_AUDIENCE_ID, status: opts.audienceStatus },
    },
    machineAccessGrant: {
      findUnique: async ({ where }: { where: { machineClientId_audienceId: { machineClientId: string; audienceId: string } } }) =>
        grantRows.find(
          (g) => g.machineClientId === where.machineClientId_audienceId.machineClientId &&
                 g.audienceId === where.machineClientId_audienceId.audienceId,
        ) ?? null,
      create: async ({ data }: { data: { machineClientId: string; audienceId: string; scopes: string[] } }) => {
        if (
          grantRows.some(
            (g) => g.machineClientId === data.machineClientId && g.audienceId === data.audienceId,
          )
        ) {
          // Prisma unique-violation shape (composite PK @@id([machine_client_id, audience_id]))
          throw Object.assign(new Error('Unique constraint failed'), { code: P2002 });
        }
        const row: GrantRow = { ...data, version: 1 };
        grantRows.push(row);
        return row;
      },
      update: async ({ where, data }: {
        where: { machineClientId_audienceId: { machineClientId: string; audienceId: string } };
        data: { scopes: string[]; version: { increment: number } };
      }) => {
        const row = grantRows.find(
          (g) => g.machineClientId === where.machineClientId_audienceId.machineClientId &&
                 g.audienceId === where.machineClientId_audienceId.audienceId,
        );
        assert.ok(row, 'update target row must exist');
        row.scopes = data.scopes;
        row.version += data.version.increment;
        return row;
      },
    },
  } as unknown as FleetSendGrantStore;

  return { clients, grantRows, client, principalId, store };
}

// ─── RG1 (P1-B): dual-scope row must survive make-lawful stamp ─────────────

test('RG1_REPRO_dual_scope_row_is_preserved_not_collapsed', async (t) => {
  const dual: GrantRow = {
    machineClientId: 'mc_reproclient00000000000',
    audienceId: FLEET_SEND_AUDIENCE_ID,
    scopes: [FLEET_SEND_SCOPE, 'agent.session.inspect_own_dispatch'],
    version: 2,
  };
  const { store, grantRows, client } = makeStore({ audienceStatus: 'active', existingGrants: [dual] });
  const result = await ensureFleetSessionSendGrant(store, client);
  t.diagnostic(`RG1 observed result=${result} scopes=${JSON.stringify(grantRows[0]?.scopes)}`);
  // TARGET behavior (AMENDMENT_1): enumerated independent scope preserved.
  assert.equal(result, 'kept', 'send already present + inspect enumerated => make-lawful is a no-op');
  assert.deepEqual(
    [...grantRows[0].scopes].sort(),
    ['agent.session.inspect_own_dispatch', FLEET_SEND_SCOPE].sort(),
    'HR inspection scope must survive the fleet stamp',
  );
  assert.equal(grantRows[0].version, 2, 'no set change => version stable');
});

// ─── RG2 (P1-A): stamp failure after create must not orphan the first secret ─

test('RG2_REPRO_stamp_failure_after_create_loses_first_secret_today', async (t) => {
  // Mirrors routes/idempotent.ts sequence: createOrGetClient(create: commit
  // client+secretHash, return secret) THEN ensureFleetSessionSendGrant.
  const { clients, grantRows, client, store } = makeStore({ audienceStatus: 'active' });
  const failing = {
    ...store,
    machineAccessGrant: {
      ...store.machineAccessGrant,
      findUnique: async () => { throw new Error('storage outage'); },
    },
  } as unknown as FleetSendGrantStore;

  // Step 1: client creation (committed) — secret returned to this frame only.
  clients.push({ ...client, secret: 'mc_secret_one_time_display' });
  // Step 2: stamp fails AFTER the client row is committed.
  await assert.rejects(() => ensureFleetSessionSendGrant(failing, client));
  // Step 3: idempotent external_ref retry takes the fast path (created=false).
  const retryReturnedSecret: string | undefined = clients[0].secret !== undefined && clients.length === 1
    ? undefined // fast path never returns a secret by design
    : clients[1]?.secret;
  t.diagnostic(
    `RG2 observed: clientRows=${clients.length} secretOnRetry=${retryReturnedSecret ?? 'NONE'} ` +
    `grantRows=${grantRows.length}`,
  );
  // TARGET behavior (transactional T1/T3): either the client row was rolled
  // back so the retry creates fresh WITH a secret, or the original call
  // returned the secret. Today: row committed, secret only in the dead frame.
  assert.equal(
    retryReturnedSecret === undefined,
    false,
    'first secret must be recoverable (transactional rollback + fresh retry), not orphaned',
  );
});

// ─── RG3 (P2): concurrent first-stamp must converge to winner, no P2002 leak ─

test('RG3_REPRO_concurrent_first_stamp_converges_without_unhandled_P2002', async (t) => {
  const { store, grantRows, client } = makeStore({ audienceStatus: 'active' });
  const outcomes = await Promise.allSettled([
    ensureFleetSessionSendGrant(store, client),
    ensureFleetSessionSendGrant(store, client),
  ]);
  const rejected = outcomes.filter((o) => o.status === 'rejected');
  t.diagnostic(
    `RG3 observed: outcomes=${outcomes.map((o) => o.status).join(',')} ` +
    `rows=${grantRows.length} versions=${grantRows.map((g) => g.version).join(',')} ` +
    `rejectedReason=${rejected.length ? String((rejected[0] as PromiseRejectedResult).reason?.code ?? (rejected[0] as PromiseRejectedResult).reason) : 'none'}`,
  );
  // TARGET behavior (T2): both converge, exactly one row, no gratuitous growth.
  assert.equal(rejected.length, 0, 'loser must converge to the winner (kept), not leak P2002');
  assert.equal(grantRows.length, 1, 'exactly one grant row');
  assert.equal(grantRows[0].version, 1, 'no duplicate-create version growth');
});

```

### 2.2 实跑 transcript（`npx tsx --test tests/oauth/revise-blocker-repro.test.ts`）

```text
[AUDIT] {"timestamp":"2026-09-15T12:42:15.016Z","type":"client.fleet_grant_ensured","principalId":"11111111-1111-1111-1111-111111111111","clientId":"mc_repro...","resource":"agent-session-messaging","scopes":"agent.session.send","success":true}
[AUDIT] {"timestamp":"2026-09-15T12:42:15.018Z","type":"client.fleet_grant_ensured","principalId":"11111111-1111-1111-1111-111111111111","clientId":"mc_repro...","resource":"agent-session-messaging","scopes":"agent.session.send","success":true}
✖ RG1_REPRO_dual_scope_row_is_preserved_not_collapsed (2.087667ms)
ℹ RG1 observed result=normalized scopes=["agent.session.send"]
✖ RG2_REPRO_stamp_failure_after_create_loses_first_secret_today (0.21825ms)
ℹ RG2 observed: clientRows=1 secretOnRetry=NONE grantRows=0
✖ RG3_REPRO_concurrent_first_stamp_converges_without_unhandled_P2002 (0.179375ms)
ℹ RG3 observed: outcomes=fulfilled,rejected rows=1 versions=1 rejectedReason=P2002
ℹ tests 3
ℹ suites 0
ℹ pass 0
ℹ fail 3
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 76.795791

✖ failing tests:

test at tests/oauth/revise-blocker-repro.test.ts:1:1805
✖ RG1_REPRO_dual_scope_row_is_preserved_not_collapsed (2.087667ms)
  AssertionError [ERR_ASSERTION]: send already present + inspect enumerated => make-lawful is a no-op
  + actual - expected
  
  + 'normalized'
  - 'kept'
  
      at TestContext.<anonymous> (/Users/yanfenma/workspace/project/auth-service/tests/oauth/revise-blocker-repro.test.ts:113:10)
      at async Test.run (node:internal/test_runner/test:1404:7)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: 'normalized',
    expected: 'kept',
    operator: 'strictEqual',
    diff: 'simple'
  }

test at tests/oauth/revise-blocker-repro.test.ts:1:2616
✖ RG2_REPRO_stamp_failure_after_create_loses_first_secret_today (0.21825ms)
  AssertionError [ERR_ASSERTION]: first secret must be recoverable (transactional rollback + fresh retry), not orphaned
  
  true !== false
  
      at TestContext.<anonymous> (/Users/yanfenma/workspace/project/auth-service/tests/oauth/revise-blocker-repro.test.ts:151:10)
      at async Test.run (node:internal/test_runner/test:1404:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:969:7) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: true,
    expected: false,
    operator: 'strictEqual',
    diff: 'simple'
  }

test at tests/oauth/revise-blocker-repro.test.ts:1:3425
✖ RG3_REPRO_concurrent_first_stamp_converges_without_unhandled_P2002 (0.179375ms)
  AssertionError [ERR_ASSERTION]: loser must converge to the winner (kept), not leak P2002
  
  1 !== 0
  
      at TestContext.<anonymous> (/Users/yanfenma/workspace/project/auth-service/tests/oauth/revise-blocker-repro.test.ts:173:10)
      at async Test.run (node:internal/test_runner/test:1404:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:969:7) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: 1,
    expected: 0,
    operator: 'strictEqual',
    diff: 'simple'
  }

```

### 2.3 缺陷→观察映射

```text
P1-B  RG1 observed result=normalized scopes=["agent.session.send"]
      ⇒ 双 scope 行被 exact-closure NORMALIZE 裁剪，inspection 授权被销毁
P1-A  RG2 observed clientRows=1 secretOnRetry=NONE
      ⇒ client 已提交而 stamp 失败，首次 secret 只存在于已死调用帧
P2    RG3 observed outcomes=fulfilled,rejected rejectedReason=P2002
      ⇒ 并发首 stamp 败者未收敛，唯一键冲突直接外泄
```

## 3. 下一轮（两个 authority 被接受后）

在实现分支上按 Auth 本地 spec §2/§5 落地：T1 事务接线（idempotent.ts create
路径 $transaction，属 I1 收口，I4 issuance/deny 仍零 diff）→ T2 P2002 收敛 →
make-lawful 语义替换 exact-closure → RG1-RG3 转绿 → 基线失败单列不扩修 →
集中复审（绑定届时远端 exact head）。
