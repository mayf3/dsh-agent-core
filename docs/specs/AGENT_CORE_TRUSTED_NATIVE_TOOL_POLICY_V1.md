---
spec_id: AGENT_CORE_TRUSTED_NATIVE_TOOL_POLICY_V1
status: accepted
accepted_date: 2026-10-28
accepted_by: Owner-delegated Codex (/root)
accepted_reviewed_head: 3bf9e9d4f58bd198161cf3046c54645ef25f5002
acceptance_review_verdict: PASS
acceptance_authority_basis: >-
  User-delegated design authority covers establishment of the generic
  mechanism and leaves this design choice to the delegated agent (“接受，
  全权交给你定就行”); the user also authorized continued work on the
  generic underlying mechanism/workflow with Luna preference. Root selected
  this narrow opt-in native-tool-channel policy and bounded it to trusted
  startup identity+digest, final DSH native dispatch enforcement, explicit
  fail-closed behavior, and no production changes. Trial-ops independently
  reviewed the paired Core Spec and DSH Note at exact document hashes pinned
  by manifest 59609e370098bb2586a1fb7628361701ea0a341d2ff0acea92124e96f5711465
  (PASS). Root performed HEAD-SPECIFIC acceptance for reviewed Core head
  3bf9e9d4f58bd198161cf3046c54645ef25f5002 and paired DSH head
  3910d108a430a30fe019aedd98566cd2d0f117b4. This acceptance record does not
  claim that the user personally reviewed these exact heads.
date: 2026-10-28
implementation_authority: contracts
paired_runtime_authority: deepseek-harness Agent Note 2026-10-28-trusted-native-tool-policy
---

# Agent Core Trusted Native Tool Policy V1

## DEVELOPMENT_PREFLIGHT

```text
Problem = Workflow role text and declared capabilities do not restrict native dispatch; A43 dev used a native write tool for an Owner-owned repair.
Governing Spec = AGENT_CORE_HARDENING_PROGRAM_V1 (accepted; program-level only, implementation_authority none).
Spec status = accepted at reviewed head 3bf9e9d4f58bd198161cf3046c54645ef25f5002; implementation authority is limited to the Contracts below and the recorded scope.

Relevant investigations = A43 task-local runtime/config and native-candidate inspection (task-local evidence only; no repository investigation path is asserted).
Relevant decisions = AGENT_CORE_PRODUCT_ARCHITECTURE_V1; AGENT_CORE_HARDENING_PROGRAM_V1 cooperative shared-host trust model.
Previously rejected alternatives = No formal rejected proposal found. Prompt/capability declarations are not dispatch enforcement; A43 is new evidence.

Frozen boundaries = Agent Definition remains identity/display only; Agent Core remains the thin process owner; exact stable agentId and trusted policy digest bind each opted-in process generation; no model/role self-assertion; no legacy behavior change when policy is absent; no production, credential, OS-isolation, or general-IAM changes.

Implementation scope = Add opt-in trusted per-agent native tool allowlist delivery from Agent Core process startup to DSH initialize; DSH enforces the policy at final ToolRuntime dispatch for global and scoped tools and Code Mode; reject malformed, unsupported, mismatched, or unknown policy before model work.
Out-of-scope = OS/container isolation, malicious plugin or arbitrary Node defense, generic IAM/policy platform, path ACL redesign, Broker grant changes, production rollout, credentials, role inference from names or messages.

New evidence = A43 used native write despite its role text; frozen candidate has scope-local restrictions and Code Mode transport behavior that require a final-dispatch policy, not schema-only filtering.

Need new/amended Spec = YES
```

## 1. Purpose and authority

This Spec authorizes one opt-in control-plane-to-runtime contract for limiting the native tools available to a trusted Agent instance. A task-local A43 runtime showed that role instructions and capability declarations do not prevent a native write call. The existing [Agent Core Hardening Program](AGENT_CORE_HARDENING_PROGRAM_V1.md) keeps same-host Agents in a cooperative trust domain and does not authorize adversarial process isolation; this Spec stays within that limit.

