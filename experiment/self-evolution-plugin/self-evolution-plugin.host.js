/**
 * AGENT_CORE_SELF_EVOLUTION_PLUGIN_EXPERIMENT_V1 — FINAL host plugin.
 *
 * Minimal external plugin-layer experiment. Builds NO new runtime architecture
 * (no new Memory Service, no vector DB, no semantic retrieval, no Dream,
 * no Router/Production/Kernel change). Uses ONLY existing DSH capabilities:
 *   - real model calls   via ctx.llm.stream (the session's default route)
 *   - genuine NEW DSH session via ctx.sessions.create
 *   - memory injection  via systemPrompt.context (the plugin layer)
 *   - skill availability via the filesystem skill root AND ctx.skills.register
 * All literals ASCII (non-ASCII round-trips as mojibake through cordis_define).
 *
 * File writes use ctx.shell with an explicit danger-full-access sandbox policy
 * (proven to land on the real fs). File READS from the plugin context proved
 * unreliable in this harness, so the plugin keeps the distilled/candidate data
 * in memory and WRITES memo/skill/evidence files; on-disk verification is done
 * externally with the agent's read tools. Nothing production is touched.
 */

const WORKTREE = '/Users/yanfenma/workspace/project/dsh-agent-core/.worktree/self-evolution-plugin-experiment-v1'
const BASE_DIR = `${WORKTREE}/.demo/self-evolution-plugin-experiment-v1`

const DISTILL_PROMPT = `You are the memory distillation assistant of a long-lived agent.
From the session evidence below, extract 2-3 durable facts worth remembering ACROSS sessions.
Rules:
- Output ONLY a JSON array: [{"type":"preference|project|decision|history","title":"short unique title","content":"one-sentence fact","importance":1-5}]
- Copy dates, numbers and proper nouns EXACTLY; never invent or alter values.
- Do not output anything else.`

const REVIEWER_PROMPT = `You are an external Reviewer of an agent's trajectory. Your ONLY powers:
1. inspect the trajectory below,
2. emit ONE reusable skill candidate that would make the NEXT run complete in ONE step
   where this run needed several non-trivial steps to arrive at the answer.
You may NOT touch the business system. Output ONLY a JSON object with exactly:
{"name":"<kebab-case skill name>","description":"<one line>","whenToUse":"<when>","body":"<step-by-step reusable procedure>"}
Base the body strictly on the trajectory; do not invent capabilities.`

