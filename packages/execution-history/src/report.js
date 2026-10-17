/**
 * @agent-core/execution-history/src/report.js — result assembly (structured)
 * and the human-readable report renderer (view=report). One core, two
 * renderings (Spec §4.1); every key conclusion carries evidence references;
 * gaps are first-class output, never absorbed into a success narrative.
 */

import { computeReportId, paginateTimeline, sourceGenerationToken, utcIso, SOURCE_RANKS } from './boundary.js'
import { reduceDimensions, absenceObservations } from './rules.js'

/**
 * @param {object} input
 * @param {string} input.root
 * @param {object} input.args
 * @param {object} input.build - {records, correlations, gaps, observations}
 * @param {Map<string, {status:object, files:object[], rows:number}>} input.loadedSources
 * @param {{agentId: string, audit: boolean}} input.viewer
 * @param {number} input.nowMs
 * @param {string} [input.cursor]
 * @param {number} [input.limit]
 * @param {(rec: object) => string} input.brief
 */
export function assembleResult(input) {
  const { root, args, build, loadedSources, viewer, nowMs, cursor, limit, brief } = input
  const sourceFiles = {}
  const sourceStatuses = {}
  for (const [name, loaded] of loadedSources) {
    sourceFiles[name] = { rows: loaded.rows, files: loaded.files ?? [] }
    sourceStatuses[name] = { ...loaded.status, truncated: loaded.status?.truncated }
  }
  const token = sourceGenerationToken(sourceFiles)
  const observations = [...build.observations, ...absenceObservations(sourceStatuses)]
  const fiveDimensions = reduceDimensions(observations)
  // Pagination/view parameters never enter the reportId hash: pages of the
  // same frozen boundary share one reportId (Spec §4.1 / T4).
  const hashArgs = Object.fromEntries(Object.entries(args ?? {}).filter(([key]) => !['cursor', 'limit', 'view', 'audience'].includes(key)))
  const reportId = computeReportId(root, hashArgs, token)
  const pagination = paginateTimeline(build.records, { cursor, limit })
  // Every consulted source appears — including per-journal entries, which
  // carry their own read status (a 0700 journal is a DEGRADED source, §2/T5).
  const rankOf = new Map(SOURCE_RANKS.map((name, index) => [name, index]))
  const sourceNames = [...loadedSources.keys()].sort((a, b) => ((rankOf.get(a) ?? SOURCE_RANKS.length) - (rankOf.get(b) ?? SOURCE_RANKS.length)) || a.localeCompare(b))
  return {
    reportId,
    queryRoot: { root, ...args },
    viewer: { agentId: viewer.agentId, scope: viewer.audit === true ? 'audit' : 'self' },
    readBoundary: {
      asOfUtc: utcIso(nowMs),
      sourceGenerationToken: token,
      sources: sourceNames.map((name) => ({
        name,
        status: sourceStatuses[name].status,
        ...(sourceStatuses[name].reason !== undefined ? { reason: sourceStatuses[name].reason } : {}),
        ...(sourceStatuses[name].badLines ? { skippedLines: sourceStatuses[name].badLines } : {}),
        coverageUtc: (sourceFiles[name]?.files ?? []).map((f) => ({ file: f.file, mtimeUtc: utcIso(f.mtimeMs) })),
      })),
      cursorSemantics: pagination.cursorSemantics,
    },
    summary: { fiveDimensions },
    timeline: pagination.entries.map((entry) => ({ ...entry, atUtc: utcIso(entry.atMs), brief: brief(entry) ?? entry.brief })),
    correlations: build.correlations,
    gaps: build.gaps,
    totalRecords: pagination.totalOrders,
    ...(pagination.nextCursor !== undefined ? { nextCursor: pagination.nextCursor } : {}),
  }
}

const VERDICT_GLYPHS = {
  BUSINESS_COMMITTED: '已提交', BUSINESS_REJECTED: '被拒绝', ADMITTED: '已准入', NOT_ADMITTED: '未准入',
  WAITING_ADMISSION: '等待准入', ACCEPTED: '已受理', STARTED: '已开始', REPLIED: '已回复',
  NO_RECEIPT: '无回执', OUTCOME_UNKNOWN: '结果未知', LEGAL_WAIT: '合法等待', LEGAL_SKIP: '合法跳过',
  FAILED: '失败', UNKNOWN: '未知', NOT_APPLICABLE: '不适用', PARTIAL: '部分可用', COMPLETE: '完整',
}

const DIM_LABELS = {
  schedulingAdmission: '调度/准入',
  agentExecution: 'Agent 执行',
  businessProgress: '业务推进',
  messageDelivery: '消息/结果投递',
  evidenceIntegrity: '证据完整性',
}

/** Render the human report (view=report). UTC + native sequence preserved. */
export function renderReportText(result) {
  const lines = []
  lines.push(`# 执行历史查询报告 ${result.reportId}`)
  lines.push(`- 查询根: ${JSON.stringify(result.queryRoot)}`)
  lines.push(`- 读取边界: asOf=${result.readBoundary.asOfUtc} (token 已冻结; 跨系统顺序仅 ${'NON_AUTHORITY'})`)
  lines.push(`- 视图: ${result.viewer.agentId} (${result.viewer.scope})`)
  lines.push('')
  lines.push('## 五维判定')
  for (const [dim, verdict] of Object.entries(result.summary.fiveDimensions)) {
    const glyph = VERDICT_GLYPHS[verdict.verdict] ?? verdict.verdict
    lines.push(`- ${DIM_LABELS[dim]}: ${glyph}${verdict.ruleIds?.length ? ` [${verdict.ruleIds.join(',')}]` : ''}`)
  }
  lines.push('')
  lines.push(`## 时间轴 (共 ${result.totalRecords} 条, 本页 ${result.timeline.length}; 原生序号保留)`)
  for (const entry of result.timeline.slice(0, 200)) {
    const seq = entry.nativeSeq !== undefined ? ` seq=${entry.nativeSeq}` : ''
    lines.push(`- ${entry.atUtc ?? '?'}.${String(entry.atMs ?? 0).slice(-3)} ${entry.source}/${entry.kind}${seq} — ${entry.brief ?? ''} {${Object.values(entry.nativeRefs ?? {}).filter(Boolean).slice(0, 3).join(', ')}}`)
  }
  if (result.totalRecords > result.timeline.length || result.nextCursor !== undefined) {
    lines.push(`- (截断可见: 本页非全量; nextCursor=${result.nextCursor ?? '(已尽)'})`)
  }
  if (result.correlations.length > 0) {
    lines.push('')
    lines.push(`## 关联 (${result.correlations.length})`)
    for (const c of result.correlations.slice(0, 50)) {
      lines.push(`- [${c.rule}] ${c.from.source}:${c.from.nativeRef} ↔ ${c.to.source}:${c.to.nativeRef}`)
    }
  }
  lines.push('')
  lines.push(`## 缺口与降级 (${result.gaps.length})`)
  if (result.gaps.length === 0) lines.push('- (无)')
  for (const g of result.gaps.slice(0, 50)) {
    lines.push(`- [${g.code}] ${g.stage}: ${g.reason ?? ''}${g.detail !== undefined ? ` (${g.detail})` : ''}`)
  }
  lines.push('')
  lines.push('## 证据源状态')
  for (const s of result.readBoundary.sources) {
    lines.push(`- ${s.name}: ${s.status}${s.reason !== undefined ? ` (${s.reason})` : ''}${s.skippedLines ? ` 跳过坏行=${s.skippedLines}` : ''}`)
  }
  return lines.join('\n')
}