The accepted [Agent Core product architecture](../AGENT_CORE_PRODUCT_ARCHITECTURE_V1.md) assigns process lifecycle to Agent Core and tool execution to DSH. Accordingly, this contract is paired with the DSH proposal `2026-10-28-trusted-native-tool-policy` in `deepseek-harness/.agents/notes/proposed/feature/`. Both sides must be independently reviewed and merged before implementation starts. The ACore implementation must not edit this governing Spec.

Root's delegated scope for this Spec is limited to trusted startup configuration, one native initialization handoff, final native tool dispatch enforcement, and deterministic tests. It authorizes no production operation or credential access.

## 2. Trusted policy input

The policy is optional and is supplied only by the trusted Agent Core process-composition resolver for an exact stable `agentId`. It is not part of an Agent Definition identity/display document, a route-chain or task override, a prompt, a workflow payload, a session file, a provider response, or a model-supplied role claim.

The wire value is versioned and immutable for one process generation:

```json
{
  "version": 1,
  "agentId": "agt_example",
  "mode": "native-allowlist",
  "allowedCalls": [
    { "toolName": "read" },
    { "toolName": "glob" },
    { "toolName": "workflow", "argumentEquals": { "operation": "read" } }
  ],
  "policyDigest": "<sha256-of-canonical-policy-without-policyDigest>"
}
```

The example names illustrate the format only; each deployment chooses exact registered tool names and exact operation selectors. “Read-only” describes local file/process capabilities, not every business operation: a task policy may explicitly allow a workflow transition or assistance-open operation when that operation is required by the task. `allowedCalls` is an exact positive list: no wildcard, prefix, role-name, or implicit category matching. `argumentEquals` matches the named top-level own-properties of the call arguments by RFC 8785 canonical JSON value equality; extra argument properties are permitted only when the registered tool contract declares those selector keys to fully determine the operation. Otherwise the selector must match the complete argument object or be rejected. The selector keys must be known, reliable operation discriminators in the existing tool contract; missing, ambiguous, malformed, or unsupported operation selectors fail closed. Policy validation rejects duplicate or overlapping selectors for the same tool name. An unrecognized or newly registered tool is denied unless a trusted policy explicitly names it.

`policyDigest` is SHA-256 over RFC 8785 JSON Canonicalization Scheme bytes for the policy object with `policyDigest` omitted. Agent Core binds the digest to the same `agentId` sent in the native initialization request. DSH recomputes it, checks the identity against its trusted process identity, and returns an initialization acknowledgement containing the same version, `agentId`, and digest. A missing, unsupported, malformed, wrong-agent, or wrong-digest policy is an initialization failure before any model request; an opted-in process must never fall back to the legacy unrestricted mode.

The resolved policy and digest are frozen onto the process generation. Process reuse is valid only for the same `agentId` and digest. A policy change requires a new process generation through the existing lifecycle; no in-place policy mutation is introduced.

## 3. Enforcement semantics

For an opted-in process, every model-originated call through the DSH native tool dispatcher must match exactly one `allowedCalls` selector immediately before the tool body can begin. This check applies to deployment-global tools, ancestor-scope tools, scope-local tools, and tools reached through nested native dispatch. A scoped registration does not bypass the policy; a new or unknown tool does not become allowed merely because it is registered inside the current scope.

The native tool view and model schema should reflect the same effective allowlist, but schema hiding is presentation only. The final dispatch check is authoritative: direct calls to `tools.execute`, pre-execute listeners, Code Mode, or nested Code Mode dispatch cannot make an unlisted call execute. `run_code` is denied by the read-only native policy itself, including direct dispatch; filtering its schema alone is insufficient. `write`, `edit`, `bash`, and every other unlisted execution or mutation tool are denied before their handler runs.

For Broker tools with an operation selector, authorization matches both the exact tool name and the exact selected operation. This native allowlist supplements and does not replace the existing trusted Broker gateway authorization. Business operations that change workflow state are not implicitly forbidden by the local read-only tool policy; they require an explicit exact selector. A denial is a structured tool denial/unknown-tool outcome, records no successful tool result, and invokes no tool handler or Broker request.

The native runtime must reject a dispatch whose authenticated runtime Agent identity is absent or differs from the policy's `agentId`. The model cannot choose or change that identity. Child scopes inherit the process policy; they may narrow their visible tool list but cannot widen the final dispatch allowlist.

## 4. Compatibility and repair