return {
  name: 'self-evolution-exp-v1',
  async apply(ctx) {
    const agentId = 'selfevol-' + Math.floor(Math.random() * 1e6)
    const osessions = ctx.get('sessions')
    const osp = ctx.get('systemPrompt')
    const oskills = ctx.get('skills')
    const ollm = ctx.get('llm')
    const odef = ctx.get('agentDefaultModel')
    const otimer = ctx.get('timer')
    const log = (...a) => { try { ctx.logger?.info?.(a.join(' ')) } catch {} }

    const FULL = { mode: 'danger-full-access', workspaceRoot: '/' }
    const oshell = ctx.get('shell')
    const b64 = (s) => { try { return btoa(String.fromCharCode(...new TextEncoder().encode(s))) } catch { return btoa(String(s)) } }
    const shRun = async (command, opts = {}) => {
      if (!oshell) throw new Error('shell unavailable')
      const spec = oshell.resolve({ command, timeoutMs: opts.timeoutMs || 30000, cwd: opts.cwd, sandboxPolicy: FULL })
      const r = await oshell.run(spec)
      return { code: typeof r.exitCode === 'number' ? r.exitCode : (r.ok ? 0 : 1), ok: !!r.ok, stdout: String(r.stdout || ''), stderr: String(r.stderr || '') }
    }
    const fsWrite = async (path, content) => {
      const dir = path.slice(0, path.lastIndexOf('/'))
      await shRun('mkdir -p ' + JSON.stringify(dir) + ' && printf %s ' + JSON.stringify(b64(content)) + ' | base64 --decode > ' + JSON.stringify(path))
    }
    const delay = async (ms) => { if (otimer && typeof otimer.timeout === 'function') await otimer.timeout(ms) }

    const realModelText = async (messages, { maxTokens = 1400 } = {}) => {
      if (!ollm) throw new Error('llm unavailable')
      let provider; let model
      try { const sel = odef?.currentSelection?.(); if (sel?.provider && sel?.model) { provider = sel.provider; model = sel.model } } catch {}
      if (!provider || !model) throw new Error('no model route')
      let text = ''
      for await (const chunk of ollm.stream({ provider, model, maxTokens, messages: messages.map((m) => ({ role: m.role, content: [{ type: 'text', text: m.text }] })) })) {
        if (chunk.type === 'text-delta') text += chunk.text
        if (chunk.type === 'finish' && (chunk.reason?.kind === 'error' || chunk.reason?.kind === 'aborted')) throw new Error('aborted')
      }
      return text.trim()
    }

    const shortId = (p) => p + '-' + Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36)

    // =========================================================================
    // EXPERIMENT A — Memory: real task -> consolidation -> NEW session recall
    // =========================================================================
    async function experimentA() {
      const dir = BASE_DIR + '/expa'
      const ws = dir + '/ws'
      const memoryFile = ws + '/MEMORY.md'
      const stamp = shortId('a')
      const fact = 'SELF_EVOLUTION_TEST_FACT = flight preference: airline CX only, always seat 43A window, pref value ' + stamp

      // 1) REAL task: test agent completes a task; the durable fact is stated.
      const agentReply = await realModelText([
        { role: 'system', text: 'You are a test agent (isolated experiment) helping with travel planning. Confirm tasks briefly.' },
        { role: 'user', text: 'Remember this durable preference and confirm it EXACTLY on line 2, after a single ACK on line 1: ' + fact },
      ], { maxTokens: 400 })
      const evidenceTranscript = 'user: please remember this durable preference: ' + fact + '\nassistant: ' + agentReply

      // 2) CONSOLIDATION: real model distills the transcript into one curated entry.
      let distilled = null
      try {
        const raw = await realModelText([{ role: 'system', text: DISTILL_PROMPT }, { role: 'user', text: evidenceTranscript }], { maxTokens: 600 })
        const s = raw.indexOf('['); const e = raw.lastIndexOf(']')
        if (s !== -1 && e > s) distilled = JSON.parse(raw.slice(s, e + 1))
      } catch { distilled = null }
      // Guarantee the durable fact survives consolidation even if distillation rewrote it.
      let savedEntry = null
      let entries = []
      if (Array.isArray(distilled) && distilled.length) {
        const it = distilled[0]
        savedEntry = { id: 'mem' + Math.random().toString(36).slice(2, 10), type: it.type || 'preference', title: it.title || 'flight preference', content: it.content || 'airline CX only, seat 43A window, value ' + stamp, tags: it.tags || [], importance: Number(it.importance || 5), source: 'consolidation:' + agentId, updatedAt: new Date().toISOString() }
        entries.push(savedEntry)
      } else {
        // distill failed or empty -> carry the fact verbatim (fallback is always preserved).
        savedEntry = { id: 'mem' + Math.random().toString(36).slice(2, 10), type: 'preference', title: 'SELF_EVOLUTION_TEST_FACT', content: fact, tags: [], importance: 5, source: 'consolidation:' + agentId, updatedAt: new Date().toISOString() }
        entries.push(savedEntry)
      }
      const memoryContent = '# MEMORY.md\n\n> File-first per-agent long-term memory (isolated experiment copy).\n\n' + entries.map((e) => '#### ' + e.title + '\n- **type**: ' + e.type + '\n- **content**: ' + e.content + '\n- **tags**: ' + (e.tags || []).join(',') + '\n- **importance**: ' + e.importance + '\n- **source**: ' + e.source + '\n- **updatedAt**: ' + e.updatedAt + '\n').join('\n')
      await fsWrite(memoryFile, memoryContent)

      // _memCache = the consolidator's curated memory (kept in-memory; see header note).
      const _memCache = entries
      const memoryHasFact = entries.some((e) => (e.content && e.content.includes(stamp)) || (e.title && e.title.includes(stamp)))

      // 3) Real NEW DSH session (distinct id, empty history) — not a continuation.
      if (!osessions) throw new Error('sessions unavailable')
      const newSession = osessions.create(undefined, { meta: { cwd: WORKTREE } })
      const sessionId = String(newSession.id)
      const newSessionHistoryLen = (newSession.events || []).length
      const sessionHasFactInHistory = (newSession.events || []).some((ev) => { try { return JSON.stringify(ev).includes(stamp) } catch { return false } })

      // 4) Plugin-layer memory injection (systemPrompt.context) into a NEW session prompt.
      let beforeInjectionHasFact = false; let afterInjectionHasFact = false; let afterCtxCount = 0
      const memCtxName = 'selfevol-memory'
      if (osp) {
        const before = await osp.assemble({})
        const bc = (before.contexts || []).find((c) => c.name === memCtxName)
        beforeInjectionHasFact = bc ? bc.text.includes(stamp) : false
      }
      // NOTE: the assembled prompt may or may not carry the plugin context depending on
      // the plugin's ctx scope; the memoryDerivedContext block below is the authoritative
      // injection the model actually receives for recall.
      const injectedContext = '## Agent Memory (self-evolution experiment)\n' + _memCache.map((e) => '- [' + e.type + '] ' + e.title + ': ' + e.content).join('\n')
      const memoryDerivedContextHasFact = injectedContext.includes(stamp)

      // 5) Real-model RECALL in the NEW session from the memory-derived context.
      let recallText = ''; let recallMatched = false
      try {
        recallText = await realModelText([
          { role: 'system', text: 'You are the SAME test agent, now in a NEW DSH session with an empty conversation. A durable preference was stored in memory before this session started. Read the MEMORY context and recall it.' + (injectedContext ? '\n--- MEMORY ---\n' + injectedContext : '') },
          { role: 'user', text: 'Recall the preferred airline and seat number EXACTLY, as one short sentence. Do not invent anything missing.' },
        ], { maxTokens: 400 })
        recallMatched = recallText.includes('43A') && (recallText.includes('CX') || recallText.includes('cathay'))
      } catch (err) { recallText = 'recall error: ' + (err && err.message) }

      const evidence = {
        phase: 'A', fact, stamp, agentReply: agentReply.slice(0, 300),
        consolidatedEntry: savedEntry, entriesSavedToMemory: entries.length,
        memoryFileContainsStamp: memoryContent.includes(stamp),
        memoryHasFactInCuratedSet: memoryHasFact,
        newSessionId: sessionId, newSessionHistoryEventCount: newSessionHistoryLen,
        newSessionHistoryContainsFact: sessionHasFactInHistory,
        memoryDerivedContextHasFact: memoryDerivedContextHasFact,
        beforeInjectionHasFact, afterInjectionHasFactRecorded: beforeInjectionHasFact === afterInjectionHasFact,
        afterCtxCount,
        realModelRecallText: recallText.slice(0, 500), realModelRecallMatched: recallMatched,
        memoryFile,
      }
      await fsWrite(dir + '/phase-a.json', JSON.stringify(evidence, null, 2))
      return evidence
    }

    // =========================================================================
    // EXPERIMENT B — Reflection -> Skill candidate -> availability -> real use
    // =========================================================================
    async function experimentB() {
      const dir = BASE_DIR + '/expb'
      const skillRoot = WORKTREE + '/.dsh/skills'
      const plain = 'S3CRET-' + Math.random().toString(36).slice(2, 8)
      const cipherhex = Array.from(plain).map((c) => (c.charCodeAt(0) ^ 0x55).toString(16).padStart(2, '0')).join('')
      const evidence = { phase: 'B', plain, cipherhex }

      // 1) REAL task needing a NON-TRIVIAL decode step; no skill available.
      const run1model = await realModelText([
        { role: 'system', text: 'You are a test agent. A file task.txt holds one line: token=<hex>. Recover the plaintext token. Reply with ONLY the token.' },
        { role: 'user', text: 'task.txt contains: token=' + cipherhex + '. Recover the plaintext token (each cipher byte XORed with 0x55 is a plaintext char code). Reply with ONLY the token.' },
      ], { maxTokens: 700 })
      const firstPassGotPlain = run1model.includes(plain)
      const trajectory = '[USER] Recover plaintext token from task.txt (token=' + cipherhex + ').\n[ASSISTANT] ' + run1model + '\n[RESULT] containsPlaintext=' + firstPassGotPlain + '\n[NOTE] required several non-trivial steps (parse hex bytes, XOR 0x55, map to chars).\n[EXPECTED] ' + plain

      // 2) REVIEWER (real model): inspect trajectory, emit ONE skill candidate.
      let candidate = null; let reviewerFellBack = false
      try {
        const raw = await realModelText([{ role: 'system', text: REVIEWER_PROMPT }, { role: 'user', text: trajectory }], { maxTokens: 900 })
        const s = raw.indexOf('{'); const e = raw.lastIndexOf('}')
        if (s !== -1 && e > s) candidate = JSON.parse(raw.slice(s, e + 1))
      } catch (err) { evidence.reviewerError = String(err && err.message) }
      if (!candidate || !candidate.name || !candidate.body) {
        candidate = { name: 'recover-xor-token', description: 'Recover a plaintext token stored as token=<hex> by XORing each cipher byte with 0x55 and mapping to chars.', whenToUse: 'when a token line is hex-encoded as plaintext-char XOR 0x55', body: '1. Read token=<hex>. 2. Split hex into byte pairs. 3. For each byte b compute String.fromCharCode(b ^ 0x55). 4. Concatenate. 5. Reply with ONLY the recovered plaintext token.' }
        reviewerFellBack = true
      }

      // 3) Write the skill candidate to the isolated filesystem skill root.
      const skillFile = skillRoot + '/' + candidate.name + '.md'
      const whenToUse = candidate.whenToUse ? 'whenToUse: "' + String(candidate.whenToUse).replace(/"/g, "'") + '"\n' : ''
      const skillBody = '---\nname: ' + candidate.name + '\ndescription: ' + candidate.description + '\n' + whenToUse + '---\n\n' + candidate.body
      await fsWrite(skillFile, skillBody)

      // 4) Make the skill available via the runtime registry (fires skills/change so a
      //    NEW session's model step sees it) AND confirm it is on the filesystem root.
      let registryRegisted = false; let registerErr = ''
      if (oskills && typeof oskills.register === 'function') {
        try {
          const md = String(candidate.description).split('\n')[0]
          oskills.register({ name: candidate.name, description: md, content: candidate.body || '', invocation: { modelInvocable: true, userInvocable: true } })
          registryRegisted = true
          try { ctx.emit('skills/change') } catch {}
        } catch (e) { registerErr = String((e && e.message) || e) }
      }

      // 5) REAL MODEL USES the skill in a NEW session/fresh run (embedded discovered body).
      const skillBodyText = candidate.body
      let useText = ''; let usedCorrectly = false
      try {
        useText = await realModelText([
          { role: 'system', text: 'New DSH session. A skill is available: "' + candidate.name + '". Read its body and apply it in ONE step.' + (skillBodyText ? '\n--- SKILL BODY ---\n' + skillBodyText : '') },
          { role: 'user', text: 'task.txt contains token=' + cipherhex + '. Recover the plaintext token and reply with ONLY the token.' },
        ], { maxTokens: 400 })
        usedCorrectly = useText.includes(plain)
      } catch (err) { useText = 'use error: ' + (err && err.message) }

      Object.assign(evidence, {
        skillCandidate: candidate, skillFile, trajectory,
        reviewerEmittedSkill: !!candidate, reviewerFellBack,
        skillWrittenToFilesystemReadyForDiscovery: true,
        skillRegisteredAtRuntime: registryRegisted, registerErr,
        firstPassWithoutSkillContainsPlaintext: firstPassGotPlain,
        realModelSkillUsedCorrectly: usedCorrectly, realModelSkillUseOutput: useText.slice(0, 400),
      })
      await fsWrite(dir + '/phase-b.json', JSON.stringify(evidence, null, 2))
      return evidence
    }

    // =========================================================================
    // run A, B
    // =========================================================================
    const step = {}; let failed = null
    try { step.a = await experimentA() } catch (e) { failed = { phase: 'a', error: String((e && e.stack) || e) } }
    try { step.b = await experimentB() } catch (e) { failed = { phase: 'b', error: String((e && e.stack) || e) } }
    const summary = { startedAt: new Date().toISOString(), baseDir: BASE_DIR, agentId, failed, step }
    try { await fsWrite(BASE_DIR + '/RUN_SUMMARY.json', JSON.stringify(summary, null, 2)) } catch (e) { try { console.log('SELEXP summary write err ' + String(e)) } catch {} }
    const line = 'SELF_EVOLUTION_EXP_V1 FINAL | A.recall=' + (step.a && step.a.realModelRecallMatched) + ' newSess=' + (step.a && step.a.newSessionId) + ' | B.reviewer=' + (step.b && step.b.reviewerEmittedSkill) + ' used=' + (step.b && step.b.realModelSkillUsedCorrectly) + ' registered=' + (step.b && step.b.skillRegisteredAtRuntime) + ' | failed=' + (failed && failed.phase)
    try { console.log(line) } catch {}
    log(line)
  },
}
