# Local recovery consumer fixture

This fixture is intentionally scheduled through `agentcore-cron`, not a chat
channel. The scheduler writes the job to its durable store and the independent
recovery consumer polls the workflow execution-kick outbox. It requires no
Feishu WebSocket, HR admission process, personal user token, or chat projection.

Example (operator shell, local/test store only):

```sh
agentcore-cron add --name workflow-recovery-consumer \
  --every 1s --command 'node scripts/local-recovery-consumer-fixture.mjs'
```

The command is an execution example/acceptance fixture; it does not grant the
consumer authority to transition workflow state. The injected takeover and
original-role acceptance functions remain the only write seams.