When no policy is configured, Agent Core sends no policy field and DSH preserves current behavior exactly. This opt-in does not change existing profiles, agents, sessions, or default tool presentation.

An Owner process may remain on the legacy path or receive a separate trusted policy that explicitly allows the repair tools it needs. There is no hard-coded Owner name or role exception, and the dev read-only policy cannot be widened by a message, workflow text, subagent request, or same-name scoped registration.

## 5. Limits

This contract limits calls made through the DSH native tool dispatcher. It does not isolate arbitrary plugin code, direct in-process service calls, malicious extensions, native modules, operating-system processes, or another runtime sharing the host identity. Installed plugins and the trusted policy source remain part of the cooperative trust domain. The existing filesystem sandbox remains the path boundary; this Spec adds no path policy. The policy does not grant, revoke, or reinterpret Broker capabilities.

## 6. Relevant source and evidence

- Agent Core process composition and native initialization: `packages/agent-router/src/process-registry.js` and `packages/agent-router/src/process/agent-process.js`.
- Agent Definition's identity/display-only schema: `packages/agent-definition/src/definition.js`.
- DSH final dispatch and scoped guards: frozen native candidate `9d8678057be9bdbcc37b640ad8cb18279dc5f971`, `packages/core/tools/src/index.ts` (`guard`, `restrict`, and execution resolution) and `packages/core/tools/src/code-mode.ts`.
- Existing scoped filtering limitation: DSH `docs/subsystems/tools.md` and Agent Note `2026-07-12-subagent-persona-tool-filter-and-depth`.
- Existing Code Mode transport limitation: DSH Agent Note `2026-06-15-code-mode`.
- Runtime observation motivating opt-in: task-local A43 audit artifacts under `/Users/yanfenma/workspace/artifacts/workflow-unattended-mechanisms-20261027/e2e-runs/trial-20261027-a43`; no session body or credential content is used by this Spec.

## 7. Acceptance criteria

1. A trusted process configuration binds one exact `agentId` to a versioned allowlist and digest; display names, roles in messages, and task/user fields cannot select or modify it.
2. Agent Core sends the policy only from the trusted startup resolver and freezes it for the process generation. The native runtime verifies identity and digest and acknowledges the exact pair before model work.
3. An opted-in process fails initialization on missing/unknown/unsupported policy, unknown tool selector, invalid operation selector, identity mismatch, or digest mismatch; none falls back to unrestricted behavior.
4. A deterministic no-model test proves the local read-only policy permits configured `read`, `glob`, and explicitly selected task Broker operations (including a required transition/open when configured), while denying `write`, `edit`, `bash`, `run_code`, unknown tools, disallowed or ambiguous Broker operations, and unlisted scope-local calls before any handler side effect.
5. The same tests prove direct dispatcher calls and nested/native code paths cannot bypass the policy; schema visibility is not used as the sole proof.
6. An Owner test proves its separate trusted configuration can still perform an explicitly allowed repair write; the legacy absent-policy path is unchanged.
7. The policy remains bound to the same exact Agent identity/digest across process reuse and is not mutable from model-visible input.
8. Agent Core and DSH tests are isolated and deterministic; no model, service, production process, credential, or A43/A44 runtime is used.

## 8. Short implementation plan

1. Agent Core: resolve the optional policy from trusted per-Agent startup configuration, canonicalize and digest it, bind it into process identity, pass it in native initialization, and refuse reuse/initialization when the acknowledgement differs.
2. DSH: verify the initialization policy, attach a per-Agent allowlist projection plus monotonic final-dispatch guard, and apply the guard to global, scoped, direct, and Code Mode calls.
3. Tests: use fake registered tools with side-effect counters to prove allowed/denied behavior and exact handshake binding in both repositories; retain one legacy no-policy test and one Owner repair test.
4. Independent review: review the paired ACore Spec and DSH Agent Note together before either implementation PR begins.

## 9. Status

```text
SPEC_STATUS = accepted
IMPLEMENTATION_AUTHORITY = contracts
ROOT_SCOPE_RULING = paired trusted-config/native-dispatch contract only
PRODUCTION_CHANGE = NONE
OS_ISOLATION = NONE
GENERIC_IAM = NONE
```
